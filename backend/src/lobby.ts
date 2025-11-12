// backend/src/lobby.ts
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  PlayerId,
  LobbyId,
  Lobby,
  CreateLobbyEvent,
  JoinLobbyEvent,
  LeaveLobbyEvent,
  KickPlayerEvent,
  DisbandLobbyEvent,
  LobbyUpdate,
  StartGameEvent,
  TurnStartEvent,
  ChooseWeaponEvent,
  TurnResolvedEvent,
  NextTurnEvent,
} from "../../shared/types.js";

// ---- in-memory state --------------------------------------------------------
const lobbyIdToLobbyMap = new Map<LobbyId, Lobby>();
const playerToLobbyIdMap = new Map<PlayerId, LobbyId>();

// For de-duping: track which turnIds have been resolved per lobby
const resolvedTurnsByLobby = new Map<LobbyId, Set<number>>();

function ensureTurnSet(lobbyId: LobbyId): Set<number> {
  let s = resolvedTurnsByLobby.get(lobbyId);
  if (!s) {
    s = new Set<number>();
    resolvedTurnsByLobby.set(lobbyId, s);
  }
  return s;
}

// Canonical damage table → exactly 10, 30, 50, 80
function damageForWeapon(weaponId: string | undefined): number {
  const key = (weaponId || "").toLowerCase();
  const byKey: Record<string, number> = {
    laser: 10, w1: 10, "w-1": 10,
    missile: 30, w2: 30, "w-2": 30,
    railgun: 50, w3: 50, "w-3": 50,
    nuke: 80, w4: 80, "w-4": 80,
    // common uppercase aliases
    w1u: 10, w2u: 30, w3u: 50, w4u: 80,
  };
  if (byKey[key as keyof typeof byKey] != null) return byKey[key as keyof typeof byKey];
  // default conservative
  return 10;
}

// ---- exports used by index.ts ----------------------------------------------
export function getLobbyMap() {
  return lobbyIdToLobbyMap;
}

// ---- main socket wiring -----------------------------------------------------
export function setupSocket(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket
) {
  // -------------------- Create Lobby --------------------
  socket.on("createLobby", (payload: CreateLobbyEvent) => {
    const { hostId, hostName, lobbyName, settings } = payload;

    // If this host already has a lobby, disband it first
    const existingLobbyId = playerToLobbyIdMap.get(hostId);
    if (existingLobbyId) {
      const existing = lobbyIdToLobbyMap.get(existingLobbyId);
      if (existing) {
        io.to(existing.lobbyId).emit("lobbyDisbanded", {
          lobbyId: existing.lobbyId,
          reason: "host-created-new-lobby",
        });
        io.socketsLeave(existing.lobbyId);
        lobbyIdToLobbyMap.delete(existing.lobbyId);
        resolvedTurnsByLobby.delete(existing.lobbyId);
        for (const p of existing.players) playerToLobbyIdMap.delete(p.playerId);
      }
    }

    const lobbyId = randomUUID();
    socket.join(lobbyId);

    const lobby: Lobby = {
      host: { hostId, hostName },
      lobbyId,
      lobbyName,
      settings,
      players: [{ playerId: hostId, playerName: hostName }],
    };

    lobbyIdToLobbyMap.set(lobbyId, lobby);
    playerToLobbyIdMap.set(hostId, lobbyId);
    resolvedTurnsByLobby.set(lobbyId, new Set<number>());

    const update: LobbyUpdate = {
      lobbyId,
      lobbyName,
      host: lobby.host,
      players: lobby.players,
      settings,
    };
    io.to(lobbyId).emit("lobbyUpdate", update);
  });

  // -------------------- Join Lobby --------------------
  socket.on("joinLobby", (payload: JoinLobbyEvent) => {
    const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);
    if (!lobby) {
      socket.emit("error", {
        code: 404,
        message: `Lobby not found with id ${payload.lobbyId}.`,
      });
      return;
    }

    // Prevent duplicate joins
    if (lobby.players.some((p) => p.playerId === payload.playerId)) {
      socket.emit("error", { code: 409, message: "Player already in this lobby." });
      return;
    }

    // Make display names unique inside the lobby
    const baseName = payload.playerName.trim();
    const pattern = new RegExp(`^${baseName}(\\s\\[\\d+\\])?$`, "i");
    const dupCount = lobby.players.filter((p) => pattern.test(p.playerName)).length;
    const finalName = dupCount > 0 ? `${baseName} [${dupCount + 1}]` : baseName;

    lobby.players.push({ playerId: payload.playerId, playerName: finalName });
    playerToLobbyIdMap.set(payload.playerId, lobby.lobbyId);
    socket.join(lobby.lobbyId);

    ensureTurnSet(lobby.lobbyId);

    const update: LobbyUpdate = {
      lobbyId: lobby.lobbyId,
      lobbyName: lobby.lobbyName,
      host: lobby.host,
      players: lobby.players,
      settings: lobby.settings,
    };
    io.to(lobby.lobbyId).emit("lobbyUpdate", update);
  });

  // -------------------- Leave Lobby --------------------
  socket.on("leaveLobby", (payload: LeaveLobbyEvent) => {
    const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);
    if (!lobby) {
      socket.emit("error", {
        code: 404,
        message: `Lobby not found with id ${payload.lobbyId}.`,
      });
      return;
    }

    socket.leave(lobby.lobbyId);
    playerToLobbyIdMap.delete(payload.playerId);

    const idx = lobby.players.findIndex((p) => p.playerId === payload.playerId);
    if (idx === -1) {
      socket.emit("error", {
        code: 404,
        message: `Player ${payload.playerId} not found in Lobby ${payload.lobbyId}.`,
      });
      return;
    }
    lobby.players.splice(idx, 1);

    const update: LobbyUpdate = {
      lobbyId: lobby.lobbyId,
      lobbyName: lobby.lobbyName,
      host: lobby.host,
      players: lobby.players,
      settings: lobby.settings,
    };
    io.to(lobby.lobbyId).emit("lobbyUpdate", update);
  });

  // -------------------- Start Game (HOST only) --------------------
  socket.on("startGame", (payload: StartGameEvent) => {
    const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);
    if (!lobby) {
      socket.emit("error", { code: 404, message: `Lobby not found with id ${payload.lobbyId}.` });
      return;
    }

    if (!lobby.players || lobby.players.length < 2) {
      socket.emit("error", { code: 400, message: "Need at least 2 players to start." });
      return;
    }

    // reset resolved turns for a fresh game
    resolvedTurnsByLobby.set(lobby.lobbyId, new Set<number>());

    const first = lobby.players[0].playerId;
    const evt: TurnStartEvent = { turnId: 0, playerId: first, validWeapons: [] };
    io.to(lobby.lobbyId).emit("turnStart", evt);
  });

  // -------------------- Choose Weapon (authoritative damage + de-dupe) -------
  socket.on("chooseWeapon", (payload: ChooseWeaponEvent) => {
    const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);
    if (!lobby) {
      socket.emit("error", { code: 404, message: `Lobby not found with id ${payload.lobbyId}.` });
      return;
    }

    const seen = ensureTurnSet(lobby.lobbyId);
    if (seen.has(payload.turnId)) {
      // already resolved this turn; ignore duplicate client sends
      return;
    }
    seen.add(payload.turnId);

    // authoritative damage mapping (10,30,50,80)
    const dmg = damageForWeapon(payload.weaponId);

    const update: TurnResolvedEvent = {
      turnId: payload.turnId,
      attackerId: payload.playerId,
      defenderId: payload.targetPlayerId,
      weaponId: payload.weaponId,
      outcome: "success",
      damage: dmg,
    };
    io.to(lobby.lobbyId).emit("turnResolved", update);
  });

  // -------------------- Next Turn (single advance by attacker) ---------------
  socket.on("nextTurn", (payload: NextTurnEvent) => {
    const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);
    if (!lobby) {
      socket.emit("error", { code: 404, message: `Lobby not found with id ${payload.lobbyId}.` });
      return;
    }

    const currentIdx = lobby.players.findIndex((p) => p.playerId === payload.currentPlayer);
    if (currentIdx === -1) return;

    const nextIdx = (currentIdx + 1) % lobby.players.length;
    const nextPlayer = lobby.players[nextIdx];

    const evt: TurnStartEvent = {
      turnId: payload.turnId + 1,
      playerId: nextPlayer.playerId,
      validWeapons: [],
    };
    io.to(lobby.lobbyId).emit("turnStart", evt);
  });

  // -------------------- Disband ---------------------------------------------
  socket.on("disbandLobby", (payload: DisbandLobbyEvent) => {
    const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);
    if (!lobby) {
      socket.emit("error", { code: 404, message: `Lobby not found with id ${payload.lobbyId}.` });
      return;
    }

    io.to(lobby.lobbyId).emit("lobbyDisbanded", {
      lobbyId: lobby.lobbyId,
      reason: "host-disbanded",
    });
    io.socketsLeave(lobby.lobbyId);

    lobbyIdToLobbyMap.delete(lobby.lobbyId);
    resolvedTurnsByLobby.delete(lobby.lobbyId);
    playerToLobbyIdMap.forEach((lid, pid) => {
      if (lid === lobby.lobbyId) playerToLobbyIdMap.delete(pid);
    });
  });

  // -------------------- Presence --------------------------------------------
  socket.on("disconnect", () => {
    // optional: track presence
  });
}

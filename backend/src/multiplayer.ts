// backend/src/multiplayer.ts
import { Server, Socket } from "socket.io";
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    LobbyId,
    PlayerId,
    Lobby,
    StartGameEvent,
    TurnStartEvent,
    ChooseWeaponEvent,
    NextTurnEvent,
    MinigameResultEvent,
    MinigameStartEvent,
    TurnResolvedEvent,
    GameEndedEvent,
    WeaponId,
} from "../../shared/types.js";
import {
    lobbyIdToLobbyMap,
    playerToLobbyIdMap,
} from "./lobby.js";

// Attach ONLY multiplayer-related handlers here
export function setupMultiplayerSocket(
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
) {
    // === MULTIPLAYER TURN FLOW ====================================

    socket.on("startGame", (payload: StartGameEvent) => {
        const lobby: Lobby | undefined = lobbyIdToLobbyMap.get(payload.lobbyId);

        if (!lobby) {
            socket.emit("error", {
                code: 404,
                message: `Lobby not found with id ${payload.lobbyId}.`,
            });
            return;
        }

        const update: TurnStartEvent = {
            turnId: 0,
            playerId: lobby.players[0].playerId,
        };

        io.to(lobby.lobbyId).emit("turnStart", update);
    });

    socket.on("chooseWeapon", (payload: ChooseWeaponEvent) => {
        const lobby: Lobby | undefined = lobbyIdToLobbyMap.get(payload.lobbyId);

        if (!lobby) {
            socket.emit("error", {
                code: 404,
                message: `Lobby not found with id ${payload.lobbyId}.`,
            });
            return;
        }

        const update: MinigameStartEvent = {
            lobbyId: payload.lobbyId,
            attackerId: payload.playerId,
            defenderId: payload.targetPlayerId,
            weaponId: payload.weaponId,
        };

        io.to(lobby.lobbyId).emit("minigameStart", update);
    });

    socket.on("nextTurn", (payload: NextTurnEvent) => {
        const lobby: Lobby | undefined = lobbyIdToLobbyMap.get(payload.lobbyId);

        if (!lobby) {
            socket.emit("error", {
                code: 404,
                message: `Lobby not found with id ${payload.lobbyId}.`,
            });
            return;
        }

        const update: TurnStartEvent = {
            turnId: payload.turnId + 1,
            playerId:
                lobby.players[0].playerId === payload.currentPlayer
                    ? lobby.players[1].playerId
                    : lobby.players[0].playerId,
        };

        io.to(lobby.lobbyId).emit("turnStart", update);
    });

    // Minigame results from Fuel Sort, etc.
    socket.on("minigameResult", (payload: MinigameResultEvent) => {
        const lobby: Lobby | undefined = lobbyIdToLobbyMap.get(payload.lobbyId);

        if (!lobby) {
            socket.emit("error", {
                code: 404,
                message: `Lobby not found with id ${payload.lobbyId}.`,
            });
            return;
        }

        // 1) Damage based on weapon + success/fail
        const weaponBaseDamage: Record<WeaponId, number> = {
            W1: 10,  // easy
            W2: 40,  // medium
            W3: 80,  // hard
        };

        const base = weaponBaseDamage[payload.weaponId] ?? 10;
        const isSuccess = payload.outcome === "success";
        const damageResult = isSuccess ? base : 5;

        // 2) Normalize outcome to match TurnResolvedEvent ('success' | 'failure' | undefined)
        const normalizedOutcome: "success" | "failure" | undefined =
            payload.outcome === "success"
                ? "success"
                : payload.outcome === "failure"
                    ? "failure"
                    : undefined; // 'timeout' | 'blocked' → undefined (treated as failure client-side)

        const update: TurnResolvedEvent = {
            turnId: payload.turnId,
            attackerId: payload.playerId,
            defenderId: payload.targetPlayerId,
            weaponId: payload.weaponId,
            outcome: normalizedOutcome,
            damage: damageResult,
        };

        io.to(lobby.lobbyId).emit("turnResolved", update);
    });

    // === GAME LIFECYCLE ===========================================

    // Player returns to main menu during a game
    socket.on("playerExitGame", (payload: { lobbyId: LobbyId; playerId: PlayerId }) => {
        const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);
        if (!lobby) return;

        const eventPayload: GameEndedEvent = {
            lobbyId: payload.lobbyId,
            reason: "Player returned to main menu",
            by: payload.playerId,
        };

        io.to(payload.lobbyId).emit("gameEnded", eventPayload);

        for (const p of lobby.players) {
            playerToLobbyIdMap.delete(p.playerId);
        }
        lobbyIdToLobbyMap.delete(payload.lobbyId);
        io.in(payload.lobbyId).socketsLeave(payload.lobbyId);
    });
}

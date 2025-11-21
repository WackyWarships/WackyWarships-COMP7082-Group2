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
} from "../../shared/types.js";

// Exported maps so multiplayer.ts can reuse them
export const lobbyIdToLobbyMap = new Map<LobbyId, Lobby>();
export const playerToLobbyIdMap = new Map<PlayerId, LobbyId>();

export function getLobbyMap() {
    return lobbyIdToLobbyMap;
}

export function setupSocket(
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    socket: Socket
) {
    socket.on("createLobby", (payload: CreateLobbyEvent) => {
        const { hostId, hostName, lobbyName, settings } = payload;

        const existingLobbyId = playerToLobbyIdMap.get(hostId);
        if (existingLobbyId) {
            const existingLobby = lobbyIdToLobbyMap.get(existingLobbyId);
            if (existingLobby && existingLobby.host.hostId === hostId) {
                io.to(existingLobby.lobbyId).emit("lobbyDisbanded", {
                    lobbyId: existingLobby.lobbyId,
                    reason: "Host started a new lobby",
                });
                for (const p of existingLobby.players) {
                    playerToLobbyIdMap.delete(p.playerId);
                }
                lobbyIdToLobbyMap.delete(existingLobby.lobbyId);
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

        const update: LobbyUpdate = {
            lobbyId,
            lobbyName,
            host: lobby.host,
            players: lobby.players,
            settings,
        };

        console.log("[lobby] current lobbies:", [...lobbyIdToLobbyMap.values()]);
        io.to(lobbyId).emit("lobbyUpdate", update);
    });

    socket.on("joinLobby", (payload: JoinLobbyEvent) => {
        const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);

        if (!lobby) {
            socket.emit("error", {
                code: 404,
                message: `Lobby not found with id ${payload.lobbyId}.`,
            });
            return;
        }

        if (lobby.players.length >= 2) {
            socket.emit("error", {
                code: 403,
                message: "This lobby is full (2 players max)",
            });
            return;
        }

        if (lobby.players.some((p) => p.playerId === payload.playerId)) {
            socket.emit("error", {
                code: 409,
                message: "Player already in this lobby.",
            });
            return;
        }

        const baseName = payload.playerName.trim();
        const pattern = new RegExp(`^${baseName}(\\s\\[\\d+\\])?$`, "i");
        const duplicates = lobby.players.filter((p) =>
            pattern.test(p.playerName)
        );

        let finalName = baseName;
        if (duplicates.length > 0) {
            finalName = `${baseName} [${duplicates.length + 1}]`;
        }

        lobby.players.push({
            playerId: payload.playerId,
            playerName: finalName,
        });
        playerToLobbyIdMap.set(payload.playerId, lobby.lobbyId);
        socket.join(lobby.lobbyId);

        const update: LobbyUpdate = {
            lobbyId: lobby.lobbyId,
            lobbyName: lobby.lobbyName,
            host: lobby.host,
            players: lobby.players,
            settings: lobby.settings,
        };

        io.to(lobby.lobbyId).emit("lobbyUpdate", update);
    });

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

        const playerIdx = lobby.players.findIndex(
            (p) => p.playerId === payload.playerId
        );

        if (playerIdx > -1) {
            lobby.players.splice(playerIdx, 1);
        } else {
            socket.emit("error", {
                code: 404,
                message: `Player ${payload.playerId} not found in Lobby ${payload.lobbyId}.`,
            });
            return;
        }

        const update: LobbyUpdate = {
            lobbyId: lobby.lobbyId,
            lobbyName: lobby.lobbyName,
            host: lobby.host,
            players: lobby.players,
            settings: lobby.settings,
        };

        io.to(lobby.lobbyId).emit("lobbyUpdate", update);
    });

    // === LOBBY MANAGEMENT =====================

    socket.on("kickPlayer", (payload: KickPlayerEvent) => {
        const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);
        if (!lobby) {
            socket.emit("error", {
                code: 404,
                message: `Lobby not found with id ${payload.lobbyId}.`,
            });
            return;
        }

        const hostId = lobby.host.hostId;
        if (payload.targetPlayerId === hostId) {
            socket.emit("error", {
                code: 403,
                message: "Host cannot kick themselves.",
            });
            return;
        }

        const idx = lobby.players.findIndex(
            (p) => p.playerId === payload.targetPlayerId
        );
        if (idx === -1) {
            socket.emit("error", {
                code: 404,
                message: `Player ${payload.targetPlayerId} not found in lobby.`,
            });
            return;
        }

        lobby.players.splice(idx, 1);
        playerToLobbyIdMap.delete(payload.targetPlayerId);

        io.to(lobby.lobbyId).emit("playerKicked", {
            lobbyId: lobby.lobbyId,
            targetPlayerId: payload.targetPlayerId,
            by: hostId,
            reason: payload.reason || "Removed by host",
        });
    });

    socket.on("disbandLobby", (payload: DisbandLobbyEvent) => {
        const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);
        if (!lobby) {
            socket.emit("error", {
                code: 404,
                message: `Lobby not found with id ${payload.lobbyId}.`,
            });
            return;
        }

        io.to(lobby.lobbyId).emit("lobbyDisbanded", {
            lobbyId: lobby.lobbyId,
            reason: payload.reason || "Lobby disbanded by host",
        });

        for (const p of lobby.players) {
            playerToLobbyIdMap.delete(p.playerId);
        }
        lobbyIdToLobbyMap.delete(lobby.lobbyId);
        io.in(lobby.lobbyId).socketsLeave(lobby.lobbyId);
    });
}

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
    MinigameResultEvent,
    MinigameStartEvent,
} from '../../shared/types.js';

const lobbyIdToLobbyMap = new Map<LobbyId, Lobby>();
const playerToLobbyIdMap = new Map<PlayerId, LobbyId>();

export function getLobbyMap() {
    return lobbyIdToLobbyMap;
}

export function setupSocket(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: Socket) {
    socket.on('createLobby', (payload: CreateLobbyEvent) => {
        const { hostId, hostName, lobbyName, settings } = payload;

        const existingLobbyId = playerToLobbyIdMap.get(hostId);
        if (existingLobbyId) {
            const existingLobby = lobbyIdToLobbyMap.get(existingLobbyId);
            if (existingLobby && existingLobby.host.hostId === hostId) {
                // Disband the old lobby first
                io.to(existingLobby.lobbyId).emit('lobbyDisbanded', {
                    lobbyId: existingLobby.lobbyId,
                    reason: 'Host started a new lobby',
                });
                for (const p of existingLobby.players) {
                    playerToLobbyIdMap.delete(p.playerId);
                }
                lobbyIdToLobbyMap.delete(existingLobby.lobbyId);
            }
        }

        const lobbyId = crypto.randomUUID();
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

        console.log([...lobbyIdToLobbyMap.values()]);

        io.to(lobbyId).emit('lobbyUpdate', update);
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

        // Prevent duplicate joins
        if (lobby.players.some(p => p.playerId === payload.playerId)) {
            socket.emit("error", {
                code: 409,
                message: "Player already in this lobby.",
            });
            return;
        }

        // Generate unique display name before adding 
        const baseName = payload.playerName.trim();
        const pattern = new RegExp(`^${baseName}(\\s\\[\\d+\\])?$`, "i");
        const duplicates = lobby.players.filter(p => pattern.test(p.playerName));

        let finalName = baseName;
        if (duplicates.length > 0) {
            finalName = `${baseName} [${duplicates.length + 1}]`;
        }

        // Add player with unique name
        lobby.players.push({ playerId: payload.playerId, playerName: finalName });
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

        const playerIdx = lobby.players.findIndex(p => p.playerId === payload.playerId);

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

    socket.on('startGame', (payload: StartGameEvent) => {
        let lobby: Lobby | undefined = undefined;

        if (lobby = lobbyIdToLobbyMap.get(payload.lobbyId)) {
            const update: TurnStartEvent = {
                turnId: 0,
                playerId: lobby.players[0].playerId
            };

            io.to(lobby.lobbyId).emit('turnStart', update);
        }
        else {
            socket.emit("error", { code: 404, message: `Lobby not found with id ${payload.lobbyId}.` });
        }
    });

    socket.on('chooseWeapon', (payload: ChooseWeaponEvent) => {
        let lobby: Lobby | undefined = undefined;

        if (lobby = lobbyIdToLobbyMap.get(payload.lobbyId)) {
            // Should be start minigame event once minigame is implemented       
            const update: MinigameStartEvent = {
                lobbyId: payload.lobbyId,
                attackerId: payload.playerId,
                defenderId: payload.targetPlayerId,
                weaponId: payload.weaponId,
            };

            io.to(lobby.lobbyId).emit('minigameStart', update);
        }
        else {
            socket.emit("error", { code: 404, message: `Lobby not found with id ${payload.lobbyId}.` });
        }
    });

    socket.on('nextTurn', (payload: NextTurnEvent) => {
        let lobby: Lobby | undefined = undefined;

        if (lobby = lobbyIdToLobbyMap.get(payload.lobbyId)) {
            const update: TurnStartEvent = {
                turnId: payload.turnId + 1,
                playerId: lobby.players[0].playerId == payload.currentPlayer ? lobby.players[1].playerId : lobby.players[0].playerId,
            };

            io.to(lobby.lobbyId).emit('turnStart', update);
        }
        else {
            socket.emit("error", { code: 404, message: `Lobby not found with id ${payload.lobbyId}.` });
        }
    });

    socket.on('minigameResult', (payload: MinigameResultEvent) => {
        let lobby: Lobby | undefined = undefined;

        if (lobby = lobbyIdToLobbyMap.get(payload.lobbyId)) {
            const damageResult = payload.outcome == 'success' ? 10 : 5;
            
            const update: TurnResolvedEvent = {
                turnId: payload.turnId,
                attackerId: payload.playerId,
                defenderId: payload.targetPlayerId,
                damage: damageResult,
            };

            io.to(lobby.lobbyId).emit('turnResolved', update);
        }
        else {
            socket.emit("error", { code: 404, message: `Lobby not found with id ${payload.lobbyId}.` });
        }
    });

    // Host-only: kick a player from the lobby
    socket.on('kickPlayer', (payload: KickPlayerEvent) => {
        const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);
        if (!lobby) {
            socket.emit('error', { code: 404, message: `Lobby not found with id ${payload.lobbyId}.` });
            return;
        }

        const hostId = lobby.host.hostId;

        // prevent host from kicking themselves
        if (payload.targetPlayerId === hostId) {
            socket.emit('error', { code: 403, message: 'Host cannot kick themselves.' });
            return;
        }

        const idx = lobby.players.findIndex(p => p.playerId === payload.targetPlayerId);
        if (idx === -1) {
            socket.emit('error', { code: 404, message: `Player ${payload.targetPlayerId} not found in lobby.` });
            return;
        }

        lobby.players.splice(idx, 1);
        playerToLobbyIdMap.delete(payload.targetPlayerId);

        io.to(lobby.lobbyId).emit('playerKicked', {
            lobbyId: lobby.lobbyId,
            targetPlayerId: payload.targetPlayerId,
            by: hostId,
            reason: payload.reason || 'Removed by host',
        });

        const update: LobbyUpdate = {
            lobbyId: lobby.lobbyId,
            lobbyName: lobby.lobbyName,
            host: lobby.host,
            players: lobby.players,
            settings: lobby.settings,
        };
        io.to(lobby.lobbyId).emit('lobbyUpdate', update);
    });

    // Host-only: disband lobby
    socket.on('disbandLobby', (payload: DisbandLobbyEvent) => {
        const lobby = lobbyIdToLobbyMap.get(payload.lobbyId);
        if (!lobby) {
            socket.emit('error', { code: 404, message: `Lobby not found with id ${payload.lobbyId}.` });
            return;
        }

        io.to(lobby.lobbyId).emit('lobbyDisbanded', {
            lobbyId: lobby.lobbyId,
            reason: payload.reason || 'Lobby disbanded by host',
        });

        for (const p of lobby.players) {
            playerToLobbyIdMap.delete(p.playerId);
        }
        lobbyIdToLobbyMap.delete(lobby.lobbyId);
        io.in(lobby.lobbyId).socketsLeave(lobby.lobbyId);
    });
}

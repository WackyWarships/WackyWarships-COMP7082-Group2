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
    LobbyUpdate,
    StartGameEvent,
    TurnStartEvent,
    ChooseWeaponEvent,
    TurnResolvedEvent,
    NextTurnEvent,
} from '../../shared/types.js';

const lobbyIdToLobbyMap = new Map<LobbyId, Lobby>();
const playerToLobbyIdMap = new Map<PlayerId, LobbyId>();

export function getLobbyMap() {
    return lobbyIdToLobbyMap;
}

export function setupSocket(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: Socket) {
    socket.on('createLobby', (payload: CreateLobbyEvent) => {
        const { hostId, hostName, lobbyName, settings } = payload;
        const lobbyId = crypto.randomUUID();
        socket.join(lobbyId);

        const lobby: Lobby = {
            hostId,
            hostName,
            lobbyId,
            lobbyName,
            settings,
            players: [hostId],
        };

        lobbyIdToLobbyMap.set(lobbyId, lobby);
        playerToLobbyIdMap.set(hostId, lobbyId);

        const update: LobbyUpdate = {
            lobbyId,
            lobbyName,
            hostId,
            hostName,
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

        socket.join(lobby.lobbyId);
        playerToLobbyIdMap.set(payload.playerId, lobby.lobbyId);

        // prevent duplicate join
        if (!lobby.players.includes(payload.playerId)) {
            lobby.players.push(payload.playerId);
        }

        const update: LobbyUpdate = {
            lobbyId: lobby.lobbyId,
            lobbyName: lobby.lobbyName,
            hostId: lobby.hostId,
            hostName: lobby.hostName,
            players: lobby.players,
            settings: lobby.settings,
        };

        console.log([...lobbyIdToLobbyMap.values()]);

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

        const playerIdx = lobby.players.indexOf(payload.playerId);

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
            hostId: lobby.hostId,
            hostName: lobby.hostName,
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
                playerId: lobby.players[0]
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
            const update: TurnResolvedEvent = {
                turnId: payload.turnId,
                attackerId: payload.playerId,
                defenderId: payload.targetPlayerId,
                weaponId: payload.weaponId,
                outcome: 'success',
                damage: 5,
            };

            io.to(lobby.lobbyId).emit('turnResolved', update);
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
                playerId: lobby.players[0] == payload.currentPlayer ? lobby.players[1] : lobby.players[0],
            };

            io.to(lobby.lobbyId).emit('turnStart', update);
        }
        else {
            socket.emit("error", { code: 404, message: `Lobby not found with id ${payload.lobbyId}.` });
        }
    });
}
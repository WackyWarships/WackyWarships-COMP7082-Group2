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
} from 'shared/types.ts';

const lobbyIdToLobbyMap = new Map<LobbyId, Lobby>();
const playerToLobbyIdMap = new Map<PlayerId, LobbyId>();

export function getLobbyMap() {
    return lobbyIdToLobbyMap;
}

export function setupSocket(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: Socket) {
    socket.on('createLobby', (payload: CreateLobbyEvent) => {
        const lobbyId = crypto.randomUUID();
        socket.join(lobbyId);
        playerToLobbyIdMap.set(payload.playerId, lobbyId);
        
        const lobby: Lobby = {
            id: lobbyId,
            name: payload.hostName ?? `${payload.playerId}'s Lobby`,
            players: [payload.playerId],
            host: payload.playerId
        };
        lobbyIdToLobbyMap.set(lobbyId, lobby);

        const update: LobbyUpdate = {
            lobbyId: lobbyId,
            players: lobby.players,
            hostId: payload.playerId
        };

        io.to(lobbyId).emit('lobbyUpdate', update);
    });

    socket.on('joinLobby', (payload: JoinLobbyEvent) => {
        let lobby: Lobby | undefined = undefined;

        if (lobby = lobbyIdToLobbyMap.get(payload.lobbyId)) {
            socket.join(lobby.id);
            playerToLobbyIdMap.set(payload.playerId, lobby.id);

            lobby.players.push(payload.playerId);

            const update: LobbyUpdate = {
                lobbyId: lobby.id,
                players: lobby.players,
                hostId: lobby.host
            };

            io.to(lobby.id).emit('lobbyUpdate', update);
        } 
        else {
            socket.emit("error", {code: 404, message: `Lobby not found with id ${payload.lobbyId}.`});
        }
    });

    socket.on('leaveLobby', (payload: LeaveLobbyEvent) => {
        let lobby: Lobby | undefined = undefined;

        if (lobby = lobbyIdToLobbyMap.get(payload.lobbyId)) {
            socket.leave(lobby.id);
            playerToLobbyIdMap.delete(payload.playerId);

            const playerIdx = lobby.players.findIndex(player => player === payload.playerId);

            if (playerIdx > -1) {
                lobby.players.splice(playerIdx, 1);

                const update: LobbyUpdate = {
                    lobbyId: lobby.id,
                    players: lobby.players,
                    hostId: lobby.host
                };

                io.to(lobby.id).emit('lobbyUpdate', update);
            } 
            else {
                socket.emit("error", {code: 404, message: `Player ${payload.playerId} not found in Lobby ${payload.lobbyId}.`});
            }
        } 
        else {
            socket.emit("error", {code: 404, message: `Lobby not found with id ${payload.lobbyId}.`});
        }
    });

    socket.on('startGame', (payload: StartGameEvent) => {
        let lobby: Lobby | undefined = undefined;

        if (lobby = lobbyIdToLobbyMap.get(payload.lobbyId)) {
            const update: TurnStartEvent = {
                turnId: 0,
                playerId: lobby.players[0]
            };

            io.to(lobby.id).emit('turnStart', update);
        } 
        else {
            socket.emit("error", {code: 404, message: `Lobby not found with id ${payload.lobbyId}.`});
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

            io.to(lobby.id).emit('turnResolved', update);
        } 
        else {
            socket.emit("error", {code: 404, message: `Lobby not found with id ${payload.lobbyId}.`});
        }
    });

    socket.on('nextTurn', (payload: NextTurnEvent) => {
        let lobby: Lobby | undefined = undefined;

        if (lobby = lobbyIdToLobbyMap.get(payload.lobbyId)) {
            const update: TurnStartEvent = {
                turnId: payload.turnId + 1,
                playerId: lobby.players[0] == payload.currentPlayer ? lobby.players[1] : lobby.players[0],
            };

            io.to(lobby.id).emit('turnStart', update);
        } 
        else {
            socket.emit("error", {code: 404, message: `Lobby not found with id ${payload.lobbyId}.`});
        }
    });
}
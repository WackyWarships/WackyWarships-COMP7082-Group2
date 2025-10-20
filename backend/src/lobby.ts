import { Server, Socket } from "socket.io";
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    PlayerId,
    LobbyId,
    Lobby,
    CreateEvent,
    JoinEvent,
    LeaveEvent,
    LobbyUpdate,
} from 'shared/types.ts';

const lobbyIdToLobbyMap = new Map<LobbyId, Lobby>();
const playerToLobbyIdMap = new Map<PlayerId, LobbyId>();

export function setupSocket(io: Server<ClientToServerEvents, ServerToClientEvents>, socket: Socket) {
    socket.on('createLobby', (payload: CreateEvent) => {
        const lobbyId = crypto.randomUUID();
        socket.join(lobbyId);
        playerToLobbyIdMap.set(payload.playerId, lobbyId);
        
        const lobby: Lobby = {
            id: lobbyId,
            name: payload.name ?? `${payload.playerId}'s Lobby`,
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

    socket.on('joinLobby', (payload: JoinEvent) => {
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

    socket.on('leaveLobby', (payload: LeaveEvent) => {
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
}
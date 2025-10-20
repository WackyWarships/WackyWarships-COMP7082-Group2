import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import EventBus from '../game/EventBus';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    ServerSnapshot,
    LobbyUpdate,
    TurnStartEvent,
    TurnResolvedEvent,
    GameStateTurn,
    GroupMinigameStartEvent,
    GroupMinigameResolvedEvent,
    MinigameResultEvent,
    GroupMinigameResultEvent,
    ChooseWeaponEvent,
    CreateLobbyEvent,
    JoinLobbyEvent,
    LeaveLobbyEvent,
    ReconnectRequest,
    PlayerDisconnectedEvent,
    PlayerReconnectedEvent,
    ReconnectResponse,
    ResumeTurnEvent,
} from './types';


// Create runtime socket then cast it to a typed Socket<ServerToClientEvents,ClientToServerEvents>.

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function initSocket(token?: string) {
    if (socket) return socket;

    const raw = io(import.meta.env.VITE_BACKEND_URL || '/', {
        auth: { token },
        transports: ['websocket'],
    });

    socket = raw as unknown as Socket<ServerToClientEvents, ClientToServerEvents>;

    socket.on('connect', (): void => {
        console.debug('socket connected', socket!.id);
    });

    socket.on('connect_error', (err: unknown): void => {
        console.warn('socket connect_error', err);
        EventBus.emit('error', { code: 0, message: 'Failed to connect' });
    });

    // server -> client forwarding (typed with explicit void return)
    socket.on('snapshot', (snapshot: ServerSnapshot): void => {
        EventBus.emit('snapshot', snapshot);
    });

    socket.on('ack', (ack): void => {
        EventBus.emit('ack', ack);
    });

    socket.on('lobbyUpdate', (lu: LobbyUpdate): void => {
        EventBus.emit('lobby-update', lu);
    });

    socket.on('error', (err): void => {
        EventBus.emit('error', err);
    });

    socket.on('turnStart', (evt: TurnStartEvent): void => {
        EventBus.emit('turn-start', evt);
    });

    socket.on('turnResolved', (res: TurnResolvedEvent): void => {
        EventBus.emit('turn-resolved', res);
    });

    socket.on('gameState', (gs: GameStateTurn): void => {
        EventBus.emit('game-state', gs);
    });

    socket.on('groupMinigameStart', (gms: GroupMinigameStartEvent): void => {
        EventBus.emit('group-minigame-start', gms);
    });

    socket.on('groupMinigameResolved', (gmr: GroupMinigameResolvedEvent): void => {
        EventBus.emit('group-minigame-resolved', gmr);
    });

    // Presence/Reconnect
    socket.on('playerDisconnected', (pd: PlayerDisconnectedEvent): void => {
        EventBus.emit('player-disconnected', pd);
    });

    socket.on('playerReconnected', (pr: PlayerReconnectedEvent): void => {
        EventBus.emit('player-reconnected', pr);
    });

    socket.on('reconnectResponse', (rr: ReconnectResponse): void => {
        EventBus.emit('reconnect-response', rr);
    });

    socket.on('resumeTurn', (r: ResumeTurnEvent): void => {
        EventBus.emit('resume-turn', r);
    });

    return socket;
}

//  Helpers for client->server emits  --------------------------

function ensureSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!socket) throw new Error('socket not initialized — call initSocket() first');
    return socket;
}

export function sendCreateLobby(payload: CreateLobbyEvent): void {
    ensureSocket().emit('createLobby', payload);
}

export function sendJoinLobby(payload: JoinLobbyEvent): void {
    ensureSocket().emit('joinLobby', payload);
}

export function sendLeaveLobby(payload: LeaveLobbyEvent): void {
    ensureSocket().emit('leaveLobby', payload);
}

export function sendChooseWeapon(payload: ChooseWeaponEvent): void {
    ensureSocket().emit('chooseWeapon', payload);
}

export function sendMinigameResult(payload: MinigameResultEvent): void {
    ensureSocket().emit('minigameResult', payload);
}

export function sendGroupMinigameResult(payload: GroupMinigameResultEvent): void {
    ensureSocket().emit('groupMinigameResult', payload);
}

export function sendReconnectRequest(payload: ReconnectRequest): void {
    ensureSocket().emit('reconnectRequest', payload);
}

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return socket;
}

export function closeSocket(): void {
    if (!socket) return;
    try {
        socket.close();
    } catch (e) {
        console.error('Error closing socket:', e);
    }
    socket = null;
}
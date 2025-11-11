import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import EventBus from '../game/EventBus';
import { getOrCreatePlayerId } from '../game/utils/playerUsername';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    ServerSnapshot,
    LobbyUpdate,
    UsernameSetEvent,
    TurnStartEvent,
    TurnResolvedEvent,
    GameStateTurn,
    GroupMinigameStartEvent,
    GroupMinigameResolvedEvent,
    MinigameResultEvent,
    GroupMinigameResultEvent,
    ChooseWeaponEvent,
    SetUsernameEvent,
    CreateLobbyEvent,
    JoinLobbyEvent,
    LeaveLobbyEvent,
    KickPlayerEvent,
    DisbandLobbyEvent,
    ReconnectRequest,
    PlayerDisconnectedEvent,
    PlayerReconnectedEvent,
    ReconnectResponse,
    ResumeTurnEvent,
    StartGameEvent,
    NextTurnEvent,
    PlayerId,
    PlayerKickedNotice,
    LobbyDisbandedNotice,
} from 'shared/types';


// -----------------------------------------------------------
// Socket Initialization & Player Identity
// -----------------------------------------------------------

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
const playerId: PlayerId = getOrCreatePlayerId();

export function initSocket(token?: string) {
    if (socket) return socket;

    const raw = io(import.meta.env.VITE_BACKEND_URL || '/', {
        auth: { token },
        transports: ['websocket'],
    });

    socket = raw as unknown as Socket<ServerToClientEvents, ClientToServerEvents>;

    // Connection Lifecycle 
    socket.on('connect', (): void => {
        console.debug('socket connected', socket!.id);
    });

    socket.on('connect_error', (err: unknown): void => {
        console.warn('socket connect_error', err);
        EventBus.emit('error', { code: 0, message: 'Failed to connect' });
    });


    // -----------------------------------------------------------
    // Server → Client Event Forwarding
    // -----------------------------------------------------------

    // Core Synchronization / Snapshots 
    socket.on('snapshot', (snapshot: ServerSnapshot): void => {
        EventBus.emit('snapshot', snapshot);
    });

    socket.on('ack', (ack): void => {
        EventBus.emit('ack', ack);
    });

    socket.on('usernameSet', (evt: UsernameSetEvent): void => {
        EventBus.emit('username-set', evt);
    });

    // Lobby Management 
    socket.on('lobbyUpdate', (lu: LobbyUpdate): void => {
        EventBus.emit('lobby-update', lu);
    });

    // Errors 
    socket.on('error', (err): void => {
        EventBus.emit('error', err);
    });

    // Turn / Game State Updates
    socket.on('turnStart', (evt: TurnStartEvent): void => {
        EventBus.emit('turn-start', evt);
    });

    socket.on('turnResolved', (res: TurnResolvedEvent): void => {
        EventBus.emit('turn-resolved', res);
    });

    socket.on('gameState', (gs: GameStateTurn): void => {
        EventBus.emit('game-state', gs);
    });

    // Minigame Group Events 
    socket.on('groupMinigameStart', (gms: GroupMinigameStartEvent): void => {
        EventBus.emit('group-minigame-start', gms);
    });

    socket.on('groupMinigameResolved', (gmr: GroupMinigameResolvedEvent): void => {
        EventBus.emit('group-minigame-resolved', gmr);
    });


    // -----------------------------------------------------------
    // Moderation & Lobby Control Notices
    // -----------------------------------------------------------

    socket.on('playerKicked', (n: PlayerKickedNotice): void => {
        EventBus.emit('player-kicked', n as any);
    });

    socket.on('lobbyDisbanded', (n: LobbyDisbandedNotice): void => {
        EventBus.emit('lobby-disbanded', n as any);
    });


    // -----------------------------------------------------------
    // Player Presence & Reconnect
    // -----------------------------------------------------------

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


// -----------------------------------------------------------
// Client → Server Emit Helpers
// -----------------------------------------------------------

function ensureSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!socket) throw new Error('socket not initialized — call initSocket() first');
    return socket;
}

// Lobby & Player Identity
export function sendSetUsername(payload: SetUsernameEvent): void {
  ensureSocket().emit('setUsername', payload);
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

// Lobby Moderation
export function sendKickPlayer(payload: KickPlayerEvent): void {
    ensureSocket().emit('kickPlayer', payload);
}

export function sendDisbandLobby(payload: DisbandLobbyEvent): void {
    ensureSocket().emit('disbandLobby', payload);
}

// Game Flow 
export function sendStartGame(payload: StartGameEvent): void {
    ensureSocket().emit('startGame', payload);
}

export function sendNextTurn(payload: NextTurnEvent): void {
    ensureSocket().emit('nextTurn', payload);
}

// Player Actions 
export function sendChooseWeapon(payload: ChooseWeaponEvent): void {
    ensureSocket().emit('chooseWeapon', payload);
}

export function sendMinigameResult(payload: MinigameResultEvent): void {
    ensureSocket().emit('minigameResult', payload);
}

export function sendGroupMinigameResult(payload: GroupMinigameResultEvent): void {
    ensureSocket().emit('groupMinigameResult', payload);
}

// Reconnect & Presence
export function sendReconnectRequest(payload: ReconnectRequest): void {
    ensureSocket().emit('reconnectRequest', payload);
}


// -----------------------------------------------------------
// Accessors / Cleanup
// -----------------------------------------------------------

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

export function getPlayerId(): PlayerId {
    return playerId;
}
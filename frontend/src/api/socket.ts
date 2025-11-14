// frontend/src/api/socket.ts
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
  MinigameStartEvent,
  PlayerId,
  PlayerKickedNotice,
  LobbyDisbandedNotice,
} from 'shared/types';

// -----------------------------------------
// Backend URL (env override -> same host:3000)
// -----------------------------------------
const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ??
  `${window.location.protocol}//${window.location.hostname}:3000`;

// Single socket + identity
let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
const playerId: PlayerId = getOrCreatePlayerId();

// Small helper to forward to EventBus
const emitBus = (type: string, payload?: any) =>
  (EventBus as any).emit(type, payload);

// -----------------------------------------------------------
// Socket initialization
// -----------------------------------------------------------
export function initSocket(token?: string) {
  if (socket) return socket;

  const raw = io(BACKEND_URL, {
    auth: { token },
    transports: ['websocket'],
    path: '/socket.io',
    withCredentials: false,
  });

  socket = raw as unknown as Socket<ServerToClientEvents, ClientToServerEvents>;

  // Connection lifecycle
  socket.on('connect', (): void => {
    console.debug('socket connected', socket!.id);

    // Bootstrap association on the server (real username will be sent by EnterUsername scene)
    const payload: SetUsernameEvent = { playerId, playerName: playerId };
    (socket as any).emit('setUsername', payload);
  });

  socket.on('connect_error', (err: unknown): void => {
    console.warn('socket connect_error', err);
    emitBus('error', { code: 0, message: 'Failed to connect' });
  });

  // -----------------------------------------------------------
  // Server → Client forwards
  // -----------------------------------------------------------
  // Core / snapshots
  socket.on('snapshot', (snapshot: ServerSnapshot): void => {
    emitBus('snapshot', snapshot);
  });

  socket.on('ack', (ack: unknown): void => {
    emitBus('ack', ack);
  });

  socket.on('usernameSet', (evt: UsernameSetEvent): void => {
    emitBus('username-set', evt);
  });

  // Lobby management
  socket.on('lobbyUpdate', (lu: LobbyUpdate): void => {
    emitBus('lobby-update', lu);
  });

  // Errors
  socket.on('error', (err: unknown): void => {
    emitBus('error', err);
  });

  // Turn / game-state
  socket.on('turnStart', (evt: TurnStartEvent): void => {
    emitBus('turn-start', evt);
  });

  socket.on('turnResolved', (res: TurnResolvedEvent): void => {
    emitBus('turn-resolved', res);
  });

  socket.on('gameState', (gs: GameStateTurn): void => {
    emitBus('game-state', gs);
  });

  // Minigames
  socket.on('minigameStart', (ms: MinigameStartEvent): void => {
      EventBus.emit('minigame-start', ms);
  });

  // Group minigames
  socket.on('groupMinigameStart', (gms: GroupMinigameStartEvent): void => {
    emitBus('group-minigame-start', gms);
  });

  socket.on('groupMinigameResolved', (gmr: GroupMinigameResolvedEvent): void => {
    emitBus('group-minigame-resolved', gmr);
  });

  // Moderation / notices
  socket.on('playerKicked', (n: PlayerKickedNotice): void => {
    emitBus('player-kicked', n as any);
  });

  socket.on('lobbyDisbanded', (n: LobbyDisbandedNotice): void => {
    emitBus('lobby-disbanded', n as any);
  });

  // Presence / reconnect
  socket.on('playerDisconnected', (pd: PlayerDisconnectedEvent): void => {
    emitBus('player-disconnected', pd);
  });

  socket.on('playerReconnected', (pr: PlayerReconnectedEvent): void => {
    emitBus('player-reconnected', pr);
  });

  socket.on('reconnectResponse', (rr: ReconnectResponse): void => {
    emitBus('reconnect-response', rr);
  });

  socket.on('resumeTurn', (r: ResumeTurnEvent): void => {
    emitBus('resume-turn', r);
  });

  // ====== Quick-match (no lobby) ======
  // New camelCase events
  (socket as any).on('directMatchFound', (payload: any): void => {
    emitBus('direct-match-found', payload);
  });
  (socket as any).on('directState', (payload: any): void => {
    emitBus('direct-state', payload);
  });
  (socket as any).on('directAttack', (payload: any): void => {
    emitBus('direct-attack', payload);
  });

  // Legacy direct:* events (compat)
  (socket as any).on('direct:found', (payload: any): void => {
    emitBus('direct-match-found', payload);
  });
  (socket as any).on('direct:state', (payload: any): void => {
    emitBus('direct-state', payload);
  });
  (socket as any).on('direct:attack', (payload: any): void => {
    emitBus('direct-attack', payload);
  });
  (socket as any).on('direct:error', (payload: any): void => {
    emitBus('error', payload);
  });

  return socket;
}

// -----------------------------------------------------------
// Client → Server helpers
// -----------------------------------------------------------
function ensureSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) throw new Error('socket not initialized — call initSocket() first');
  return socket;
}

// Lobby & identity
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

// Lobby moderation
export function sendKickPlayer(payload: KickPlayerEvent): void {
  ensureSocket().emit('kickPlayer', payload);
}
export function sendDisbandLobby(payload: DisbandLobbyEvent): void {
  ensureSocket().emit('disbandLobby', payload);
}

// Game flow
export function sendStartGame(payload: StartGameEvent): void {
  ensureSocket().emit('startGame', payload);
}
export function sendNextTurn(payload: NextTurnEvent): void {
  ensureSocket().emit('nextTurn', payload);
}

// Player actions
export function sendChooseWeapon(payload: ChooseWeaponEvent): void {
  ensureSocket().emit('chooseWeapon', payload);
}
export function sendMinigameResult(payload: MinigameResultEvent): void {
  ensureSocket().emit('minigameResult', payload);
}
export function sendGroupMinigameResult(payload: GroupMinigameResultEvent): void {
  ensureSocket().emit('groupMinigameResult', payload);
}

// Reconnect & presence
export function sendReconnectRequest(payload: ReconnectRequest): void {
  ensureSocket().emit('reconnectRequest', payload);
}

// ====== Quick-match helpers (no lobby) ======
export function sendDirectQueue(payload: { playerId: PlayerId }): void {
  (ensureSocket() as any).emit('directQueue', payload);
}
export function sendDirectReady(matchId: string): void {
  (ensureSocket() as any).emit('directReady', { matchId, playerId });
}
export function sendDirectAttack(matchId: string, weaponKey: string): void {
  (ensureSocket() as any).emit('directAttack', { matchId, playerId, weaponKey });
}
// Legacy helpers (compat)
export function sendDirectHost(matchId: string, username: string): void {
  (ensureSocket() as any).emit('direct:host', { matchId, playerId, username });
}
export function sendDirectJoin(matchId: string, username: string): void {
  (ensureSocket() as any).emit('direct:join', { matchId, playerId, username });
}

// -----------------------------------------------------------
// Accessors / cleanup
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

// frontend/src/api/socket.ts
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import EventBus from '../game/EventBus';
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
  ReconnectRequest,
  PlayerDisconnectedEvent,
  PlayerReconnectedEvent,
  ReconnectResponse,
  ResumeTurnEvent,
  StartGameEvent,
  NextTurnEvent,
  PlayerId,
} from 'shared/types';

// -----------------------------------------
// multtiplayer — resolve backend URL
// Will use .env VITE_BACKEND_URL, else fallback to current host:3000
// -----------------------------------------
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL /**  */
  ?? `${window.location.protocol}//${window.location.hostname}:3000`; /**  */

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

/** multiplayer: safe playerId generator for non-HTTPS LAN */
// MINIMAL CHANGE #1: persist a stable playerId in localStorage
function makePlayerId(): PlayerId {
  const KEY = 'ww_player_id';
  const existing = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  if (existing) return existing as PlayerId;

  const g = (globalThis as any)?.crypto;
  const id: PlayerId = (g && typeof g.randomUUID === 'function')
    ? g.randomUUID()
    : ('pid-' + Array.from({ length: 4 }, () => Math.random().toString(16).slice(2)).join(''));

  try { localStorage.setItem(KEY, id); } catch {}
  return id;
}
/**  */
const playerId: PlayerId = makePlayerId();

export function initSocket(token?: string) {
  if (socket) return socket;

  // -----------------------------------------
  // Multiplayer — connect to backend URL instead of '/'
  // Explicit websocket transport & socket.io path
  // -----------------------------------------
  const raw = io(BACKEND_URL, {
    /**  */
    auth: { token },
    transports: ['websocket'],
    path: '/socket.io',
    withCredentials: false,
  });

  socket = raw as unknown as Socket<ServerToClientEvents, ClientToServerEvents>;

  socket.on('connect', (): void => {
    console.debug('socket connected', socket!.id);
    // MINIMAL CHANGE #2: immediately identify this socket to the server
    // (server maps playerId -> socket and routes direct attacks)
    try {
      (socket as any).emit('setUsername', { playerId, username: playerId } as SetUsernameEvent);
    } catch {}
  });

  socket.on('connect_error', (err: unknown): void => {
    console.warn('socket connect_error', err);
    EventBus.emit('error', { code: 0, message: 'Failed to connect' });
  });

  // ----- server -> client pass-throughs already used by teammates -----
  socket.on('snapshot', (snapshot: ServerSnapshot): void => {
    EventBus.emit('snapshot', snapshot);
  });

  socket.on('ack', (ack): void => {
    EventBus.emit('ack', ack);
  });

  socket.on('usernameSet', (evt: UsernameSetEvent): void => {
    EventBus.emit('username-set', evt);
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

  // ====== Multiplayer — quick-match (no lobby) ======
  socket.on('directMatchFound', (payload: any): void => {
    /**  */
    EventBus.emit('direct-match-found', payload);
  });
  socket.on('directState', (payload: any): void => {
    /**  */
    EventBus.emit('direct-state', payload);
  });
  socket.on('directAttack', (payload: any): void => {
    /**  */
    EventBus.emit('direct-attack', payload);
  });

  // legacy `direct:*` (compat)
  socket.on('direct:found', (payload: any): void => {
    /**  (compat) */
    EventBus.emit('direct-match-found', payload);
  });
  socket.on('direct:state', (payload: any): void => {
    /**  (compat) */
    EventBus.emit('direct-state', payload);
  });
  socket.on('direct:attack', (payload: any): void => {
    /** (compat) */
    EventBus.emit('direct-attack', payload);
  });
  socket.on('direct:error', (payload: any): void => {
    /**  (compat) */
    EventBus.emit('error', payload);
  });

  return socket;
}

// ---------- client -> server helpers (teammates' events kept) ----------
function ensureSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) throw new Error('socket not initialized — call initSocket() first');
  return socket;
}

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

export function sendStartGame(payload: StartGameEvent): void {
  ensureSocket().emit('startGame', payload);
}

export function sendNextTurn(payload: NextTurnEvent): void {
  ensureSocket().emit('nextTurn', payload);
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

export function getPlayerId(): PlayerId {
  return playerId;
}

// ====== Multiplayer — quick-match helpers (no lobby) ======
export function sendDirectQueue(payload: { playerId: PlayerId }): void {
  /**  */
  ensureSocket().emit('directQueue', payload);
}
export function sendDirectReady(matchId: string): void {
  /**  */
  ensureSocket().emit('directReady', { matchId, playerId } as any);
}
export function sendDirectAttack(matchId: string, weaponKey: string): void {
  /**  */
  ensureSocket().emit('directAttack', { matchId, playerId, weaponKey } as any);
}

// Optional (legacy helpers if someone still calls them)
export function sendDirectHost(matchId: string, username: string): void {
  /**  (compat) */
  ensureSocket().emit('direct:host', { matchId, playerId, username } as any);
}
export function sendDirectJoin(matchId: string, username: string): void {
  /**  (compat) */
  ensureSocket().emit('direct:join', { matchId, playerId, username } as any);
}

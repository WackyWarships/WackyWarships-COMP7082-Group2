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
// backend URL (env override -> same host:3000)
// -----------------------------------------
const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ??
  `${window.location.protocol}//${window.location.hostname}:3000`;

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

// helper: allow emitting bus events that aren't in the typed Events map
const emitBus = (type: string, payload?: any) =>
  (EventBus as any).emit(type, payload);

// ---------- player id ----------
function makePlayerId(): PlayerId {
  const KEY = 'ww_player_id';
  const existing = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  if (existing) return existing as PlayerId;

  const g = (globalThis as any)?.crypto;
  const id: PlayerId =
    g && typeof g.randomUUID === 'function'
      ? g.randomUUID()
      : ('pid-' + Array.from({ length: 4 }, () => Math.random().toString(16).slice(2)).join(''));

  try { localStorage.setItem(KEY, id); } catch {}
  return id;
}
const playerId: PlayerId = makePlayerId();

export function initSocket(token?: string) {
  if (socket) return socket;

  const raw = io(BACKEND_URL, {
    auth: { token },
    transports: ['websocket'],
    path: '/socket.io',
    withCredentials: false,
  });

  socket = raw as unknown as Socket<ServerToClientEvents, ClientToServerEvents>;

  socket.on('connect', (): void => {
    console.debug('socket connected', socket!.id);
    // IMPORTANT: SetUsernameEvent expects playerName (not username)
    const payload: SetUsernameEvent = { playerId, playerName: playerId };
    (socket as any).emit('setUsername', payload);
  });

  socket.on('connect_error', (err: unknown): void => {
    console.warn('socket connect_error', err);
    emitBus('error', { code: 0, message: 'Failed to connect' });
  });

  // ----- server -> client pass-throughs -----
  socket.on('snapshot', (snapshot: ServerSnapshot): void => {
    emitBus('snapshot', snapshot);
  });

  socket.on('ack', (ack: unknown): void => {
    emitBus('ack', ack);
  });

  socket.on('usernameSet', (evt: UsernameSetEvent): void => {
    emitBus('username-set', evt);
  });

  socket.on('lobbyUpdate', (lu: LobbyUpdate): void => {
    emitBus('lobby-update', lu);
  });

  socket.on('error', (err: unknown): void => {
    emitBus('error', err);
  });

  socket.on('turnStart', (evt: TurnStartEvent): void => {
    emitBus('turn-start', evt);
  });

  socket.on('turnResolved', (res: TurnResolvedEvent): void => {
    emitBus('turn-resolved', res);
  });

  socket.on('gameState', (gs: GameStateTurn): void => {
    emitBus('game-state', gs);
  });

  socket.on('groupMinigameStart', (gms: GroupMinigameStartEvent): void => {
    emitBus('group-minigame-start', gms);
  });

  socket.on('groupMinigameResolved', (gmr: GroupMinigameResolvedEvent): void => {
    emitBus('group-minigame-resolved', gmr);
  });

  // Presence/Reconnect
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
  // These event names are not in ServerToClientEvents — cast the on() for them.
  (socket as any).on('directMatchFound', (payload: any): void => {
    emitBus('direct-match-found', payload);
  });
  (socket as any).on('directState', (payload: any): void => {
    emitBus('direct-state', payload);
  });
  (socket as any).on('directAttack', (payload: any): void => {
    emitBus('direct-attack', payload);
  });

  // legacy `direct:*` (compat)
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

// ---------- client -> server helpers ----------
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

// ====== Quick-match helpers (no lobby) ======
export function sendDirectQueue(payload: { playerId: PlayerId }): void {
  ensureSocket().emit('directQueue', payload as any);
}
export function sendDirectReady(matchId: string): void {
  ensureSocket().emit('directReady', { matchId, playerId } as any);
}
export function sendDirectAttack(matchId: string, weaponKey: string): void {
  ensureSocket().emit('directAttack', { matchId, playerId, weaponKey } as any);
}

// legacy helpers
export function sendDirectHost(matchId: string, username: string): void {
  ensureSocket().emit('direct:host', { matchId, playerId, username } as any);
}
export function sendDirectJoin(matchId: string, username: string): void {
  ensureSocket().emit('direct:join', { matchId, playerId, username } as any);
}

// IDs & helpers ------------------------------------------------------------
export type Timestamp = number;
export type Seq = number;

export type WeaponId = string;
export type TurnId = string;
export type PlayerId = string;
export type LobbyId = string;
export type ProtocolVersion = string;

// Weapon -------------------------------------------------------------------
export type WeaponDef = {
    id: WeaponId;
    name: string;
    baseDamage: number;
    minigameType: 'timing' | 'pattern' | 'puzzle'; // This will possibly be changed
    params?: Record<string, any>;
    description?: string;
    // Stuff to maybe add: minigameDifficulty
};

// Client -> Server ---------------------------------------------------------
export type CreateLobbyEvent = {
    hostName: string;
    lobbyName: string;
    settings?: Record<string, any>;
    client?: { version?: string; platform?: string };
};

export type JoinLobbyEvent = {
    lobbyId: LobbyId;
    name?: string;
    client?: { version?: string; platform?: string };
};

export type LeaveLobbyEvent = {
    lobbyId: LobbyId;
    playerId?: PlayerId;
};

export type ChooseWeaponEvent = {
    turnId: TurnId;
    playerId: PlayerId;
    weaponId: WeaponId;
    meta?: Record<string, any>;
};

export type MinigameInputCompact = [number, string, number?]; // [dtMs, actionCode, optValue]

export type MinigameResultEvent = {
    turnId: TurnId;
    playerId: PlayerId;
    outcome: 'success' | 'failure';
    score?: number;
    durationMs?: number;
    inputLog?: MinigameInputCompact[];
    clientHash?: string;
    meta?: Record<string, any>;
};

export type GroupMinigameResultEvent = {
    lobbyId: LobbyId;
    playerId: PlayerId;
    score?: number;
    inputLog?: MinigameInputCompact[];
    clientHash?: string;
    meta?: Record<string, any>;
};

// Server -> Client ---------------------------------------------------------
export type PlayerState = { 
    id: PlayerId; 
    hp: number; 
    alive: boolean; 
    name?: string 
};

export type TurnStartEvent = {
    turnId: TurnId;
    playerId: PlayerId;
    validWeapons: WeaponId[];
    seed?: string | number;
    minigameParams?: Record<string, any>;
    timeLimitMs?: number;
};

export type TurnResolvedEvent = {
    turnId: TurnId;
    attackerId: PlayerId;
    defenderId: PlayerId;
    weaponId: WeaponId;
    outcome: 'success' | 'failure';
    damage: number;
    defenderHp: number;
    events?: Array<{ type: string; payload?: any }>;
    meta?: Record<string, any>;
};

export type GroupMinigameResolvedEvent = {
    lobbyId: LobbyId;
    winnerId?: PlayerId;
    placements?: Array<{ playerId: PlayerId; rank: number; score?: number }>;
    rewards?: Array<{ playerId: PlayerId; reward: string }>;
    meta?: Record<string, any>;
};

export type GameStateTurn = {
    currentTurnId?: TurnId;
    currentPlayer?: PlayerId;
    players: Record<PlayerId, { hp: number; alive: boolean; name?: string }>;
    meta?: { round?: number; roundState?: string; timeLeftMs?: number };
};

export type Snapshot = {
    t: Timestamp;
    seq: number;
    players: Record<string, PlayerState>;
    events?: Array<{ type: string; payload?: any }>;
    meta?: { round?: number; roundState?: string; timeLeftMs?: number };
};

export type LobbyUpdate = {
    lobbyId: LobbyId;
    players: Array<{ id: PlayerId; name?: string }>;
    hostId?: PlayerId;
    settings?: Record<string, any>;
};

// Group minigame start -----------------------------------------------------
export type GroupParticipant = {
    playerId: PlayerId;
    name?: string;
    role?: 'player' | 'spectator';
    params?: Record<string, any>;
};

export type GroupMinigameStartEvent = {
    lobbyId: LobbyId;
    minigameId?: string;
    seed?: string | number;
    participants: GroupParticipant[];
    participantCount?: number;
    minigameParams?: Record<string, any>;
    timeLimitMs?: number;
    expectedDurationMs?: number;
    meta?: Record<string, any>;
};

// Presence & reconnect ----------------------------------------------------
export type SessionId = string;

export type ReconnectRequest = {
    lobbyId: LobbyId;
    playerId: PlayerId;
    sessionId?: SessionId;
    lastKnownTurnId?: TurnId;
    lastKnownSeq?: Seq;
};

export type PlayerDisconnectedEvent = {
    lobbyId: LobbyId;
    playerId: PlayerId;
    sessionId?: SessionId;
    reason?: 'network' | 'kicked' | 'timeout' | 'left' | string;
    disconnectedAt?: Timestamp;
    expectedResumeWindowMs?: number;
};

export type PlayerReconnectedEvent = {
    lobbyId: LobbyId;
    playerId: PlayerId;
    sessionId?: SessionId;
    resumedAt?: Timestamp;
    resumedDuring?: 'turn' | 'group-minigame' | 'idle' | null;
};

export type ReconnectResponse = {
    ok: boolean;
    reason?: string;
    serverTime?: Timestamp;
    gameState?: GameStateTurn;
    currentTurn?: TurnStartEvent | null;
    pendingResolved?: TurnResolvedEvent[];
    savedInputLog?: MinigameInputCompact[] | null;
    resumeWindowMs?: number | null;
};

export type ResumeTurnEvent = {
    turnId: TurnId;
    playerId: PlayerId;
    seed?: string | number;
    remainingMs?: number;
    savedInputLog?: MinigameInputCompact[];
};

// Convenience ---------------------------------------------------------------
export type ClientInput = MinigameResultEvent | GroupMinigameResultEvent | ChooseWeaponEvent;
export type ServerSnapshot = Snapshot;

// Socket.IO event maps -----------------------------------------------------
export type ServerToClientEvents = {
    snapshot: (snapshot: ServerSnapshot) => void;
    ack: (ack: { seq: Seq }) => void;
    lobbyUpdate: (lu: LobbyUpdate) => void;
    error: (err: { code: number; message: string }) => void;

    turnStart: (evt: TurnStartEvent) => void;
    turnResolved: (res: TurnResolvedEvent) => void;
    gameState: (gs: GameStateTurn) => void;

    groupMinigameStart: (g: GroupMinigameStartEvent) => void;
    groupMinigameResolved: (g: GroupMinigameResolvedEvent) => void;

    playerDisconnected: (pd: PlayerDisconnectedEvent) => void;
    playerReconnected: (pr: PlayerReconnectedEvent) => void;
    reconnectResponse: (rr: ReconnectResponse) => void;
    resumeTurn: (r: ResumeTurnEvent) => void;
};

export type ClientToServerEvents = {
    createLobby: (payload: CreateLobbyEvent) => void;
    joinLobby: (payload: JoinLobbyEvent) => void;
    leaveLobby: (payload: LeaveLobbyEvent) => void;

    chooseWeapon: (payload: ChooseWeaponEvent) => void;
    minigameResult: (payload: MinigameResultEvent) => void;
    groupMinigameResult: (payload: GroupMinigameResultEvent) => void;
    reconnectRequest: (payload: ReconnectRequest) => void;
};

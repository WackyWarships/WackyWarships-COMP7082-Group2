// shared/types.ts

// IDs & helpers ------------------------------------------------------------
export type Timestamp = number;
export type Seq = number;

export type WeaponId = string;
export type TurnId = number;
export type PlayerId = string;
export type LobbyId = string;
export type ProtocolVersion = string;


// Id + name
export type HostInfo = {
    hostId: PlayerId;
    hostName: string;
};

export type PlayerInfo = {
    playerId: PlayerId;
    playerName: string;
};

// Weapon -------------------------------------------------------------------
export type WeaponDef = {
    id: WeaponId;
    name: string;
    baseDamage: number;
    minigameType: 'timing' | 'pattern' | 'puzzle';
    params?: Record<string, any>;
    description?: string;
};

// Lobby
export type Lobby = {
    host: HostInfo;
    lobbyId: LobbyId;
    lobbyName: string;
    settings?: Record<string, any>;
    players: PlayerInfo[];
}

// Client -> Server ---------------------------------------------------------
export type SetUsernameEvent = {
    playerId: PlayerId;
    playerName: string;
};

export type CreateLobbyEvent = {
    hostName: string;
    hostId: PlayerId;
    lobbyName: string;
    settings?: Record<string, any>;
    client?: { version?: string; platform?: string };
};

export type JoinLobbyEvent = {
    lobbyId: LobbyId;
    playerId: PlayerId;
    playerName: string;
    client?: { version?: string; platform?: string };
};

export type LeaveLobbyEvent = {
    lobbyId: LobbyId;
    playerId: PlayerId;
    playerName: string;
};

// Host moderation ----------------------------------------------------------
export type KickPlayerEvent = {
    lobbyId: LobbyId;
    targetPlayerId: PlayerId;
    reason?: string;
};

export type DisbandLobbyEvent = {
    lobbyId: LobbyId;
    reason?: string;
};

export type StartGameEvent = {
    lobbyId: LobbyId;
};

export type NextTurnEvent = {
    lobbyId: LobbyId;
    turnId: TurnId;
    currentPlayer: PlayerId;
};

// On your turn ------------------------------------------------------------

export type ChooseWeaponEvent = {
    lobbyId: LobbyId;
    turnId: TurnId;
    playerId: PlayerId;
    targetPlayerId: PlayerId;
    weaponId: WeaponId;
    meta?: Record<string, any>;
};

export type MinigameInputCompact = [number, string, number?];

export type MinigameResultEvent = {
    lobbyId: LobbyId;
    turnId: TurnId;
    playerId: PlayerId;
    targetPlayerId: PlayerId;

    // === widened outcome union for minigame integration ==========
    // - 'failure' kept for backward compat
    // - 'timeout' / 'blocked' used by Fuel Sort integration
    outcome: 'success' | 'failure' | 'timeout' | 'blocked';

    // === added for Fuel Sort damage wiring =======================
    weaponId: WeaponId;
    damage?: number;

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
export type UsernameSetEvent = {
    playerId: PlayerId;
    playerName: string;
    restored?: boolean;
};

export type PlayerState = {
    id: PlayerId;
    hp: number;
    alive: boolean;
    name?: string;
};

export type TurnStartEvent = {
    turnId: TurnId;
    playerId: PlayerId;
    validWeapons?: WeaponId[];
    seed?: string | number;
    minigameParams?: Record<string, any>;
    timeLimitMs?: number;
};

export type TurnResolvedEvent = {
    turnId: TurnId;
    attackerId: PlayerId;
    defenderId: PlayerId;
    damage: number;
    defenderHp?: number;
    weaponId?: WeaponId;              //handy
    outcome?: 'success' | 'failure';  //for UI / logs
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
    lobbyName: string;
    host: HostInfo;
    players: PlayerInfo[];
    settings?: Record<string, any>;
};

export type MinigameStartEvent = {
    lobbyId: LobbyId;
    attackerId: PlayerId;
    defenderId: PlayerId;
    weaponId: WeaponId;
    seed?: string | number;
    minigameParams?: Record<string, any>;
    timeLimitMs?: number;
    expectedDurationMs?: number;
    meta?: Record<string, any>;
};

// Moderation notifications -------------------------------------------------
export type PlayerKickedNotice = {
    lobbyId: LobbyId;
    targetPlayerId: PlayerId;
    by: PlayerId;
    reason?: string;
};

export type LobbyDisbandedNotice = {
    lobbyId: LobbyId;
    reason?: string;
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

// Presence & reconnect -----------------------------------------------------
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

// Convenience --------------------------------------------------------------
export type ClientInput = MinigameResultEvent | GroupMinigameResultEvent | ChooseWeaponEvent;
export type ServerSnapshot = Snapshot;

// ===== Multiplayer: Direct-match additions (types only) ===================
export type MatchId = string;

export type DirectQueueEvent = { playerId: PlayerId };
export type DirectMatchFoundEvent = {
    matchId: MatchId;
    players: PlayerId[];
    starter: PlayerId;
};
export type DirectReadyEvent = { matchId: MatchId; playerId: PlayerId };
export type DirectAttackEvent = { matchId: MatchId; playerId: PlayerId; weaponKey: string };
export type DirectStateEvent = { matchId: MatchId; ok: boolean };

// Socket.IO event maps -----------------------------------------------------
export type ServerToClientEvents = {
    usernameSet: (payload: UsernameSetEvent) => void;

    snapshot: (snapshot: ServerSnapshot) => void;
    ack: (ack: { seq: Seq }) => void;
    lobbyUpdate: (lu: LobbyUpdate) => void;
    error: (err: { code: number; message: string }) => void;

    turnStart: (evt: TurnStartEvent) => void;
    turnResolved: (res: TurnResolvedEvent) => void;
    gameState: (gs: GameStateTurn) => void;

    minigameStart: (g: MinigameStartEvent) => void;
    groupMinigameStart: (g: GroupMinigameStartEvent) => void;
    groupMinigameResolved: (g: GroupMinigameResolvedEvent) => void;

    // Moderation
    playerKicked: (n: PlayerKickedNotice) => void;
    lobbyDisbanded: (n: LobbyDisbandedNotice) => void;

    playerDisconnected: (pd: PlayerDisconnectedEvent) => void;
    playerReconnected: (pr: PlayerReconnectedEvent) => void;
    reconnectResponse: (rr: ReconnectResponse) => void;
    resumeTurn: (r: ResumeTurnEvent) => void;

    directMatchFound: (e: DirectMatchFoundEvent) => void;
    directAttack: (e: DirectAttackEvent) => void;
    directState: (e: DirectStateEvent) => void;
};

export type ClientToServerEvents = {
    setUsername: (payload: SetUsernameEvent) => void;

    createLobby: (payload: CreateLobbyEvent) => void;
    joinLobby: (payload: JoinLobbyEvent) => void;
    leaveLobby: (payload: LeaveLobbyEvent) => void;

    // Moderation
    kickPlayer: (payload: KickPlayerEvent) => void;
    disbandLobby: (payload: DisbandLobbyEvent) => void;

    startGame: (payload: StartGameEvent) => void;
    nextTurn: (payload: NextTurnEvent) => void;
    chooseWeapon: (payload: ChooseWeaponEvent) => void;
    minigameResult: (payload: MinigameResultEvent) => void;
    groupMinigameResult: (payload: GroupMinigameResultEvent) => void;
    reconnectRequest: (payload: ReconnectRequest) => void;

    directQueue: (e: DirectQueueEvent) => void;
    directReady: (e: DirectReadyEvent) => void;
    directAttack: (e: DirectAttackEvent) => void;
};

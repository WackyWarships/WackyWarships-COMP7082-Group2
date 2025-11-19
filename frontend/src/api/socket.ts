// frontend/src/api/socket.ts

import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import EventBus from "../game/EventBus";
import {
    getOrCreatePlayerId,
    getStoredPlayerName,
} from "../game/utils/playerUsername";
import {
    getLastSession,
    saveSession,
    clearSession,
} from "../game/utils/playerSession";

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
    DirectMatchFoundEvent,
    DirectAttackEvent,
    DirectStateEvent,
    GameEndedEvent,
    MinigameResultOutcome,
} from "shared/types";

// -----------------------------------------
// Backend URL (env override -> same host:3000)
// -----------------------------------------
const BACKEND_URL =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    `${window.location.protocol}//${window.location.hostname}:3000`;

// -----------------------------------------------------------
// Single socket + identity
// -----------------------------------------------------------
let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
const playerId: PlayerId = getOrCreatePlayerId();

// EventBus wrapper
type EventBusLike = {
    emit: (type: string, payload?: unknown) => void;
};
const eventBus: EventBusLike = EventBus as unknown as EventBusLike;

// Small helper to forward to EventBus
const emitBus = (type: string, payload?: unknown) => {
    eventBus.emit(type, payload);
};

// -----------------------------------------------------------
// Socket initialization
// -----------------------------------------------------------
export function initSocket(token?: string) {
    if (socket) return socket;

    const raw = io(BACKEND_URL, {
        auth: { token },
        transports: ["websocket"],
        path: "/socket.io",
        withCredentials: false,
    });

    socket = raw as unknown as Socket<
        ServerToClientEvents,
        ClientToServerEvents
    >;

    // -----------------------------------------------------------
    // Connection lifecycle
    // -----------------------------------------------------------
    socket.on("connect", (): void => {
        console.debug("[Socket] Connected:", socket!.id);

        const playerName =
            getStoredPlayerName() || `Player-${playerId.slice(0, 5)}`;
        const lastSession = getLastSession();

        if (lastSession?.lobbyId) {
            const reconnectPayload: ReconnectRequest = {
                lobbyId: lastSession.lobbyId,
                playerId,
                lastKnownTurnId: lastSession.lastKnownTurnId,
                lastKnownSeq: lastSession.lastKnownSeq,
            };

            console.debug(
                `[Socket] Attempting reconnect to lobby ${lastSession.lobbyId} as ${playerName}`
            );
            socket!.emit("reconnectRequest", reconnectPayload);

            const namePayload: SetUsernameEvent = { playerId, playerName };
            socket!.emit("setUsername", namePayload);
        } else {
            const payload: SetUsernameEvent = { playerId, playerName };
            socket!.emit("setUsername", payload);
        }
    });

    socket.on("connect_error", (err: unknown): void => {
        console.warn("socket connect_error", err);
        emitBus("error", { code: 0, message: "Failed to connect" });
    });

    // -----------------------------------------------------------
    // Server → Client forwards
    // -----------------------------------------------------------

    socket.on("gameEnded", (evt: GameEndedEvent): void => {
        emitBus("game-ended", evt);
    });

    // Core / snapshots
    socket.on("snapshot", (snapshot: ServerSnapshot): void => {
        emitBus("snapshot", snapshot);
    });

    socket.on("ack", (ack: { seq: number }): void => {
        emitBus("ack", ack);
    });

    socket.on("usernameSet", (evt: UsernameSetEvent): void => {
        emitBus("username-set", evt);
    });

    // Lobby management
    socket.on("lobbyUpdate", (lu: LobbyUpdate): void => {
        emitBus("lobby-update", lu);

        saveSession({
            lobbyId: lu.lobbyId,
            scene: "Lobby",
            timestamp: Date.now(),
        });
    });

    // Errors
    socket.on("error", (err: { code: number; message: string }): void => {
        emitBus("error", err);
    });

    // Turn / game-state
    socket.on("turnStart", (evt: TurnStartEvent): void => {
        emitBus("turn-start", evt);
    });

    socket.on("turnResolved", (res: TurnResolvedEvent): void => {
        emitBus("turn-resolved", res);
    });

    socket.on("gameState", (gs: GameStateTurn): void => {
        emitBus("game-state", gs);
    });

    // =======================================================
    // Fuel Sort / weapon minigame wiring
    // - backend emits "minigameStart"
    // - Game.ts listens on EventBus "minigame-start"
    // =======================================================
    socket.on("minigameStart", (ms: MinigameStartEvent): void => {
        emitBus("minigame-start", ms);
    });

    // Group minigames
    socket.on("groupMinigameStart", (gms: GroupMinigameStartEvent): void => {
        emitBus("group-minigame-start", gms);
    });

    socket.on(
        "groupMinigameResolved",
        (gmr: GroupMinigameResolvedEvent): void => {
            emitBus("group-minigame-resolved", gmr);
        }
    );

    // Moderation / notices
    socket.on("playerKicked", (n: PlayerKickedNotice): void => {
        emitBus("player-kicked", n);
    });

    socket.on("lobbyDisbanded", (n: LobbyDisbandedNotice): void => {
        emitBus("lobby-disbanded", n as any);
        clearSession();
    });

    // Presence / reconnect
    socket.on("playerDisconnected", (pd: PlayerDisconnectedEvent): void => {
        emitBus("player-disconnected", pd);
    });

    socket.on("playerReconnected", (pr: PlayerReconnectedEvent): void => {
        emitBus("player-reconnected", pr);
    });

    socket.on("reconnectResponse", (rr: ReconnectResponse): void => {
        emitBus("reconnect-response", rr);
    });

    socket.on("resumeTurn", (r: ResumeTurnEvent): void => {
        emitBus("resume-turn", r);
    });

    // ====== Quick-match (no lobby) ======
    // New camelCase events
    socket.on("directMatchFound", (payload: DirectMatchFoundEvent): void => {
        emitBus("direct-match-found", payload);
    });

    socket.on("directState", (payload: DirectStateEvent): void => {
        emitBus("direct-state", payload);
    });

    socket.on("directAttack", (payload: DirectAttackEvent): void => {
        emitBus("direct-attack", payload);
    });

    // Legacy direct:* events (compat)
    socket.on("direct:found", (payload: DirectMatchFoundEvent): void => {
        emitBus("direct-match-found", payload);
    });
    socket.on("direct:state", (payload: DirectStateEvent): void => {
        emitBus("direct-state", payload);
    });
    socket.on("direct:attack", (payload: DirectAttackEvent): void => {
        emitBus("direct-attack", payload);
    });
    socket.on(
        "direct:error",
        (
            payload: { code?: number; message?: string } | string | unknown
        ): void => {
            emitBus("error", payload);
        }
    );

    return socket;
}

// -----------------------------------------------------------
// Client → Server helpers
// -----------------------------------------------------------
function ensureSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!socket)
        throw new Error("socket not initialized — call initSocket() first");
    return socket;
}

// ----- Player leaves an active game -----
export function sendPlayerExitGame(payload: {
    lobbyId: string;
    playerId: PlayerId;
}): void {
    ensureSocket().emit("playerExitGame", payload);
}

// Lobby & identity
export function sendSetUsername(payload: SetUsernameEvent): void {
    ensureSocket().emit("setUsername", payload);
}

export function sendCreateLobby(payload: CreateLobbyEvent): void {
    ensureSocket().emit("createLobby", payload);
}

export function sendJoinLobby(payload: JoinLobbyEvent): void {
    ensureSocket().emit("joinLobby", payload);
    saveSession({ lobbyId: payload.lobbyId, scene: "Lobby" });
}

export function sendLeaveLobby(payload: LeaveLobbyEvent): void {
    ensureSocket().emit("leaveLobby", payload);
    clearSession();
}

// Lobby moderation
export function sendKickPlayer(payload: KickPlayerEvent): void {
    ensureSocket().emit("kickPlayer", payload);
}

export function sendDisbandLobby(payload: DisbandLobbyEvent): void {
    ensureSocket().emit("disbandLobby", payload);
}

// Game flow
export function sendStartGame(payload: StartGameEvent): void {
    ensureSocket().emit("startGame", payload);
}

export function sendNextTurn(payload: NextTurnEvent): void {
    ensureSocket().emit("nextTurn", payload);
}

// Player actions
export function sendChooseWeapon(payload: ChooseWeaponEvent): void {
    ensureSocket().emit("chooseWeapon", payload);
}

// =======================================================
// Fuel Sort minigame result → backend
// =======================================================
export function sendMinigameResult(payload: MinigameResultEvent): void {
    ensureSocket().emit("minigameResult", payload);
}

export function sendGroupMinigameResult(
    payload: GroupMinigameResultEvent
): void {
    ensureSocket().emit("groupMinigameResult", payload);
}

// Reconnect & presence
export function sendReconnectRequest(payload: ReconnectRequest): void {
    ensureSocket().emit("reconnectRequest", payload);
}

// ====== Quick-match helpers (no lobby) ======
export function sendDirectQueue(payload: { playerId: PlayerId }): void {
    ensureSocket().emit("directQueue", payload);
}

export function sendDirectReady(matchId: string): void {
    ensureSocket().emit("directReady", { matchId, playerId });
}
export function sendDirectAttack(
    matchId: string,
    weaponKey: string,
    outcome?: MinigameResultOutcome,
    score?: number
): void {
    ensureSocket().emit("directAttack", {
        matchId,
        playerId,
        weaponKey,
        outcome,
        score,
    });
}
export function sendDirectExitGame(matchId: string): void {
    ensureSocket().emit("directExitGame", { matchId });
}
// Legacy helpers (compat)
export function sendDirectHost(matchId: string, username: string): void {
    ensureSocket().emit("direct:host", { matchId, playerId, username });
}

export function sendDirectJoin(matchId: string, username: string): void {
    ensureSocket().emit("direct:join", { matchId, playerId, username });
}

// -----------------------------------------------------------
// Accessors / cleanup
// -----------------------------------------------------------
export function getSocket(): Socket<
    ServerToClientEvents,
    ClientToServerEvents
> | null {
    return socket;
}

export function closeSocket(): void {
    if (!socket) return;
    try {
        socket.close();
    } catch (e) {
        console.error("Error closing socket:", e);
    }
    socket = null;
}

export function getPlayerId(): PlayerId {
    return playerId;
}

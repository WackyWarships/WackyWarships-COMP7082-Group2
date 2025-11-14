import mitt from 'mitt';
import type Phaser from 'phaser';
import type {
    ServerSnapshot,
    LobbyUpdate,
    TurnStartEvent,
    TurnResolvedEvent,
    GameStateTurn,
    MinigameResultEvent,
    GroupMinigameStartEvent,
    GroupMinigameResolvedEvent,
    PlayerKickedNotice,
    LobbyDisbandedNotice,
    PlayerDisconnectedEvent,
    PlayerReconnectedEvent,
    ReconnectResponse,
    MinigameStartEvent,
    ResumeTurnEvent,
    SetUsernameEvent
} from 'shared/types';

export type Events = {
    // Player identified (id and username in server?)
    'username-set': SetUsernameEvent;

    // Scene lifecycle
    'current-scene-ready': Phaser.Scene;

    // Network
    'snapshot': ServerSnapshot;
    'lobby-update': LobbyUpdate;
    'ack': { seq: number };
    'error' : { code: number; message: string } | any;

    // Turn-based
    'turn-start': TurnStartEvent;
    'turn-resolved': TurnResolvedEvent;
    'game-state': GameStateTurn;

    // Minigame (local aliases/acks)
    'minigame-start': MinigameStartEvent;
    'minigame-result-sent': MinigameResultEvent;

    // Group
    'group-minigame-start': GroupMinigameStartEvent;
    'group-minigame-resolved': GroupMinigameResolvedEvent;

    // Moderation
    'player-kicked': PlayerKickedNotice;
    'lobby-disbanded': LobbyDisbandedNotice;

    // Presence / reconnect
    'player-disconnected': PlayerDisconnectedEvent;
    'player-reconnected': PlayerReconnectedEvent;
    'reconnect-response': ReconnectResponse;
    'resume-turn': ResumeTurnEvent;
};

// The emitter
const EventBus = mitt<Events>();

// ---- Typed helpers (optional but nice to have) ----
export function emit<K extends keyof Events>(type: K, payload: Events[K]) {
    EventBus.emit(type, payload);
}

export function on<K extends keyof Events>(
    type: K,
    handler: (ev: Events[K]) => void
): () => void {
    EventBus.on(type, handler);
    // Return an unsubscribe function for convenience
    return () => off(type, handler);
}

export function off<K extends keyof Events>(
    type: K,
    handler: (ev: Events[K]) => void
) {
    EventBus.off(type, handler);
}

export { EventBus };
export default EventBus;

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
    PlayerDisconnectedEvent,
    PlayerReconnectedEvent,
    ReconnectResponse,
    ResumeTurnEvent,
} from '../api/types';

export type Events = {
    'current-scene-ready': Phaser.Scene;

    // Network
    'snapshot': ServerSnapshot;
    'lobby-update': LobbyUpdate;
    'ack': { seq: number };
    'error': { code: number; message: string } | any;

    // Turn-based
    'turn-start': TurnStartEvent;
    'turn-resolved': TurnResolvedEvent;
    'game-state': GameStateTurn;

    // Minigame (local aliases/acks)
    'minigame-start': TurnStartEvent;
    'minigame-result-sent': MinigameResultEvent;

    // Group
    'group-minigame-start': GroupMinigameStartEvent;
    'group-minigame-resolved': GroupMinigameResolvedEvent;

    // Presence/reconnect
    'player-disconnected': PlayerDisconnectedEvent;
    'player-reconnected': PlayerReconnectedEvent;
    'reconnect-response': ReconnectResponse;
    'resume-turn': ResumeTurnEvent;
};

const EventBus = mitt<Events>();
export default EventBus;

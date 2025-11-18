// src/game/DirectMinigameManager.ts
// ================================================
// === DIRECT (QUICK MATCH) MINIGAME INTEGRATION ===
// Fuel Sort overlay + directAttack bridge
// ================================================

import Phaser from 'phaser';
import EventBus from './EventBus';
import { sendDirectAttack } from '../api/socket';
import type {
    FuelSortCompleteEvent,
    MinigameResultOutcome,
} from 'shared/types';
import type { MinigameDifficultyId } from './MinigameManager';

export interface LaunchDirectFuelSortOptions {
    matchId: string;
    weaponId: string;                  // 'W1', 'W2', 'W3'
    difficultyId: MinigameDifficultyId;
    onComplete?: () => void;          // allow Game.ts to clear cooldown, etc.
}

export class DirectMinigameManager {
    private scene: Phaser.Scene;
    private active = false;
    private currentHandler?: (payload: FuelSortCompleteEvent) => void;

    constructor(hostScene: Phaser.Scene) {
        this.scene = hostScene;
    }

    /**
     * Launch Fuel Sort as an overlay for DIRECT multiplayer.
     * When it finishes, we send directAttack with outcome + score.
     */
    public launchFuelSort(opts: LaunchDirectFuelSortOptions): void {
        if (this.active) {
            // avoid overlapping minigames
            return;
        }
        this.active = true;

        // Start Fuel Sort overlay – in direct mode we do NOT need lobbyId/turnId
        this.scene.scene.launch('FuelSortGame', {
            difficulty: opts.difficultyId,
            asOverlay: true,
        });

        this.scene.scene.bringToTop('FuelSortGame');

        this.attachCompletionListener(opts);
    }

    /**
     * Force-close the current overlay (e.g. when Game scene is cleaned up).
     */
    public forceCloseCurrent(): void {
        if (!this.active) return;
        this.active = false;

        if (this.currentHandler) {
            EventBus.off('fuel-sort-complete', this.currentHandler);
            this.currentHandler = undefined;
        }

        try {
            this.scene.scene.stop('FuelSortGame');
        } catch (err) {
            console.warn('DirectMinigameManager.forceCloseCurrent: stop failed', err);
        }
    }

    // --------------------------------------------
    // internal: listen for Fuel Sort completion
    // (direct controller only)
    // --------------------------------------------
    private attachCompletionListener(opts: LaunchDirectFuelSortOptions) {
        const handler = (payload: FuelSortCompleteEvent) => {
            // In direct mode, FuelSortScene emits:
            // { lobbyId?: undefined, turnId?: undefined, success, score }

            EventBus.off('fuel-sort-complete', handler);
            this.currentHandler = undefined;
            this.active = false;

            // Close the overlay, keep battle scene visible
            try {
                this.scene.scene.stop('FuelSortGame');
            } catch (err) {
                console.warn('DirectMinigameManager: stop FuelSortGame failed', err);
            }

            const outcome: MinigameResultOutcome = payload.success
                ? 'success'
                : 'failure';

            const score = payload.score ?? 0;

            // Bridge to backend: directAttack with outcome+score.
            // sendDirectAttack already knows playerId on the client side.
            sendDirectAttack(opts.matchId, opts.weaponId, outcome, score);

            // Let Game.ts clear cooldown, etc.
            if (opts.onComplete) {
                opts.onComplete();
            }
        };

        this.currentHandler = handler;
        EventBus.on('fuel-sort-complete', handler);
    }
}

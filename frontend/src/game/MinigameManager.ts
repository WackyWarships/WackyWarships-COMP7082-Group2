// src/game/MinigameManager.ts
// ================================================
// === MULTIPLAYER MINIGAME INTEGRATION ===
// Fuel Sort overlay + damage calculation bridge
// ================================================

import Phaser from 'phaser';
import EventBus from './EventBus';
import { sendMinigameResult } from '../api/socket';

// Keep this in sync with MinigameResultEvent["outcome"]
export type MinigameResultOutcome = 'success' | 'failure';

/**
 * Difficulty IDs that exist in difficulty-config.json
 * (easy, medium, hard).
 */
export type MinigameDifficultyId = 'easy' | 'medium' | 'hard';

/**
 * Who this client is for a given minigame.
 */
export type MinigameRole = 'controller' | 'spectator';

export interface LaunchFuelSortOptions {
    lobbyId: string;
    turnId: number;
    attackerId: string;
    defenderId: string;
    weaponId: string;          //'W1', 'W2', 'W3'
    baseDamage: number;        // 10 / 40  / 80
    difficultyId: MinigameDifficultyId;
    role: MinigameRole;        // 'controller' -> plays; 'spectator' -> just watches
}

/**
 * Result that MinigameManager will produce locally once the
 * Fuel Sort minigame finishes.
 */
export interface LocalMinigameResult {
    success: boolean;
    outcome: MinigameResultOutcome;
    score: number | null;
}

export class MinigameManager {
    private scene: Phaser.Scene;
    private active: boolean = false;

    constructor(hostScene: Phaser.Scene) {
        this.scene = hostScene;
    }

    /**
     * Map a weapon base damage (10, 40, 80) to a difficulty id
     * that exists in difficulty-config.json.
     *
     * 10  -> easy
     * 40  -> medium
     * 80  -> hard
     */
    public static difficultyForDamage(dmg: number): MinigameDifficultyId {
        if (dmg <= 10) return 'easy';   // 10
        if (dmg <= 40) return 'medium'; // 40
        return 'hard';                  // 80
    }

    /**
     * Compute the damage for a given outcome.
     * - success  => full baseDamage
     * - failure* => half (rounded down)
     *
     * (* includes any non-success case the backend might add later)
     */
    public static damageFromOutcome(
        baseDamage: number,
        outcome: MinigameResultOutcome
    ): number {
        if (outcome === 'success') {
            return baseDamage; // 10 / 40 / 80
        }

        // Any non-success (failure / blocked / timeout) -> flat 5
        return 5;
    }

    /**
     * Launch the Fuel Sort scene as an overlay.
     */
    public launchFuelSort(opts: LaunchFuelSortOptions): void {
        if (this.active) {
            // prevent overlapping minigames; this should not normally happen
            return;
        }

        this.active = true;

        // Start FuelSort as an overlay
        this.scene.scene.launch('FuelSortGame', {
            difficulty: opts.difficultyId,
            asOverlay: true,
            controllerId: opts.attackerId,
            lobbyId: opts.lobbyId,
            turnId: opts.turnId,
            weaponId: opts.weaponId,
            role: opts.role,
        });

        this.scene.scene.bringToTop('FuelSortGame');

        if (opts.role === 'spectator') {
            // 🔹 Spectator does NOT listen for local "fuel-sort-complete"
            //     (they never solve the puzzle themselves).
            //     Game.ts will forcibly close the overlay on TurnResolved.
            return;
        }

        // Controller: this client plays and sends minigameResult
        this.attachCompletionListener(opts, /* sendResult */ true);
    }

    // --------------------------------------------
    // Called from Game.ts when the server says the
    // turn is resolved (for both attacker & defender).
    // Ensures the overlay is closed everywhere.
    // --------------------------------------------
    public forceCloseCurrent(): void {
        if (!this.active) return;
        this.active = false;
        try {
            this.scene.scene.stop('FuelSortGame');
        } catch (err) {
            console.warn('MinigameManager.forceCloseCurrent: stop failed', err);
        }
    }

    // --------------------------------------------
    // internal: listen for Fuel Sort completion
    // (controller only)
    // --------------------------------------------
    private attachCompletionListener(
        opts: LaunchFuelSortOptions,
        sendResult: boolean
    ) {
        // FuelSortScene will emit:
        // EventBus.emit('fuel-sort-complete', { lobbyId, turnId, success, score });

        const handler = (payload: {
            lobbyId: string;
            turnId: number;
            success: boolean;
            score?: number;
        }) => {
            if (payload.lobbyId !== opts.lobbyId || payload.turnId !== opts.turnId) {
                return; // not our minigame
            }

            (EventBus as any).off('fuel-sort-complete', handler as any);
            this.active = false;

            // Stop the overlay scene; the main Game scene stays visible
            this.scene.scene.stop('FuelSortGame');

            const outcome: MinigameResultOutcome = payload.success
                ? 'success'
                : 'failure';

            const local: LocalMinigameResult = {
                success: payload.success,
                outcome,
                score: payload.score ?? null,
            };

            if (sendResult) {
                this.sendResultToServer(opts, local);
            }
        };

        (EventBus as any).on('fuel-sort-complete', handler as any);
    }

    // --------------------------------------------
    // internal: send result to backend
    // --------------------------------------------
    private sendResultToServer(
        opts: LaunchFuelSortOptions,
        local: LocalMinigameResult
    ) {
        // Match Game.ts rules:
        // - success:  W1 → 10, W2 → 40, W3 → 80
        // - failure: always 5
        let damage: number;
        if (local.outcome !== 'success') {
            damage = 5;
        } else {
            switch (opts.weaponId) {
                case 'W1':
                    damage = 10;
                    break;
                case 'W2':
                    damage = 40;
                    break;
                case 'W3':
                    damage = 80;
                    break;
                default:
                    damage = opts.baseDamage ?? 10;
                    break;
            }
        }

        // Note: MinigameResultEvent in shared/types doesn't have weaponId/damage yet;
        // those are harmless extra fields at runtime, but you can extend the type too.
        const payload: {
            lobbyId: string;
            turnId: number;
            playerId: string;
            targetPlayerId: string;
            outcome: MinigameResultOutcome;
            score: number;
            weaponId?: string;
            damage?: number;
        } = {
            lobbyId: opts.lobbyId,
            turnId: opts.turnId,
            playerId: opts.attackerId,
            targetPlayerId: opts.defenderId,
            outcome: local.outcome,
            score: local.score ?? 0,
            weaponId: opts.weaponId,
            damage,
        };

        sendMinigameResult(payload as any);

    }
}

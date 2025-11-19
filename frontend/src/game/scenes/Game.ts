// src/game/scenes/Game.ts
import Phaser from "phaser";
import EventBus from "../EventBus";
import {
    getCenter,
    getResponsiveFontSize,
    resizeSceneBase,
} from "../utils/layout";
import {
    getPlayerId,
    sendDirectReady,
    sendDirectAttack,
    sendChooseWeapon,
    sendNextTurn,
    sendPlayerExitGame,
    sendDirectExitGame,
} from "../../api/socket";
import { saveSession } from "../utils/playerSession";

// === MINIGAME INTEGRATION ===
import {
    MinigameManager,
    MinigameRole,
    MinigameDifficultyId,
} from "../MinigameManager";
import { DirectMinigameManager } from "../DirectMinigameManager";

// -------------------------------------
// small helpers / types
// -------------------------------------
type HPBar = {
    width: number;
    height: number;
    set: (pct: number) => void;
    setPosition: (nx: number, ny: number) => void;
};
type Weapon = { key: string; color: number; dmg: number; speed: number };

// pick “the other” player for 2-player lobbies if a players list is provided
function pickOpponentId(allIds: string[], me: string): string | undefined {
    return allIds.find((id) => id !== me);
}

// Sprite keys (adjust if needed)
const ENEMY_SPRITES = {
    normal: "blueship",
    damaged: "blueship_dmg",
    critical: "blueship_crit",
};
const PLAYER_SPRITES = {
    normal: "redship",
    damaged: "redship_dmg",
    critical: "redship_crit",
};

export class Game extends Phaser.Scene {
    public camera!: Phaser.Cameras.Scene2D.Camera;
    public background!: Phaser.GameObjects.Image;

    // ----- local battle state -----
    private playerHPMax = 100;
    private enemyHPMax = 100;
    private playerHP = this.playerHPMax;
    private enemyHP = this.enemyHPMax;

    private weapons: Weapon[] = [
        // Easy
        { key: "W1", color: 0x6ec1ff, dmg: 10, speed: 900 },
        // Medium
        { key: "W2", color: 0x8be27e, dmg: 40, speed: 900 },
        // Hard
        { key: "W3", color: 0xf6b26b, dmg: 80, speed: 900 },
    ];
    private currentWeaponIndex = 0;

    private coolingDown = false;
    private cooldownMs = 350;

    private shotsFired = 0;
    private totalDamage = 0;

    // turn UI/bookkeeping
    private isPlayerTurn = true;
    private turnNumber = 1;
    private enemyTurnTimer?: Phaser.Time.TimerEvent;

    // UI refs
    private enemyHPBar!: HPBar;
    private playerHPBar!: HPBar;

    // Ships can be Image or Rectangle (fallback)
    private enemy!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    private player!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

    private homeBtn!: Phaser.GameObjects.Container;
    private attackBtn!: Phaser.GameObjects.Text;

    private weaponNodes: {
        circle: Phaser.GameObjects.Arc;
        ring: Phaser.GameObjects.Arc;
        chip: Phaser.GameObjects.Arc;
    }[] = [];
    private weaponRelayout?: () => void;

    // Modern UI
    private turnBadgeText!: Phaser.GameObjects.Text;
    private turnBadgeGlass!: Phaser.GameObjects.Rectangle;
    private turnLabelText!: Phaser.GameObjects.Text;
    private turnLabelGlass!: Phaser.GameObjects.Rectangle;

    // HP numbers
    private enemyHPText!: Phaser.GameObjects.Text;
    private playerHPText!: Phaser.GameObjects.Text;

    // ====== networking modes ======
    private netMode: "local" | "direct" | "lobby" = "local";

    // direct (quick-match)
    private matchId?: string;
    private offAttack?: () => void;
    private offState?: () => void;
    private seenAttackIds = new Set<string>();

    // lobby
    private lobbyId?: string;
    private turnId = 0;
    private starterId?: string; // who starts the game (server decides)
    private opponentId?: string; // optional: derived if players list passed in

    // identity
    private meId: string = getPlayerId();

    // de-dupe: ensure we only process each server turn once on this client
    private resolvedTurnIds = new Set<number>();

    // explosion config
    private readonly EXPLOSION_MS = 1000;

    // === MINIGAME MANAGERS ===
    private minigameManager?: MinigameManager; // lobby
    private directMinigameManager?: DirectMinigameManager; // direct

    // Spectator overlay when opponent is playing a minigame
    private opponentMinigameOverlay?: Phaser.GameObjects.Container;

    constructor() {
        super("Game");
    }

    // -------------------------------------
    // lifecycle / init
    // -------------------------------------
    init(data: any) {
        // --- compatibility shim: accept legacy flat payloads from Lobby ---
        if (!data?.net && (data?.lobbyId || data?.starterId || data?.turnId)) {
            data = {
                net: {
                    mode: "lobby",
                    lobbyId: data.lobbyId,
                    starterId: data.starterId,
                    turnId: data.turnId ?? 0,
                    players: data.players,
                },
            };
        }
        // ------------------------------------------------------------------

        // direct (no lobby)
        if (data?.net?.mode === "direct") {
            this.netMode = "direct";
            this.matchId = data.net.matchId;
            this.starterId = data.net.starter;
            this.turnId = 0;
        }

        // lobby
        if (data?.net?.mode === "lobby") {
            this.netMode = "lobby";
            this.lobbyId = data.net.lobbyId;
            this.starterId = data.net.starterId; // whose turn the server announced first
            this.turnId = data.net.turnId ?? 0;

            // if Lobby scene passes players, we can pick an opponent id now
            if (Array.isArray(data?.net?.players)) {
                const ids: string[] = data.net.players.map(
                    (p: any) => p.playerId
                );
                this.opponentId = pickOpponentId(ids, this.meId);
            }
        }

        this.resetState();
    }

    private resetState() {
        this.playerHPMax = 100;
        this.enemyHPMax = 100;
        this.playerHP = this.playerHPMax;
        this.enemyHP = this.enemyHPMax;

        this.currentWeaponIndex = 0;
        this.coolingDown = false;
        this.shotsFired = 0;
        this.totalDamage = 0;

        const iStart = this.starterId ? this.starterId === this.meId : true;
        this.isPlayerTurn = iStart;
        this.turnNumber = 1;

        this.enemyTurnTimer?.remove();
        this.enemyTurnTimer = undefined;

        this.seenAttackIds.clear();
        this.resolvedTurnIds.clear();
    }

    // -------------------------------------
    // tiny utilities
    // -------------------------------------
    private textureExists(key: string) {
        return this.textures && this.textures.exists(key);
    }

    private sizeShipByHeight(
        img: Phaser.GameObjects.Image,
        screenH: number,
        percentH: number
    ) {
        const baseH = img.height || 1;
        const targetH = screenH * percentH;
        img.setScale(targetH / baseH);
    }

    private makeHPBar(
        x: number,
        y: number,
        width: number,
        height: number,
        fillColor: number
    ): HPBar {
        const bg = this.add
            .rectangle(x, y, width, height, 0x000000, 0.45)
            .setOrigin(0.5);
        bg.setStrokeStyle(2, 0xffffff, 0.65);
        const fill = this.add
            .rectangle(x - width / 2, y, width, height, fillColor)
            .setOrigin(0, 0.5);
        return {
            width,
            height,
            set: (pct: number) => {
                fill.width = Phaser.Math.Clamp(pct, 0, 1) * width;
            },
            setPosition: (nx: number, ny: number) => {
                bg.setPosition(nx, ny);
                fill.setPosition(nx - width / 2, ny);
            },
        };
    }

    private flyBullet(opts: {
        fromX: number;
        fromY: number;
        toY: number;
        color: number;
        duration: number;
        onImpact?: () => void;
    }) {
        const b = this.add
            .circle(opts.fromX, opts.fromY, 6, opts.color)
            .setDepth(50);
        this.tweens.add({
            targets: b,
            y: opts.toY,
            duration: opts.duration,
            onComplete: () => {
                b.destroy();
                opts.onImpact && opts.onImpact();
            },
        });
    }

    private buildWeaponUI() {
        const { width: W, height: H } = this.scale;
        const count = this.weapons.length;
        const r = 24;
        const gap = 14;
        const pad = 20;
        const x = W - (pad + r);
        const yBottom = H - (pad + r);

        this.weaponNodes.forEach((n) => {
            n.circle.destroy();
            n.ring.destroy();
            n.chip.destroy();
        });
        this.weaponNodes = [];

        for (let i = 0; i < count; i++) {
            const y = yBottom - i * (r * 2 + gap);

            const circle = this.add
                .circle(x, y, r, 0x0d1a2b, 0.35)
                .setStrokeStyle(2, 0x88aaff, 0.9)
                .setDepth(200)
                .setInteractive({ useHandCursor: true })
                .on("pointerdown", (p: Phaser.Input.Pointer) => {
                    p.event?.stopPropagation();
                    this.selectWeapon(i);
                });

            const ring = this.add
                .circle(x, y, r + 3, 0x000000, 0)
                .setStrokeStyle(4, 0xffffff, 1)
                .setDepth(201)
                .setVisible(false);

            const chip = this.add
                .circle(x, y, 8, this.weapons[i].color)
                .setDepth(202);

            this.weaponNodes.push({ circle, ring, chip });
        }

        this.currentWeaponIndex = 0;
        this.refreshWeaponHighlight();

        this.weaponRelayout = () => {
            const { width: W2, height: H2 } = this.scale;
            const X = W2 - (pad + r);
            const YB = H2 - (pad + r);
            this.weaponNodes.forEach((n, i) => {
                const ny = YB - i * (r * 2 + gap);
                n.circle.setPosition(X, ny);
                n.ring.setPosition(X, ny);
                n.chip.setPosition(X, ny);
            });
        };
    }

    // Map any weapon to canonical damage 10,40,80
    private damageForWeapon(weaponKeyOrId: string): number {
        const byKey: Record<string, number> = {
            W1: 10,
            w1: 10,
            W2: 40,
            w2: 40,
            W3: 80,
            w3: 80,
        };

        if (weaponKeyOrId in byKey) return byKey[weaponKeyOrId];

        const idx = this.weapons.findIndex((w) => w.key === weaponKeyOrId);
        const table = [10, 40, 80];
        if (idx >= 0) return table[Math.min(idx, table.length - 1)];

        const current = this.weapons[this.currentWeaponIndex]?.key;
        const curIdx = this.weapons.findIndex((w) => w.key === current);
        return table[Math.min(Math.max(curIdx, 0), table.length - 1)] || 10;
    }

    private selectWeapon(i: number) {
        this.currentWeaponIndex = i;
        this.refreshWeaponHighlight();
    }

    private refreshWeaponHighlight() {
        this.weaponNodes.forEach((n, i) =>
            n.ring.setVisible(i === this.currentWeaponIndex)
        );
    }

    // ---------- modern UI helpers ----------
    private drawGlass(
        x: number,
        y: number,
        w: number,
        h: number,
        alpha = 0.28
    ) {
        const glass = this.add
            .rectangle(x, y, w, h, 0xffffff, alpha)
            .setOrigin(0.5);
        glass.setStrokeStyle(2, 0xffffff, 0.45);
        return glass;
    }

    private updateHPTexts() {
        if (this.enemyHPText)
            this.enemyHPText.setText(`${this.enemyHP} / ${this.enemyHPMax}`);
        if (this.playerHPText)
            this.playerHPText.setText(`${this.playerHP} / ${this.playerHPMax}`);
    }

    // ---------- new: ship visual state by HP ----------
    private spriteFor(
        hp: number,
        max: number,
        keys: { normal: string; damaged: string; critical: string }
    ) {
        const pct = (hp / max) * 100;
        if (pct < 20) return keys.critical;
        if (pct < 70) return keys.damaged;
        return keys.normal;
    }

    private swapTextureIfAvailable(
        obj: Phaser.GameObjects.GameObject,
        desiredKey: string,
        sizePctH: number
    ) {
        if (!(obj instanceof Phaser.GameObjects.Image)) return; // rectangles fallback -> ignore
        if (!this.textureExists(desiredKey)) return; // missing texture, ignore
        if (obj.texture.key === desiredKey) return; // already set

        obj.setTexture(desiredKey);
        // re-scale to match height percent
        this.sizeShipByHeight(obj, this.scale.height, sizePctH);
    }

    private updateShipVisuals() {
        // Enemy ship visuals
        const enemyKey = this.spriteFor(
            this.enemyHP,
            this.enemyHPMax,
            ENEMY_SPRITES
        );
        this.swapTextureIfAvailable(this.enemy, enemyKey, 0.15);

        // Player ship visuals
        const playerKey = this.spriteFor(
            this.playerHP,
            this.playerHPMax,
            PLAYER_SPRITES
        );
        this.swapTextureIfAvailable(this.player, playerKey, 0.15);
    }

    // ---------- new: explosion effect ----------
    private showExplosion(x: number, y: number) {
        if (this.textureExists("explosion")) {
            // Simple image fade/scale (works whether 'explosion' is a single frame or spritesheet main frame)
            const s = this.add
                .image(x, y, "explosion")
                .setOrigin(0.5)
                .setDepth(300);
            s.setScale(0.1);
            this.tweens.add({
                targets: s,
                duration: this.EXPLOSION_MS,
                alpha: 0,
                scale: 0.2,
                onComplete: () => s.destroy(),
            });
        } else {
            // Fallback: bright flash circle
            const c = this.add.circle(x, y, 20, 0xfff2a8, 1).setDepth(300);
            c.setScale(0.1);
            this.tweens.add({
                targets: c,
                duration: this.EXPLOSION_MS,
                alpha: 0,
                scale: 0.2,
                onComplete: () => c.destroy(),
            });
        }
    }

    // -------------------------------------
    // turn helpers
    // -------------------------------------
    private setAttackEnabled(enabled: boolean) {
        this.attackBtn.setAlpha(enabled ? 1 : 0.4);
        this.attackBtn.removeAllListeners();
        if (enabled) {
            this.attackBtn
                .setInteractive({ useHandCursor: true })
                .once("pointerdown", () => this.doAttack());
        } else {
            this.attackBtn.disableInteractive();
        }
    }
    private startPlayerTurn() {
        this.isPlayerTurn = true;
        this.turnLabelText.setText("YOUR TURN").setColor("#ffffff");
        this.setAttackEnabled(true);
    }
    private startEnemyTurn() {
        this.isPlayerTurn = false;
        this.turnLabelText.setText("ENEMY TURN").setColor("#ff6969");
        this.setAttackEnabled(false);
    }
    private nextTurnBadge() {
        this.turnNumber += 1;
        this.turnBadgeText.setText(`Turn: ${this.turnNumber}`);
    }

    // -------------------------------------
    // Opponent minigame banner (spectator)
    // -------------------------------------
    private showOpponentMinigameBanner() {
        if (this.opponentMinigameOverlay) return;

        const { width: W, height: H } = this.scale;

        const container = this.add.container(0, 0).setDepth(1000);

        const backdrop = this.add
            .rectangle(W / 2, H / 2, W, H, 0x000000, 0.45)
            .setOrigin(0.5);

        const panelW = Math.min(W * 0.7, 520);
        const panelH = Math.min(H * 0.25, 200);

        const panel = this.add
            .rectangle(W / 2, H / 2, panelW, panelH, 0x111522, 0.95)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0xffffff, 0.65);

        const title = this.add
            .text(
                W / 2,
                H / 2 - panelH * 0.2,
                "Opponent is playing Fuel Sort…",
                {
                    fontFamily: "Arial Black",
                    fontSize: "22px",
                    color: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 4,
                }
            )
            .setOrigin(0.5);

        const body = this.add
            .text(
                W / 2,
                H / 2 + panelH * 0.05,
                "Waiting for minigame result…",
                {
                    fontFamily: "Arial",
                    fontSize: "18px",
                    color: "#d0d4ff",
                    align: "center",
                }
            )
            .setOrigin(0.5);

        container.add([backdrop, panel, title, body]);
        this.opponentMinigameOverlay = container;
    }

    private hideOpponentMinigameBanner() {
        if (this.opponentMinigameOverlay) {
            this.opponentMinigameOverlay.destroy(true);
            this.opponentMinigameOverlay = undefined;
        }
    }

    private launchFuelSortForTurn(
        attackerId: string,
        defenderId: string,
        weaponId: string,
        role: MinigameRole
    ) {
        if (!this.lobbyId) return;

        const baseDamage = this.damageForWeapon(weaponId);

        // Explicit difficulty per weapon
        let difficultyId: MinigameDifficultyId;
        switch (weaponId) {
            case "W1":
                difficultyId = "easy";
                break;
            case "W2":
                difficultyId = "medium";
                break;
            case "W3":
                difficultyId = "hard";
                break;
            default:
                difficultyId = MinigameManager.difficultyForDamage(baseDamage);
                break;
        }

        if (role === "controller") {
            if (!this.minigameManager) return;
            this.minigameManager.launchFuelSort({
                lobbyId: this.lobbyId,
                turnId: this.turnId,
                attackerId,
                defenderId,
                weaponId,
                baseDamage,
                difficultyId,
                role,
            });
        } else {
            // Spectator just sees a banner
            this.showOpponentMinigameBanner();
        }
    }

    // -------------------------------------
    // create
    // -------------------------------------
    create() {
        const { width: W, height: H } = this.scale;
        const { x: centerX, y: centerY } = getCenter(this.scale);

        // Save session (for refresh/reconnect)
        if (this.netMode === "lobby" && this.lobbyId) {
            saveSession({
                lobbyId: this.lobbyId,
                scene: "Game",
                timestamp: Date.now(),
                lastKnownTurnId: this.turnId,
            });
        } else if (this.netMode === "direct" && this.matchId) {
            saveSession({
                lobbyId: this.matchId, // treat matchId like a lobby
                scene: "Game",
                timestamp: Date.now(),
            });
        }

        // background
        if (this.textureExists("spacebackground")) {
            this.background = this.add
                .image(centerX, centerY, "spacebackground")
                .setOrigin(0.5)
                .setDisplaySize(H * 0.46, H);
        } else {
            this.cameras.main.setBackgroundColor(0x082a47);
        }

        const pad = 24;
        // FIXED-SIZE HOME BUTTON (never gets stretched again)
        const raw = this.add.image(0, 0, "home").setOrigin(0.5);
        raw.setDisplaySize(32, 32); // fixed size forever

        this.homeBtn = this.add
            .container(pad + 24, pad + 24, [raw])
            .setSize(32, 32)
            .setInteractive({ useHandCursor: true })
            .on("pointerdown", () => {
                if (this.netMode === "lobby" && this.lobbyId) {
                    sendPlayerExitGame({
                        lobbyId: this.lobbyId,
                        playerId: this.meId,
                    });
                } else if (this.netMode === "direct" && this.matchId) {
                    sendDirectExitGame(this.matchId);
                }
                this.scene.start("MainMenu");
            });

        const topY = H * 0.325;
        const bottomY = H * 0.675;

        // enemy (start with appropriate sprite for full HP -> normal)
        const enemyStartKey = this.spriteFor(
            this.enemyHP,
            this.enemyHPMax,
            ENEMY_SPRITES
        );
        if (this.textureExists(enemyStartKey)) {
            const img = this.add
                .image(W / 2, topY, enemyStartKey)
                .setOrigin(0.5);
            this.sizeShipByHeight(img, H, 0.15);
            this.enemy = img;
        } else if (this.textureExists(ENEMY_SPRITES.normal)) {
            const img = this.add
                .image(W / 2, topY, ENEMY_SPRITES.normal)
                .setOrigin(0.5);
            this.sizeShipByHeight(img, H, 0.15);
            this.enemy = img;
        } else {
            this.enemy = this.add
                .rectangle(W / 2, topY, 120, 40, 0xff5555)
                .setOrigin(0.5);
        }

        // player
        const playerStartKey = this.spriteFor(
            this.playerHP,
            this.playerHPMax,
            PLAYER_SPRITES
        );
        if (this.textureExists(playerStartKey)) {
            const img = this.add
                .image(W / 2, bottomY, playerStartKey)
                .setOrigin(0.5);
            this.sizeShipByHeight(img, H, 0.15);
            this.player = img;
        } else if (this.textureExists(PLAYER_SPRITES.normal)) {
            const img = this.add
                .image(W / 2, bottomY, PLAYER_SPRITES.normal)
                .setOrigin(0.5);
            this.sizeShipByHeight(img, H, 0.15);
            this.player = img;
        } else {
            this.player = this.add
                .rectangle(W / 2, bottomY, 120, 40, 0x55ff88)
                .setOrigin(0.5);
        }

        // idle motion
        this.tweens.add({
            targets: this.player,
            y: bottomY - 10,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.inOut",
        });
        this.tweens.add({
            targets: this.enemy,
            y: topY + 10,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.inOut",
        });

        // HP bars
        const barW = 220,
            barH = 16;
        this.enemyHPBar = this.makeHPBar(
            W / 2,
            H * 0.2,
            barW,
            barH,
            0xff3b3b
        );
        this.playerHPBar = this.makeHPBar(
            W / 2,
            H * 0.8,
            barW,
            barH,
            0x27d35a
        );
        this.enemyHPBar.set(1);
        this.playerHPBar.set(1);

        // HP labels
        const hpFont = getResponsiveFontSize(W, H, 18, 14);
        this.enemyHPText = this.add
            .text(W / 2, H * 0.2 - 20, "", {
                fontFamily: "Arial Black",
                fontSize: `${hpFont}px`,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 4,
            })
            .setOrigin(0.5);
        this.playerHPText = this.add
            .text(W / 2, H * 0.8 + 20, "", {
                fontFamily: "Arial Black",
                fontSize: `${hpFont}px`,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 4,
            })
            .setOrigin(0.5);
        this.updateHPTexts();

        // weapon selector
        this.buildWeaponUI();

        // === MINIGAME MANAGERS INIT ===
        this.minigameManager = new MinigameManager(this); // lobby
        this.directMinigameManager = new DirectMinigameManager(this); // direct

        // attack button
        this.attackBtn = this.add
            .text(W - 140, bottomY - 10, "ATTACK", {
                fontFamily: "Arial Black",
                fontSize: "18px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 6,
            })
            .setOrigin(1, 0.5);

        // turn badge + label
        const badgeW = 140,
            badgeH = 40;
        this.turnBadgeGlass = this.drawGlass(
            W / 2,
            H * 0.1,
            badgeW,
            badgeH
        )
        .setOrigin(0.5);
        const badgeFont = getResponsiveFontSize(W, H, 20, 16);
        this.turnBadgeText = this.add
            .text(
                this.turnBadgeGlass.x,
                this.turnBadgeGlass.y,
                `Turn: ${this.turnNumber}`,
                {
                    fontFamily: "Arial Black",
                    fontSize: `${badgeFont}px`,
                    color: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 4,
                }
            )
            .setOrigin(0.5);

        const whoW = 220,
            whoH = 48;
        this.turnLabelGlass = this.drawGlass(W / 2,  H / 2, whoW, whoH, 0.28);
        const whoFont = getResponsiveFontSize(W, H, 26, 20);
        this.turnLabelText = this.add
            .text(this.turnLabelGlass.x, this.turnLabelGlass.y, "YOUR TURN", {
                fontFamily: "Arial Black",
                fontSize: `${whoFont}px`,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 6,
            })
            .setOrigin(0.5);

        // initial turn UI
        if (this.isPlayerTurn) this.startPlayerTurn();
        else this.startEnemyTurn();

        // networking hooks
        if (this.netMode === "direct" && this.matchId) {
            this.wireDirect();
        } else if (this.netMode === "lobby" && this.lobbyId) {
            this.wireLobby();
        } else {
            // local solo test
            this.setAttackEnabled(true);
        }

        // resize / cleanup
        this.scale.on("resize", this.onResize, this);
        EventBus.emit("current-scene-ready", this);

        // === GAME-ENDED (DIRECT) ===
        // Lobby mode already handles this in wireLobby().
        // Here we hook the same event for direct matches.
        const onAnyGameEnded = (evt: {
            lobbyId: string;
            by: string;
            reason: string;
        }) => {
            if (this.netMode !== "direct") return;
            if (!this.matchId) return;
            if (evt.lobbyId !== this.matchId) return;

            // Both players get this via socket.io -> EventBus, so both go home.
            this.scene.start("MainMenu");
        };
        EventBus.on("game-ended", onAnyGameEnded as any);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            EventBus.off("game-ended", onAnyGameEnded as any);
        });

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
        this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
    }

    private cleanup() {
        this.enemyTurnTimer?.remove();
        this.scale.off("resize", this.onResize, this);
        this.attackBtn?.removeAllListeners();
        this.offAttack && this.offAttack();
        this.offState && this.offState();
        this.hideOpponentMinigameBanner();
        this.minigameManager?.forceCloseCurrent();
        this.directMinigameManager?.forceCloseCurrent();
    }

    // -------------------------------------
    // networking: direct (quick-match)
    // -------------------------------------
    private wireDirect() {
        if (this.matchId) sendDirectReady(this.matchId);

        const onDirectAttack = (type: string, payload: any) => {
            if (type !== "direct-attack") return;
            const ev = payload as {
                matchId: string;
                playerId: string;
                weaponKey: string;
                damage?: number;
                attackId?: string;
            };
            if (!ev || ev.matchId !== this.matchId) return;

            if (ev.attackId && this.seenAttackIds.has(ev.attackId)) return;
            if (ev.attackId) this.seenAttackIds.add(ev.attackId);

            const weap =
                this.weapons.find((x) => x.key === ev.weaponKey) ||
                this.weapons[0];

            // Prefer server-authoritative damage; fall back to local table
            const dmg =
                typeof ev.damage === "number"
                    ? ev.damage
                    : this.damageForWeapon(weap.key);

            const { height: H2, width: W2 } = this.scale;
            const topY2 = H2 * 0.2,
                bottomY2 = H2 * 0.8;
            const shotFromTop = ev.playerId !== this.meId;

            this.flyBullet({
                fromX: W2 / 2,
                fromY: shotFromTop ? topY2 + 30 : bottomY2 - 30,
                toY: shotFromTop ? bottomY2 - 20 : topY2 + 20,
                color: weap.color,
                duration: 300,
                onImpact: () => {
                    const impactX = W2 / 2;
                    const impactY = shotFromTop ? bottomY2 - 20 : topY2 + 20;
                    this.showExplosion(impactX, impactY);
                    this.cameras.main.shake(180, 0.006); // 180ms, small amplitude

                    if (shotFromTop) {
                        // Opponent hit ME
                        this.playerHP = Math.max(0, this.playerHP - dmg);
                        this.playerHPBar.set(this.playerHP / this.playerHPMax);
                        this.updateHPTexts();
                        this.updateShipVisuals();
                        if (this.playerHP === 0) {
                            this.endRound(false);
                            return;
                        }
                        this.nextTurnBadge();
                        this.startPlayerTurn();
                    } else {
                        // I hit opponent
                        this.enemyHP = Math.max(0, this.enemyHP - dmg);
                        this.totalDamage += dmg;
                        this.enemyHPBar.set(this.enemyHP / this.enemyHPMax);
                        this.updateHPTexts();
                        this.updateShipVisuals();
                        if (this.enemyHP === 0) {
                            this.endRound(true);
                            return;
                        }
                        this.nextTurnBadge();
                        this.startEnemyTurn();
                    }
                },
            });
        };

        EventBus.on("*", onDirectAttack as any);
        this.offAttack = () => EventBus.off("*", onDirectAttack as any);
    }

    // -------------------------------------
    // networking: lobby
    // -------------------------------------
    private wireLobby() {
        // server → turn start (authoritative)
        const onTurnStart = (evt: { turnId: number; playerId: string }) => {
            this.turnId = evt.turnId;
            const mine = evt.playerId === this.meId;
            if (mine) this.startPlayerTurn();
            else this.startEnemyTurn();
        };

        // server → turn resolved (animate and, if not game over, ask server to rotate turn)
        const onTurnResolved = (res: {
            turnId: number;
            attackerId: string;
            defenderId: string;
            weaponId?: string;
            outcome?: "success" | "failure" | "blocked" | "timeout";
            damage?: number;
        }) => {
            if (this.resolvedTurnIds.has(res.turnId)) return;
            this.resolvedTurnIds.add(res.turnId);

            // Minigame just finished → remove spectator banner if it was shown
            this.hideOpponentMinigameBanner();

            // Try to find the weapon, but it's only used for color and fallback damage
            const weap =
                this.weapons.find((w) => w.key === (res.weaponId ?? "")) ||
                this.weapons[0];

            // --- DAMAGE LOGIC ---
            // Prefer what the server tells us.
            // Backend already does:
            //   success: W1=10, W2=40, W3=80
            //   failure: 5
            let dmg: number;

            if (typeof res.damage === "number" && res.damage > 0) {
                dmg = res.damage;
            } else {
                // Fallback if backend hasn't been updated yet:
                // success -> full base, fail/blocked/timeout -> 5
                const base = this.damageForWeapon(weap.key);
                if (res.outcome && res.outcome !== "success") {
                    dmg = 5;
                } else {
                    dmg = base;
                }
            }

            const { width: W2, height: H2 } = this.scale;
            const topY = H2 * 0.2,
                bottomY = H2 * 0.8;
            const shotFromTop = res.attackerId !== this.meId;

            this.flyBullet({
                fromX: W2 / 2,
                fromY: shotFromTop ? topY + 30 : bottomY - 30,
                toY: shotFromTop ? bottomY - 20 : topY + 20,
                color: weap.color,
                duration: 280,
                onImpact: () => {
                    const impactX = W2 / 2;
                    const impactY = shotFromTop ? bottomY - 20 : topY + 20;
                    this.showExplosion(impactX, impactY);
                    this.cameras.main.shake(180, 0.006);

                    if (res.attackerId === this.meId) {
                        this.enemyHP = Math.max(0, this.enemyHP - dmg);
                        this.totalDamage += dmg;
                        this.shotsFired += 1;
                        this.enemyHPBar.set(this.enemyHP / this.enemyHPMax);
                        this.updateHPTexts();
                        this.updateShipVisuals();
                        if (this.enemyHP === 0) {
                            this.endRound(true);
                            return;
                        }
                        if (this.lobbyId) {
                            sendNextTurn({
                                lobbyId: this.lobbyId,
                                turnId: res.turnId,
                                currentPlayer: res.attackerId,
                            });
                        }
                    } else {
                        this.playerHP = Math.max(0, this.playerHP - dmg);
                        this.playerHPBar.set(this.playerHP / this.playerHPMax);
                        this.updateHPTexts();
                        this.updateShipVisuals();
                        if (this.playerHP === 0) {
                            this.endRound(false);
                            return;
                        }
                    }
                    this.nextTurnBadge();
                },
            });
        };

        // === MINIGAME START ===
        const onMinigameStart = (evt: {
            lobbyId: string;
            attackerId: string;
            defenderId: string;
            weaponId: string;
        }) => {
            if (!this.lobbyId || evt.lobbyId !== this.lobbyId) return;
            if (!this.minigameManager) return;

            const role: MinigameRole =
                evt.attackerId === this.meId ? "controller" : "spectator";

            // Attacker already launches locally in doAttack; we only need
            // the server event for spectators / defender.
            if (role === "controller") {
                return;
            }

            this.launchFuelSortForTurn(
                evt.attackerId,
                evt.defenderId,
                evt.weaponId,
                role
            );
        };

        const onGameEnded = (evt: {
            lobbyId: string;
            by: string;
            reason: string;
        }) => {
            if (!this.lobbyId || evt.lobbyId !== this.lobbyId) return;

            // Go back to main menu on disconnect
            this.scene.start("MainMenu");
        };

        EventBus.on("turn-start", onTurnStart as any);
        EventBus.on("turn-resolved", onTurnResolved as any);
        EventBus.on("minigame-start", onMinigameStart as any);
        EventBus.on("game-ended", onGameEnded as any);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            EventBus.off("turn-start", onTurnStart as any);
            EventBus.off("turn-resolved", onTurnResolved as any);
            EventBus.off("minigame-start", onMinigameStart as any);
            EventBus.off("game-ended", onGameEnded as any);
        });
    }

    // -------------------------------------
    // input → attack
    // -------------------------------------
    private doAttack() {
        // lobby path (authoritative + lobby minigame)
        if (this.netMode === "lobby") {
            if (!this.isPlayerTurn || !this.lobbyId) return;

            const w = this.weapons[this.currentWeaponIndex];

            // defenderId is required by your server payload but not used to compute turns.
            const targetId = this.opponentId ?? "opponent";

            // 1) Tell backend which weapon we chose
            sendChooseWeapon({
                lobbyId: this.lobbyId,
                turnId: this.turnId,
                playerId: this.meId,
                targetPlayerId: targetId,
                weaponId: w.key,
            });

            // 2) Disable attack button while minigame is running
            this.setAttackEnabled(false);

            // 3) Immediately launch Fuel Sort locally for the controller (LOBBY)
            this.launchFuelSortForTurn(
                this.meId,
                targetId,
                w.key,
                "controller"
            );

            // Defender (other client) will start their spectator overlay
            // when the server emits minigameStart.
            return;
        }

        // shared pre-checks for direct/local
        if (!this.isPlayerTurn || this.enemyHP <= 0 || this.playerHP <= 0)
            return;

        const w = this.weapons[this.currentWeaponIndex];
        this.shotsFired++;

        // ---------- DIRECT MODE: use DirectMinigameManager ----------
        if (this.netMode === "direct" && this.matchId) {
            if (this.coolingDown) return;
            this.coolingDown = true;
            this.setAttackEnabled(false);

            // Map weapon to difficulty
            let difficultyId: MinigameDifficultyId;
            switch (w.key) {
                case "W1":
                    difficultyId = "easy";
                    break;
                case "W2":
                    difficultyId = "medium";
                    break;
                case "W3":
                    difficultyId = "hard";
                    break;
                default:
                    difficultyId = "easy";
            }

            if (this.directMinigameManager) {
                this.directMinigameManager.launchFuelSort({
                    matchId: this.matchId,
                    weaponId: w.key,
                    difficultyId,
                    onComplete: () => {
                        // Minigame finished; cooldown is cleared here.
                        this.coolingDown = false;
                    },
                });
            } else {
                // Fallback: no minigame manager -> send a basic "success" attack
                sendDirectAttack(this.matchId, w.key, "success", 0);
                this.coolingDown = false;
            }

            return;
        }

        // ---------- LOCAL OFFLINE ----------
        if (this.coolingDown) return;

        this.coolingDown = true;
        this.time.delayedCall(
            this.cooldownMs,
            () => (this.coolingDown = false)
        );

        const { width: W, height: H } = this.scale;
        const topY = H * 0.2;
        const bottomY = H * 0.8;
        const duration = Phaser.Math.Clamp(1000 * (300 / w.speed), 120, 600);

        this.flyBullet({
            fromX: W / 2,
            fromY: bottomY - 30,
            toY: topY + 20,
            color: w.color,
            duration,
            onImpact: () => {
                const impactX = W / 2;
                const impactY = topY + 20;
                this.showExplosion(impactX, impactY);
                this.cameras.main.shake(180, 0.006); // 180ms, small amplitude

                // purely local damage
                this.enemyHP = Math.max(0, this.enemyHP - w.dmg);
                this.totalDamage += w.dmg;
                this.enemyHPBar.set(this.enemyHP / this.enemyHPMax);
                this.updateHPTexts();
                this.updateShipVisuals();
                if (this.enemyHP === 0) {
                    this.endRound(true);
                    return;
                }
                this.nextTurnBadge();
                this.startEnemyTurn();
            },
        });
    }

    // -------------------------------------
    // resize
    // -------------------------------------
    private onResize(gameSize: Phaser.Structs.Size) {
        const { width: W, height: H } = gameSize;

        resizeSceneBase(this, W, H);

        const pad = 24;
        const topY = H * 0.325;
        const bottomY = H * 0.675;

        if (this.background)
            this.background.setPosition(W / 2, H / 2).setDisplaySize(H * 0.46, H);
        this.homeBtn.setPosition(pad + 24, pad + 24);

        if (this.enemy instanceof Phaser.GameObjects.Image) {
            this.enemy.setPosition(W / 2, topY);
        }

        if (this.player instanceof Phaser.GameObjects.Image) {
            this.player.setPosition(W / 2, bottomY);
        }

        if (this.enemy instanceof Phaser.GameObjects.Image)
            this.sizeShipByHeight(this.enemy, H, 0.15);
        if (this.player instanceof Phaser.GameObjects.Image)
            this.sizeShipByHeight(this.player, H, 0.15);

        this.tweens.killAll();

        // idle motion
        this.tweens.add({
            targets: this.player,
            y: bottomY - 10,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.inOut",
        });
        this.tweens.add({
            targets: this.enemy,
            y: topY + 10,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.inOut",
        });

        this.enemyHPBar?.setPosition(W / 2, H * 0.2);
        this.playerHPBar?.setPosition(W / 2, H * 0.8);

        const hpFont = getResponsiveFontSize(W, H, 18, 14);
        this.enemyHPText
            ?.setFontSize(hpFont)
            .setPosition(W / 2, H * 0.2 - 20);
        this.playerHPText
            ?.setFontSize(hpFont)
            .setPosition(W / 2, H * 0.8 + 20);

        this.weaponRelayout && this.weaponRelayout();
        this.attackBtn?.setPosition(W - 140, bottomY - 10);

        const badgeW = 140,
            badgeH = 40;
        this.turnBadgeGlass
            ?.setPosition(W / 2, H * 0.1)
            .setSize(badgeW, badgeH)
            .setOrigin(0.5);
        const badgeFont = getResponsiveFontSize(W, H, 20, 16);
        this.turnBadgeText
            ?.setFontSize(badgeFont)
            .setPosition(this.turnBadgeGlass.x, this.turnBadgeGlass.y);

        const whoW = 220,
            whoH = 48;
        this.turnLabelGlass?.setPosition(W / 2, H / 2).setSize(whoW, whoH);
        const whoFont = getResponsiveFontSize(W, H, 26, 20);
        this.turnLabelText
            ?.setFontSize(whoFont)
            .setPosition(this.turnLabelGlass.x, this.turnLabelGlass.y);
    }

    // -------------------------------------
    // finish
    // -------------------------------------
    private endRound(playerWon: boolean) {
        this.cleanup();
        this.scene.start("GameOver", {
            result: playerWon ? "VICTORY" : "DEFEAT",
            playerHP: this.playerHP,
            enemyHP: this.enemyHP,
            shots: this.shotsFired,
            damage: this.totalDamage,
        });
    }
}

export default Game;

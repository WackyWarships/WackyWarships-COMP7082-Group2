// src/game/scenes/Game.ts
import Phaser from 'phaser';
import EventBus from '../EventBus';
import {
    getCenter,
    getResponsiveFontSize,
    resizeSceneBase
} from '../utils/layout';

type HPBar = {
    width: number;
    height: number;
    set: (pct: number) => void;
    setPosition: (nx: number, ny: number) => void;
};

type Weapon = { key: string; color: number; dmg: number; speed: number };

export class Game extends Phaser.Scene {
    public camera!: Phaser.Cameras.Scene2D.Camera;
    public background!: Phaser.GameObjects.Image;

    private playerHPMax = 100;
    private enemyHPMax = 100;
    private playerHP = this.playerHPMax;
    private enemyHP = this.enemyHPMax;

    private weapons: Weapon[] = [
        { key: 'W1', color: 0x6ec1ff, dmg: 10, speed: 900 },
        { key: 'W2', color: 0x8be27e, dmg: 30, speed: 900 },
        { key: 'W3', color: 0xf6b26b, dmg: 50, speed: 900 },
        { key: 'W4', color: 0xd96df0, dmg: 80, speed: 900 }
    ];
    private currentWeaponIndex = 0;

    private coolingDown = false;
    private cooldownMs = 350;

    private shotsFired = 0;
    private totalDamage = 0;

    // TEMP turn-based
    private isPlayerTurn = true;
    private turnNumber = 1;
    private enemyTurnTimer?: Phaser.Time.TimerEvent;

    // UI refs
    private enemyHPBar!: HPBar;
    private playerHPBar!: HPBar;

    private enemy!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    private player!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

    private homeBtn!: Phaser.GameObjects.GameObject;
    private attackBtn!: Phaser.GameObjects.Text;

    private weaponNodes: { circle: Phaser.GameObjects.Arc; ring: Phaser.GameObjects.Arc; chip: Phaser.GameObjects.Arc }[] = [];
    private weaponRelayout?: () => void;

    // Modern “glass” UI
    private turnBadgeText!: Phaser.GameObjects.Text;
    private turnBadgeGlass!: Phaser.GameObjects.Rectangle;

    private turnLabelText!: Phaser.GameObjects.Text;
    private turnLabelGlass!: Phaser.GameObjects.Rectangle;

    // HP numbers
    private enemyHPText!: Phaser.GameObjects.Text;
    private playerHPText!: Phaser.GameObjects.Text;

    constructor() {
        super('Game');
    }

    // ---------- lifecycle ----------
    init(): void {
        this.resetState();
    }

    private resetState(): void {
        this.playerHPMax = 100;
        this.enemyHPMax = 100;
        this.playerHP = this.playerHPMax;
        this.enemyHP = this.enemyHPMax;

        this.currentWeaponIndex = 0;
        this.coolingDown = false;
        this.shotsFired = 0;
        this.totalDamage = 0;

        this.isPlayerTurn = true;
        this.turnNumber = 1;

        this.enemyTurnTimer?.remove();
        this.enemyTurnTimer = undefined;
    }

    // ---------- helpers ----------
    private textureExists(key: string) {
        return this.textures && this.textures.exists(key);
    }

    private addSafeImage(
        x: number,
        y: number,
        key: string,
        { w = 64, h = 64, label = key }: { w?: number; h?: number; label?: string } = {}
    ) {
        if (this.textureExists(key)) return this.add.image(x, y, key).setOrigin(0.5);
        const rect = this.add
            .rectangle(x, y, w, h, 0x000000, 0.4)
            .setStrokeStyle(2, 0xffffff, 0.7)
            .setOrigin(0.5);
        this.add
            .text(x, y, (label || key).toUpperCase(), { fontSize: '10px', color: '#fff' })
            .setOrigin(0.5);
        return rect;
    }

    /** Scale ship to a percentage of screen height (keeps sprite aspect). */
    private sizeShipByHeight(img: Phaser.GameObjects.Image, screenH: number, percentH: number) {
        // use the sprite's natural height to compute scale
        const baseH = img.height || 1;
        const targetH = screenH * percentH; // e.g. 0.11 = 11% of screen height
        const s = targetH / baseH;
        img.setScale(s);
    }

    private makeHPBar(x: number, y: number, width: number, height: number, fillColor: number): HPBar {
        const bg = this.add.rectangle(x, y, width, height, 0x000000, 0.45).setOrigin(0.5);
        bg.setStrokeStyle(2, 0xffffff, 0.65);
        const fill = this.add.rectangle(x - width / 2, y, width, height, fillColor).setOrigin(0, 0.5);
        return {
            width,
            height,
            set: (pct: number) => {
                fill.width = Phaser.Math.Clamp(pct, 0, 1) * width;
            },
            setPosition: (nx: number, ny: number) => {
                bg.setPosition(nx, ny);
                fill.setPosition(nx - width / 2, ny);
            }
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
        const b = this.add.circle(opts.fromX, opts.fromY, 6, opts.color).setDepth(50);
        this.tweens.add({
            targets: b,
            y: opts.toY,
            duration: opts.duration,
            onComplete: () => {
                b.destroy();
                opts.onImpact && opts.onImpact();
            }
        });
    }

    private buildWeaponUI() {
        const { width: W, height: H } = this.scale;
        const count = 4;
        const r = 24;
        const gap = 14;
        const pad = 20;
        const x = W - (pad + r);
        const yBottom = H - (pad + r);

        this.weaponNodes.forEach(n => {
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
                .on('pointerdown', (p: Phaser.Input.Pointer) => {
                    p.event?.stopPropagation();
                    this.selectWeapon(i);
                });

            const ring = this.add.circle(x, y, r + 3, 0x000000, 0)
                .setStrokeStyle(4, 0xffffff, 1)
                .setDepth(201)
                .setVisible(false);

            const chip = this.add.circle(x, y, 8, this.weapons[i].color).setDepth(202);

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

    private selectWeapon(i: number) {
        this.currentWeaponIndex = i;
        this.refreshWeaponHighlight();
    }

    private refreshWeaponHighlight() {
        this.weaponNodes.forEach((n, i) => n.ring.setVisible(i === this.currentWeaponIndex));
    }

    // ---------- modern UI helpers ----------
    private drawGlass(x: number, y: number, w: number, h: number, alpha = 0.28) {
        const glass = this.add.rectangle(x, y, w, h, 0xffffff, alpha).setOrigin(0.5);
        glass.setStrokeStyle(2, 0xffffff, 0.45);
        return glass;
    }

    private updateHPTexts() {
        if (this.enemyHPText) this.enemyHPText.setText(`${this.enemyHP} / ${this.enemyHPMax}`);
        if (this.playerHPText) this.playerHPText.setText(`${this.playerHP} / ${this.playerHPMax}`);
    }

    // ---------- temp turn system ----------
    private startPlayerTurn() {
        this.isPlayerTurn = true;
        this.turnLabelText.setText('YOUR TURN').setColor('#ffffff');
        this.setAttackEnabled(true);
    }

    private startEnemyTurn() {
        this.isPlayerTurn = false;
        this.turnLabelText.setText('ENEMY TURN').setColor('#ff6969');
        this.setAttackEnabled(false);

        this.enemyTurnTimer?.remove();
        this.enemyTurnTimer = this.time.delayedCall(700, () => this.doEnemyAttack(), undefined, this);
    }

    private setAttackEnabled(enabled: boolean) {
        this.attackBtn.setAlpha(enabled ? 1 : 0.4);
        this.attackBtn.removeAllListeners();
        if (enabled) {
            this.attackBtn.setInteractive({ useHandCursor: true }).once('pointerdown', () => this.doLocalAttack());
        } else {
            this.attackBtn.disableInteractive();
        }
    }

    private nextTurn() {
        this.turnNumber += 1;
        this.turnBadgeText.setText(`Turn: ${this.turnNumber}`);
    }

    private doEnemyAttack() {
        if (this.playerHP <= 0 || this.enemyHP <= 0) return;

        const wIdx = Phaser.Math.Between(0, this.weapons.length - 1);
        const w = this.weapons[wIdx];
        const duration = Phaser.Math.Clamp(1000 * (300 / w.speed), 120, 600);

        const { width: W, height: H } = this.scale;
        const topY = H * 0.20;
        const bottomY = H * 0.80;

        this.flyBullet({
            fromX: W / 2,
            fromY: topY + 30,
            toY: bottomY - 20,
            color: w.color,
            duration,
            onImpact: () => {
                this.playerHP = Math.max(0, this.playerHP - w.dmg);
                this.playerHPBar.set(this.playerHP / this.playerHPMax);
                this.updateHPTexts();

                if (this.playerHP === 0) {
                    this.endRound(false);
                    return;
                }

                this.nextTurn();
                this.startPlayerTurn();
            }
        });
    }

    // ---------- create ----------
    create() {
        const { width: W, height: H } = this.scale;
        const { x: centerX, y: centerY } = getCenter(this.scale);

        // background
        if (this.textureExists('background')) {
            this.background = this.add.image(centerX, centerY, 'background').setOrigin(0.5).setDisplaySize(W, H);
        } else {
            this.cameras.main.setBackgroundColor(0x082a47);
        }

        const pad = 24;
        this.homeBtn = this.addSafeImage(pad + 24, pad + 24, 'home', { w: 56, h: 32, label: 'home' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MainMenu'));

        const topY = H * 0.20;
        const bottomY = H * 0.80;

        // Enemy battleship (TOP). IMPORTANT: do not use setDisplaySize here—use height-scaler.
        if (this.textureExists('battleshipP')) {
            const img = this.add.image(W / 2, topY, 'battleshipP').setOrigin(0.5);
            this.sizeShipByHeight(img, H, 0.09);
            this.enemy = img;
        } else {
            this.enemy = this.add.rectangle(W / 2, topY, 120, 40, 0xff5555).setOrigin(0.5);
        }

        // Player battleship (BOTTOM)
        if (this.textureExists('battleshipE')) {
            const img = this.add.image(W / 2, bottomY, 'battleshipE').setOrigin(0.5);
            this.sizeShipByHeight(img, H, 0.11);
            this.player = img;
        } else {
            this.player = this.add.rectangle(W / 2, bottomY, 120, 40, 0x55ff88).setOrigin(0.5);
        }

        // --- Adjust ship vertical offsets ---
        const SHIP_TOP_OFFSET = 40;      // push enemy ship down
        const SHIP_BOTTOM_OFFSET = -40;  // push player ship up

        (this.enemy as Phaser.GameObjects.Image).setY(topY + SHIP_TOP_OFFSET);
        (this.player as Phaser.GameObjects.Image).setY(bottomY + SHIP_BOTTOM_OFFSET);

        // gentle idle motion
        this.tweens.add({ targets: this.player, y: bottomY - 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.tweens.add({ targets: this.enemy,  y: topY + 10,    duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

        // HP bars
        const barW = 220, barH = 16, gap = 32;
        this.enemyHPBar  = this.makeHPBar(W / 2, topY    - gap, barW, barH, 0xff3b3b);
        this.playerHPBar = this.makeHPBar(W / 2, bottomY + gap, barW, barH, 0x27d35a);
        this.enemyHPBar.set(1);
        this.playerHPBar.set(1);

        // HP numbers
        const hpFont = getResponsiveFontSize(W, H, 18, 14);
        this.enemyHPText = this.add.text(W / 2, topY - gap - 20, '', {
            fontFamily: 'Arial Black',
            fontSize: `${hpFont}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.playerHPText = this.add.text(W / 2, bottomY + gap + 20, '', {
            fontFamily: 'Arial Black',
            fontSize: `${hpFont}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.updateHPTexts();

        // Weapon selector
        this.buildWeaponUI();

        // Attack button
        this.attackBtn = this.add
            .text(W - 140, bottomY - 10, 'ATTACK', {
                fontFamily: 'Arial Black',
                fontSize: '18px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6
            })
            .setOrigin(1, 0.5);

        // Modern glass “turn badge” (top-right)
        const badgeW = 140, badgeH = 40;
        this.turnBadgeGlass = this.drawGlass(W - (pad + badgeW / 2), pad + 24, badgeW, badgeH);
        const badgeFont = getResponsiveFontSize(W, H, 20, 16);
        this.turnBadgeText = this.add.text(this.turnBadgeGlass.x, this.turnBadgeGlass.y, `Turn: ${this.turnNumber}`, {
            fontFamily: 'Arial Black',
            fontSize: `${badgeFont}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Modern glass “whose turn” label (top-center)
        const whoW = 220, whoH = 48;
        this.turnLabelGlass = this.drawGlass(W / 2, H * 0.11, whoW, whoH, 0.28);
        const whoFont = getResponsiveFontSize(W, H, 26, 20);
        this.turnLabelText = this.add.text(this.turnLabelGlass.x, this.turnLabelGlass.y, 'YOUR TURN', {
            fontFamily: 'Arial Black',
            fontSize: `${whoFont}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // start run
        this.startPlayerTurn();

        // resize & cleanup
        this.scale.on('resize', this.onResize, this);
        EventBus.emit('current-scene-ready', this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.enemyTurnTimer?.remove();
            this.scale.off('resize', this.onResize, this);
            this.attackBtn?.removeAllListeners();
        });
        this.events.once(Phaser.Scenes.Events.DESTROY, () => {
            this.enemyTurnTimer?.remove();
            this.scale.off('resize', this.onResize, this);
            this.attackBtn?.removeAllListeners();
        });
    }

    // ---------- attacks ----------
    private doLocalAttack() {
        if (!this.isPlayerTurn || this.coolingDown || this.enemyHP <= 0 || this.playerHP <= 0) return;

        this.coolingDown = true;
        this.time.delayedCall(this.cooldownMs, () => (this.coolingDown = false));

        const w = this.weapons[this.currentWeaponIndex];
        this.shotsFired++;

        const { width: W, height: H } = this.scale;
        const topY = H * 0.20;
        const bottomY = H * 0.80;
        const duration = Phaser.Math.Clamp(1000 * (300 / w.speed), 120, 600);

        this.flyBullet({
            fromX: W / 2,
            fromY: bottomY - 30,
            toY: topY + 20,
            color: w.color,
            duration,
            onImpact: () => {
                this.enemyHP = Math.max(0, this.enemyHP - w.dmg);
                this.totalDamage += w.dmg;
                this.enemyHPBar.set(this.enemyHP / this.enemyHPMax);
                this.updateHPTexts();

                if (this.enemyHP === 0) {
                    this.endRound(true);
                    return;
                }

                this.nextTurn();
                this.startEnemyTurn();
            }
        });
    }

    // ---------- end ----------
    private endRound(playerWon: boolean) {
        this.enemyTurnTimer?.remove();
        this.scale.off('resize', this.onResize, this);
        this.attackBtn?.removeAllListeners();

        this.scene.start('GameOver', {
            result: playerWon ? 'VICTORY' : 'DEFEAT',
            playerHP: this.playerHP,
            enemyHP: this.enemyHP,
            shots: this.shotsFired,
            damage: this.totalDamage
        });
    }

    // ---------- resize ----------
    private onResize(gameSize: Phaser.Structs.Size) {
        const { width: W, height: H } = gameSize;

        resizeSceneBase(this, W, H);

        const pad = 24;
        const topY = H * 0.20;
        const bottomY = H * 0.80;

        if (this.background) this.background.setPosition(W / 2, H / 2).setDisplaySize(W, H);

        (this.homeBtn as any)?.setPosition(pad + 24, pad + 24);

        // reposition
        (this.enemy as any)?.setPosition(W / 2, topY);
        (this.player as any)?.setPosition(W / 2, bottomY);

        // rescale ships by height (this is the key to “make it bigger” really working)
        if (this.enemy instanceof Phaser.GameObjects.Image) this.sizeShipByHeight(this.enemy, H, 0.09);
        if (this.player instanceof Phaser.GameObjects.Image) this.sizeShipByHeight(this.player, H, 0.11);

        const gap = 32;
        this.enemyHPBar?.setPosition(W / 2, topY - gap);
        this.playerHPBar?.setPosition(W / 2, bottomY + gap);

        const hpFont = getResponsiveFontSize(W, H, 18, 14);
        this.enemyHPText?.setFontSize(hpFont).setPosition(W / 2, topY - gap - 20);
        this.playerHPText?.setFontSize(hpFont).setPosition(W / 2, bottomY + gap + 20);

        this.weaponRelayout && this.weaponRelayout();
        this.attackBtn?.setPosition(W - 140, bottomY - 10);

        const badgeW = 140, badgeH = 40;
        this.turnBadgeGlass?.setPosition(W - (pad + badgeW / 2), pad + 24).setSize(badgeW, badgeH);
        const badgeFont = getResponsiveFontSize(W, H, 20, 16);
        this.turnBadgeText?.setFontSize(badgeFont).setPosition(this.turnBadgeGlass.x, this.turnBadgeGlass.y);

        const whoW = 220, whoH = 48;
        this.turnLabelGlass?.setPosition(W / 2, H * 0.11).setSize(whoW, whoH);
        const whoFont = getResponsiveFontSize(W, H, 26, 20);
        this.turnLabelText?.setFontSize(whoFont).setPosition(this.turnLabelGlass.x, this.turnLabelGlass.y);
    }
}

export default Game;

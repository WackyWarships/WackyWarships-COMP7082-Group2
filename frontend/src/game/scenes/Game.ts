import Phaser, { Scene } from 'phaser';
import EventBus from '../EventBus';
import {
    getCenter,
    getResponsiveFontSize,
    isMobile,
    resizeSceneBase,
} from '../utils/layout';

type Weapon = { key: string; color: number; dmg: number; speed: number };

export class Game extends Scene {
    private player!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    private enemy!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    private background!: Phaser.GameObjects.Image;
    private attackBtn!: Phaser.GameObjects.Text;
    private playerHPBar!: { set: (pct: number) => void; setPosition: (x: number, y: number) => void };
    private enemyHPBar!: { set: (pct: number) => void; setPosition: (x: number, y: number) => void };
    private weaponNodes: Array<{ circle: Phaser.GameObjects.Arc; ring: Phaser.GameObjects.Arc; chip: Phaser.GameObjects.Arc }> = [];
    private weaponRelayout?: () => void;

    private playerHPMax!: number;
    private enemyHPMax!: number;
    private playerHP!: number;
    private enemyHP!: number;
    private weapons!: Weapon[];
    private currentWeaponIndex!: number;
    private coolingDown!: boolean;
    private shotsFired!: number;
    private totalDamage!: number;

    constructor() {
        super('Game');
    }

    init(): void {
        this.playerHPMax = 100;
        this.enemyHPMax = 100;
        this.playerHP = this.playerHPMax;
        this.enemyHP = this.enemyHPMax;

        this.weapons = [
            { key: 'W1', color: 0x6ec1ff, dmg: 10, speed: 900 },
            { key: 'W2', color: 0x8be27e, dmg: 30, speed: 900 },
            { key: 'W3', color: 0xf6b26b, dmg: 50, speed: 900 },
            { key: 'W4', color: 0xd96df0, dmg: 80, speed: 900 },
        ];

        this.currentWeaponIndex = 0;
        this.coolingDown = false;
        this.shotsFired = 0;
        this.totalDamage = 0;
    }

    create(): void {
        const { width, height } = this.scale;
        const { x: centerX, y: centerY } = getCenter(this.scale);

        // Background
        this.background = this.add.image(centerX, centerY, 'background')
            .setOrigin(0.5)
            .setDisplaySize(width, height);

        // Enemy ship
        const topY = height * 0.2;
        this.enemy = this.textures.exists('logo')
            ? this.add.image(centerX, topY, 'logo').setFlipY(true)
            : this.add.rectangle(centerX, topY, 120, 40, 0xff5555);

        // Player ship
        const bottomY = height * 0.8;
        this.player = this.textures.exists('logo')
            ? this.add.image(centerX, bottomY, 'logo')
            : this.add.rectangle(centerX, bottomY, 120, 40, 0x55ff88);

        this.tweens.add({ targets: this.player, y: bottomY - 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.tweens.add({ targets: this.enemy, y: topY + 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

        // HP bars
        const barW = 180, barH = 14, gap = 28;
        this.enemyHPBar = this.makeHPBar(centerX, topY - gap, barW, barH, 0xff3b3b);
        this.playerHPBar = this.makeHPBar(centerX, bottomY + gap, barW, barH, 0x27d35a);
        this.enemyHPBar.set(1);
        this.playerHPBar.set(1);

        // Weapon UI
        this.buildWeaponUI();

        // Attack button
        const attackFontSize = getResponsiveFontSize(width, height, 20, 16);
        this.attackBtn = this.add.text(width - 140, bottomY - 10, 'ATTACK', {
            fontFamily: 'Arial Black',
            fontSize: `${attackFontSize}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
        })
            .setOrigin(1, 0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.doLocalAttack());

        // Resize + cleanup
        this.scale.on('resize', this.onResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.removeAllListeners();
            this.time.removeAllEvents();
            this.tweens.killAll();
            this.scale.off('resize', this.onResize, this);
        });

        EventBus.emit('current-scene-ready', this);
    }

    private makeHPBar(x: number, y: number, width: number, height: number, fillColor: number) {
        const bg = this.add.rectangle(x, y, width, height, 0x000000, 0.45).setOrigin(0.5);
        bg.setStrokeStyle(2, 0xffffff, 0.65);
        const fill = this.add.rectangle(x - width / 2, y, width, height, fillColor).setOrigin(0, 0.5);

        return {
            set: (pct: number) => {
                const w = Phaser.Math.Clamp(pct, 0, 1) * width;
                fill.width = w;
            },
            setPosition: (nx: number, ny: number) => {
                bg.setPosition(nx, ny);
                fill.setPosition(nx - width / 2, ny);
            },
        };
    }

    private buildWeaponUI() {
        const { width: W, height: H } = this.scale;
        const count = 4, r = 24, gap = 14, pad = 20;
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
            const circle = this.add.circle(x, y, r, 0x0d1a2b, 0.35)
                .setStrokeStyle(2, 0x88aaff, 0.9)
                .setDepth(200)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', (p: Phaser.Input.Pointer) => {
                    p.event.stopPropagation();
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

    private flyBullet(opts: { fromX: number; fromY: number; toY: number; color: number; duration: number; onImpact: () => void }) {
        const b = this.add.circle(opts.fromX, opts.fromY, 6, opts.color).setDepth(50);
        this.tweens.add({
            targets: b,
            y: opts.toY,
            duration: opts.duration,
            onComplete: () => {
                b.destroy();
                opts.onImpact();
            },
        });
    }

    private doLocalAttack() {
        if (this.coolingDown) return;
        if (this.enemyHP <= 0 || this.playerHP <= 0) return;

        this.coolingDown = true;
        this.time.delayedCall(350, () => (this.coolingDown = false));

        const w = this.weapons[this.currentWeaponIndex];
        this.shotsFired++;

        const duration = Phaser.Math.Clamp(1000 * (300 / w.speed), 120, 600);
        const px = this.player.x;
        const py = this.player.y;
        const ey = this.enemy.y;

        this.flyBullet({
            fromX: px,
            fromY: py - 30,
            toY: ey + 20,
            color: w.color,
            duration,
            onImpact: () => {
                this.enemyHP = Math.max(0, this.enemyHP - w.dmg);
                this.totalDamage += w.dmg;
                this.enemyHPBar.set(this.enemyHP / this.enemyHPMax);
                if (this.enemyHP === 0) {
                    this.endRound(true);
                }
            },
        });
    }

    private endRound(playerWon: boolean) {
        this.scene.start('GameOver', {
            result: playerWon ? 'VICTORY' : 'DEFEAT',
            playerHP: this.playerHP,
            enemyHP: this.enemyHP,
            shots: this.shotsFired,
            damage: this.totalDamage,
        });
    }

    private onResize = (gameSize: Phaser.Structs.Size) => {
        const { width, height } = gameSize;
        const topY = height * 0.2;
        const bottomY = height * 0.8;

        this.background?.setPosition(width / 2, height / 2).setDisplaySize(width, height);
        this.enemy.setPosition(width / 2, topY);
        this.player.setPosition(width / 2, bottomY);

        const gap = 28;
        this.enemyHPBar.setPosition(width / 2, topY - gap);
        this.playerHPBar.setPosition(width / 2, bottomY + gap);

        this.weaponRelayout?.();

        const attackFontSize = getResponsiveFontSize(width, height, 20, 16);
        this.attackBtn?.setFontSize(attackFontSize).setPosition(width - 140, bottomY - 10);

        resizeSceneBase(this, width, height);
    };
}
export default Game;

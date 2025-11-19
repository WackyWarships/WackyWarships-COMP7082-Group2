// src/game/scenes/GameOver.ts
import Phaser, { Scene } from 'phaser';
import EventBus from '../EventBus';
import { getCenter, getResponsiveFontSize, resizeSceneBase } from '../utils/layout';

type ResultData = {
    result?: 'VICTORY' | 'DEFEAT';
    playerHP?: number;
    enemyHP?: number;
    shots?: number;
    damage?: number;
};

const ENEMY_SPRITES = {
    normal: "blueship",
    damaged: "blueship_dmg",
    critical: "blueship_crit",
    destroyed: "blueship_destroyed", // NEW
};
const PLAYER_SPRITES = {
    normal: "redship",
    damaged: "redship_dmg",
    critical: "redship_crit",
    destroyed: "redship_destroyed", // NEW
};

export class GameOver extends Scene {
    private background!: Phaser.GameObjects.Image;
    private title!: Phaser.GameObjects.Text;
    private stats!: Phaser.GameObjects.Text;
    private mainBtn!: Phaser.GameObjects.Text;

    private enemySprite?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    private playerSprite?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

    private finalPlayerHP = 0;
    private finalEnemyHP = 0;
    private readonly HP_MAX = 100;

    constructor() {
        super('GameOver');
    }

    private textureExists(key: string) {
        return this.textures && this.textures.exists(key);
    }

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

    private sizeByHeight(img: Phaser.GameObjects.Image, screenH: number, percentH: number) {
        const baseH = img.height || 1;
        const targetH = screenH * percentH;
        img.setScale(targetH / baseH);
    }

    // NEW: decide destroyed vs tiered sprites, then build
    private buildShipSprites(result?: 'VICTORY' | 'DEFEAT') {
        const { width, height } = this.scale;
        const enemyY = height * 0.40;
        const playerY = height * 0.60;

        const playerLost = (result === 'DEFEAT') || (this.finalPlayerHP <= 0);
        const enemyLost = (result === 'VICTORY') || (this.finalEnemyHP <= 0);

        // --- Enemy final ---
        const enemyKeyDesired = enemyLost
            ? ENEMY_SPRITES.destroyed
            : this.spriteFor(this.finalEnemyHP, this.HP_MAX, ENEMY_SPRITES);

        let enemyKeyToUse = enemyKeyDesired;
        if (!this.textureExists(enemyKeyDesired)) {
            // fallback to normal if destroyed (or tier) is missing
            enemyKeyToUse = this.textureExists(ENEMY_SPRITES.normal) ? ENEMY_SPRITES.normal : '';
        }

        if (enemyKeyToUse && this.textureExists(enemyKeyToUse)) {
            const img = this.add.image(width * 0.28, enemyY, enemyKeyToUse).setOrigin(0.5);
            this.sizeByHeight(img, height, 0.10);
            this.enemySprite = img;
        } else {
            this.enemySprite = this.add.rectangle(width * 0.28, enemyY, 120, 40, 0xff5555).setOrigin(0.5);
        }

        // --- Player final ---
        const playerKeyDesired = playerLost
            ? PLAYER_SPRITES.destroyed
            : this.spriteFor(this.finalPlayerHP, this.HP_MAX, PLAYER_SPRITES);

        let playerKeyToUse = playerKeyDesired;
        if (!this.textureExists(playerKeyDesired)) {
            playerKeyToUse = this.textureExists(PLAYER_SPRITES.normal) ? PLAYER_SPRITES.normal : '';
        }

        if (playerKeyToUse && this.textureExists(playerKeyToUse)) {
            const img = this.add.image(width * 0.72, playerY, playerKeyToUse).setOrigin(0.5);
            this.sizeByHeight(img, height, 0.12);
            this.playerSprite = img;
        } else {
            this.playerSprite = this.add.rectangle(width * 0.72, playerY, 120, 40, 0x55ff88).setOrigin(0.5);
        }

        // gentle float
        this.tweens.add({
            targets: [this.enemySprite, this.playerSprite],
            y: '+=10',
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
        });
    }

    create(data: ResultData): void {
        const { width, height } = this.scale;
        const { x: centerX, y: centerY } = getCenter(this.scale);

        this.finalPlayerHP = data.playerHP ?? 0;
        this.finalEnemyHP = data.enemyHP ?? 0;

        this.background = this.add.image(centerX, centerY, "spacebackground")
            .setOrigin(0.5)
            .setDisplaySize(height * 0.46, height)
            .setTint(0x222222);

        const titleSize = getResponsiveFontSize(width, height, 48, 36);
        this.title = this.add.text(centerX, height * 0.18, data.result ?? 'GAME OVER', {
            fontFamily: 'Arial Black',
            fontSize: `${titleSize}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
        }).setOrigin(0.5);

        // NEW: build with destroyed logic
        this.buildShipSprites(data.result);

        const bodySize = getResponsiveFontSize(width, height, 22, 18);
        const lines = [
            `Player HP: ${data.playerHP ?? 0}`,
            `Enemy HP:  ${data.enemyHP ?? 0}`,
            `Shots:     ${data.shots ?? 0}`,
            `Damage:    ${data.damage ?? 0}`,
        ];
        this.stats = this.add.text(centerX, height * 0.72, lines.join('\n'), {
            fontFamily: 'Arial',
            fontSize: `${bodySize}px`,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5, 0);

        const btnSize = getResponsiveFontSize(width, height, 24, 20);
        this.mainBtn = this.add.text(centerX, height * 0.90, 'MAIN MENU', {
            fontFamily: 'Arial Black',
            fontSize: `${btnSize}px`,
            color: '#ffffff',
            backgroundColor: '#1e90ff',
            padding: { x: 22, y: 12 },
            stroke: '#000000',
            strokeThickness: 6,
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => this.mainBtn.setStyle({ backgroundColor: '#63b3ff' }))
            .on('pointerout', () => this.mainBtn.setStyle({ backgroundColor: '#1e90ff' }))
            .on('pointerdown', () => {
                this.scene.stop('Game');
                this.scene.start('MainMenu');
            });

        this.scale.on('resize', this.onResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.onResize, this);
        });

        EventBus.emit('current-scene-ready', this);
    }

    private onResize = (gameSize: Phaser.Structs.Size) => {
        const { width, height } = gameSize;
        const { x: centerX, y: centerY } = getCenter(this.scale);

        this.background?.setPosition(centerX, centerY).setDisplaySize(width, height);

        const titleSize = getResponsiveFontSize(width, height, 48, 36);
        this.title?.setPosition(centerX, height * 0.18).setFontSize(titleSize);

        const enemyY = height * 0.40;
        const playerY = height * 0.60;

        if (this.enemySprite) {
            this.enemySprite.setPosition(width * 0.28, enemyY);
            if (this.enemySprite instanceof Phaser.GameObjects.Image) {
                this.sizeByHeight(this.enemySprite, height, 0.10);
            }
        }
        if (this.playerSprite) {
            this.playerSprite.setPosition(width * 0.72, playerY);
            if (this.playerSprite instanceof Phaser.GameObjects.Image) {
                this.sizeByHeight(this.playerSprite, height, 0.12);
            }
        }

        const bodySize = getResponsiveFontSize(width, height, 22, 18);
        this.stats?.setPosition(centerX, height * 0.72).setFontSize(bodySize);

        const btnSize = getResponsiveFontSize(width, height, 24, 20);
        this.mainBtn?.setPosition(centerX, height * 0.90).setFontSize(btnSize);

        resizeSceneBase(this, width, height);
    };
}

export default GameOver;

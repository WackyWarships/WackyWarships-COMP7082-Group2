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

export class GameOver extends Scene {
    private background!: Phaser.GameObjects.Image;
    private title!: Phaser.GameObjects.Text;
    private stats!: Phaser.GameObjects.Text;
    private mainBtn!: Phaser.GameObjects.Text;

    constructor() {
        super('GameOver');
    }

    create(data: ResultData): void {
        const { width, height } = this.scale;
        const { x: centerX, y: centerY } = getCenter(this.scale);

        // Background tinted
        this.background = this.add.image(centerX, centerY, 'background')
            .setOrigin(0.5)
            .setDisplaySize(width, height)
            .setTint(0x222222);

        // Title
        const titleSize = getResponsiveFontSize(width, height, 48, 36);
        this.title = this.add.text(centerX, height * 0.22, data.result ?? 'GAME OVER', {
            fontFamily: 'Arial Black',
            fontSize: `${titleSize}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
        }).setOrigin(0.5);

        // Scoreboard
        const bodySize = getResponsiveFontSize(width, height, 22, 18);
        const lines = [
            `Player HP: ${data.playerHP ?? 0}`,
            `Enemy HP:  ${data.enemyHP ?? 0}`,
            `Shots:     ${data.shots ?? 0}`,
            `Damage:    ${data.damage ?? 0}`,
        ];
        this.stats = this.add.text(centerX, height * 0.40, lines.join('\n'), {
            fontFamily: 'Arial',
            fontSize: `${bodySize}px`,
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0);

        // Main Menu button
        const btnSize = getResponsiveFontSize(width, height, 24, 20);
        this.mainBtn = this.add.text(centerX, height * 0.72, 'MAIN MENU', {
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
                // IMPORTANT: ensure Game is fully stopped before returning
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
        this.title?.setPosition(centerX, height * 0.22).setFontSize(titleSize);

        const bodySize = getResponsiveFontSize(width, height, 22, 18);
        this.stats?.setPosition(centerX, height * 0.40).setFontSize(bodySize);

        const btnSize = getResponsiveFontSize(width, height, 24, 20);
        this.mainBtn?.setPosition(centerX, height * 0.72).setFontSize(btnSize);

        resizeSceneBase(this, width, height);
    };
}
export default GameOver;

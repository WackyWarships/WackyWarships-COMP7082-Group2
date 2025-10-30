import { Scene, GameObjects } from 'phaser';
import { savePlayerName, getOrCreatePlayerId } from '../utils/playerIdentity';
import { sendIdentifyPlayer } from '../../api/socket';
import EventBus from '../EventBus';
import {
    getCenter,
    isMobile,
    getResponsiveFontSize,
    resizeSceneBase
} from '../utils/layout';

export class EnterUsername extends Scene {
    background!: GameObjects.Image;
    title!: GameObjects.Text;
    prompt!: GameObjects.Text;
    confirmButton!: GameObjects.Text;
    inputEl!: HTMLInputElement;

    constructor() {
        super('EnterUsername');
    }

    create() {
        const { width, height } = this.scale;
        const { x: centerX, y: centerY } = getCenter(this.scale);
        const mobile = isMobile(width);

        // Background 
        this.background = this.add.image(centerX, centerY, 'background')
            .setDisplaySize(width, height)
            .setOrigin(0.5);

        // Title 
        const titleSize = getResponsiveFontSize(width, height, 72, 56);
        this.title = this.add.text(centerX, height * 0.15, 'Filler Text!', {
            fontFamily: 'Arial Black',
            fontSize: `${titleSize}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
        }).setOrigin(0.5);

        //  Prompt text 
        const promptSize = getResponsiveFontSize(width, height, 36, 26);
        this.prompt = this.add.text(centerX, height * 0.32, 'Enter Your Username', {
            fontFamily: 'Arial',
            fontSize: `${promptSize}px`,
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5);

        // --- HTML Input ---
        this.createInput(centerX, centerY);

        // --- Confirm button ---
        const buttonStyle = {
            fontFamily: 'Arial',
            fontSize: `${mobile ? 26 : 32}px`,
            color: '#ffffff',
            backgroundColor: '#1e90ff',
            padding: { x: 20, y: 10 },
            align: 'center',
            fixedWidth: mobile ? 220 : 260,
        };

        this.confirmButton = this.add.text(centerX, centerY + 80, 'Confirm', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.submitUsername())
            .on('pointerover', () => this.confirmButton.setStyle({ backgroundColor: '#63b3ff' }))
            .on('pointerout', () => this.confirmButton.setStyle({ backgroundColor: '#1e90ff' }));

        // --- Resize handling ---
        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
            if (this.inputEl) this.inputEl.remove();
        });
    }

    createInput(centerX: number, centerY: number) {
        this.inputEl = document.createElement('input');
        this.inputEl.type = 'text';
        this.inputEl.placeholder = 'Your name here';
        Object.assign(this.inputEl.style, {
            position: 'absolute',
            left: `${centerX - 120}px`,
            top: `${centerY - 20}px`,
            width: '240px',
            padding: '10px',
            fontSize: '18px',
            textAlign: 'center',
            borderRadius: '6px',
            border: '2px solid #1e90ff',
        });
        document.body.appendChild(this.inputEl);
    }

    submitUsername() {
        const playerName = this.inputEl.value.trim() || 'Guest';
        savePlayerName(playerName);
        this.inputEl.remove();

        const playerId = getOrCreatePlayerId();
        sendIdentifyPlayer({ playerId, playerName });

        // Wait for server confirmation
        EventBus.on('player-identified', () => {
            this.scene.start('MainMenu');
        });
    }

    handleResize(gameSize: Phaser.Structs.Size) {
        const { width, height } = gameSize;
        if (!this.scene.isActive()) return;

        resizeSceneBase(this, width, height);
        const { x: centerX, y: centerY } = getCenter(this.scale);

        const titleSize = getResponsiveFontSize(width, height, 72, 56);
        const promptSize = getResponsiveFontSize(width, height, 36, 26);

        this.title.setFontSize(titleSize);
        this.prompt.setFontSize(promptSize);

        this.title.setPosition(centerX, height * 0.15);
        this.prompt.setPosition(centerX, height * 0.32);
        this.confirmButton.setPosition(centerX, centerY + 80);

        if (this.inputEl) {
            this.inputEl.style.left = `${centerX - 120}px`;
            this.inputEl.style.top = `${centerY - 20}px`;
        }
    }
}
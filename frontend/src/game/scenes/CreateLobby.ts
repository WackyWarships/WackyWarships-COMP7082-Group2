import { Scene } from 'phaser';
import EventBus from '../EventBus';
import {
    getCenter,
    isMobile,
    getResponsiveFontSize,
    resizeSceneBase
} from '../utils/layout';

export class CreateLobby extends Scene {
    background!: Phaser.GameObjects.Image;
    title!: Phaser.GameObjects.Text;
    nameInput?: HTMLInputElement;
    createButton!: Phaser.GameObjects.Text;
    backButton!: Phaser.GameObjects.Text;

    constructor() {
        super('CreateLobby');
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
        const titleFontSize = getResponsiveFontSize(width, height, 56, 44);
        this.title = this.add.text(centerX, height * 0.15, 'Create Lobby', {
            fontFamily: 'Arial Black',
            fontSize: `${titleFontSize}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
        }).setOrigin(0.5);

        // Input Field 
        this.createNameInput();

        // Buttons 
        const buttonStyle = {
            fontFamily: 'Arial',
            fontSize: `${mobile ? 26 : 34}px`,
            color: '#ffffff',
            backgroundColor: '#1e90ff',
            padding: { x: 20, y: 10 },
            align: 'center',
            fixedWidth: mobile ? 240 : 300,
        };

        this.createButton = this.add.text(centerX, height * 0.55, 'Create', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.handleCreateClick())
            .on('pointerover', () => this.createButton.setStyle({ backgroundColor: '#63b3ff' }))
            .on('pointerout', () => this.createButton.setStyle({ backgroundColor: '#1e90ff' }));

        this.backButton = this.add.text(centerX, height * 0.65, 'Back', {
            ...buttonStyle,
            backgroundColor: '#5555ff',
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MainMenu'))
            .on('pointerover', () => this.backButton.setStyle({ backgroundColor: '#7a7aff' }))
            .on('pointerout', () => this.backButton.setStyle({ backgroundColor: '#5555ff' }));

        // Handle resizing 
        this.scale.on('resize', this.handleResize, this);

        // Cleanup input on shutdown
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (this.nameInput) {
                this.nameInput.remove();
                this.nameInput = undefined;
            }
        });

        EventBus.emit('current-scene-ready', this);
    }

    // Input creation 
    createNameInput( ) {
        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.placeholder = 'Enter lobby name...';

        Object.assign(this.nameInput.style, {
            position: 'absolute',
            background: 'white',
            color: 'black',
            border: '2px solid #1e90ff',
            borderRadius: '6px',
            padding: '4px 8px',
            width: '240px',
            height: '32px',
            fontSize: '18px',
            outline: 'none',
            textAlign: 'center',
            zIndex: '10',
            pointerEvents: 'auto',
            transform: 'translate(-50%, -50%)',
        });

        document.body.appendChild(this.nameInput);

        this.updateInputPosition();
    }

    // Correct input placement relative to canvas 
    private updateInputPosition() {
        if (!this.nameInput) return;

        const rect = this.game.canvas.getBoundingClientRect();
        const { height } = this.scale;
        const { x: centerX } = getCenter(this.scale);

        const titleY = height * 0.15;
        const createBtnY = height * 0.55;
        const midY = titleY + (createBtnY - titleY) * 0.5;

        this.nameInput.style.left = `${rect.left + centerX}px`;
        this.nameInput.style.top = `${rect.top + midY}px`;
    }

    handleCreateClick() {
        const name = this.nameInput?.value?.trim() || 'Lobby';
        const lobbyId = Math.random().toString(36).substring(2, 7).toUpperCase();

        console.log(`Creating lobby ${lobbyId}: ${name}`);
        // sendCreateLobby({ hostName, playerId, lobbyName, settings?, client? });

        this.scene.start('Game'); // Temporary
    }

    handleResize(gameSize: Phaser.Structs.Size) {
        const { width, height } = gameSize;
        resizeSceneBase(this, width, height);

        const { x: centerX } = getCenter(this.scale);

        // Reposition elements
        this.title.setPosition(centerX, height * 0.15);
        this.createButton.setPosition(centerX, height * 0.55);
        this.backButton.setPosition(centerX, height * 0.65);

        // Update DOM input position
        this.updateInputPosition();
    }
}

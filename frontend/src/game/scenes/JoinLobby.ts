import { Scene } from 'phaser';
import EventBus from '../EventBus';
import {
    getCenter,
    isMobile,
    getResponsiveFontSize,
    resizeSceneBase
} from '../utils/layout';
import { 
    sendJoinLobby,
    getPlayerId
 } from '../../api/socket';
import { JoinLobbyEvent } from 'shared/types';

export class JoinLobby extends Scene {
    background!: Phaser.GameObjects.Image;
    title!: Phaser.GameObjects.Text;
    codeInput?: HTMLInputElement;
    joinButton!: Phaser.GameObjects.Text;
    backButton!: Phaser.GameObjects.Text;

    constructor() {
        super('JoinLobby');
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
        this.title = this.add.text(centerX, height * 0.15, 'Join Lobby', {
            fontFamily: 'Arial Black',
            fontSize: `${titleFontSize}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
        }).setOrigin(0.5);

        // Input Field 
        this.joinCodeInput();

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

        this.joinButton = this.add.text(centerX, height * 0.55, 'Join', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.handleJoinClick())
            .on('pointerover', () => this.joinButton.setStyle({ backgroundColor: '#63b3ff' }))
            .on('pointerout', () => this.joinButton.setStyle({ backgroundColor: '#1e90ff' }));

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
        this.events.on('lobby-update', this.enterLobby, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
            this.events.off('lobby-update', this.enterLobby, this);
        });

        // Cleanup input on shutdown
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (this.codeInput) {
                this.codeInput.remove();
                this.codeInput = undefined;
            }
        });

        EventBus.emit('current-scene-ready', this);
    }

    // Input creation 
    joinCodeInput() {
        this.codeInput = document.createElement('input');
        this.codeInput.type = 'text';
        this.codeInput.placeholder = 'Enter lobby code...';

        Object.assign(this.codeInput.style, {
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

        document.body.appendChild(this.codeInput);

        this.updateInputPosition();
    }

    // Correct input placement relative to canvas 
    private updateInputPosition() {
        if (!this.codeInput) return;

        const rect = this.game.canvas.getBoundingClientRect();
        const { height } = this.scale;
        const { x: centerX } = getCenter(this.scale);

        const titleY = height * 0.15;
        const createBtnY = height * 0.55;
        const midY = titleY + (createBtnY - titleY) * 0.5;

        this.codeInput.style.left = `${rect.left + centerX}px`;
        this.codeInput.style.top = `${rect.top + midY}px`;
    }

    handleJoinClick() {
        const code = this.codeInput?.value?.trim() || undefined;

        if (code) {
            const payload: JoinLobbyEvent = {
                lobbyId: code,
                playerId: getPlayerId()
            };
            
            sendJoinLobby(payload);

            console.log(`Joining lobby ${payload.lobbyId}`);
        }
    }

    handleResize(gameSize: Phaser.Structs.Size) {
        // If this is not the current scene, ignore this resize
        if (!this.background || !this.scene.isActive()) return;

        const { width, height } = gameSize;
        resizeSceneBase(this, width, height);

        const { x: centerX } = getCenter(this.scale);

        // Reposition elements
        this.title.setPosition(centerX, height * 0.15);
        this.joinButton.setPosition(centerX, height * 0.55);
        this.backButton.setPosition(centerX, height * 0.65);

        this.updateInputPosition();

    }

    enterLobby() {
        this.scene.start('Game');
    }
}

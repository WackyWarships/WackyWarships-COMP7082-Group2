import { Scene, GameObjects } from 'phaser';
import { savePlayerName, getOrCreatePlayerId } from '../utils/playerUsername';
import { sendSetUsername } from '../../api/socket';
import EventBus from '../EventBus';
import {
    getCenter,
    isMobile,
    getResponsiveFontSize,
    resizeSceneBase
} from '../utils/layout';

export class EnterUsername extends Scene {
    background!: GameObjects.Image;
    title1!: GameObjects.Text;
    title2!: GameObjects.Text;
    confirmButton!: GameObjects.Text;
    inputEl!: HTMLInputElement;

    constructor() {
        super('EnterUsername');
    }

    create() {
        const { width, height } = this.scale;
        const { x: centerX } = getCenter(this.scale);
        const mobile = isMobile(width);

        // Background
        this.background = this.add.image(centerX, height / 2, 'background')
            .setDisplaySize(width, height)
            .setOrigin(0.5);

        // Title 
        const titleSize = getResponsiveFontSize(width, height, 72, 56);
        this.title1 = this.add.text(centerX, height * (1 / 6), 'Enter Your', {
            fontFamily: 'Arial Black',
            fontSize: `${titleSize}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
        }).setOrigin(0.5);

        this.title2 = this.add.text(centerX, this.title1.y + this.title1.height, 'Username!', {
            fontFamily: 'Arial Black',
            fontSize: `${titleSize}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
        }).setOrigin(0.5);

        // Input 
        this.createInput(height * (1 / 2));

        // Confirm Button 
        const buttonStyle = {
            fontFamily: 'Arial',
            fontSize: `${mobile ? 26 : 32}px`,
            color: '#ffffff',
            backgroundColor: '#1e90ff',
            padding: { x: 20, y: 10 },
            align: 'center',
            fixedWidth: mobile ? 220 : 260,
        };

        this.confirmButton = this.add.text(centerX, height * (5 / 6), 'Confirm', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.submitUsername())
            .on('pointerover', () => this.confirmButton.setStyle({ backgroundColor: '#63b3ff' }))
            .on('pointerout', () => this.confirmButton.setStyle({ backgroundColor: '#1e90ff' }));

        // Resize handling
        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
            if (this.inputEl) this.inputEl.remove();
        });
    }

    createInput(inputY: number) {
        const rect = this.game.canvas.getBoundingClientRect();
        const centerXOnScreen = rect.left + rect.width / 2;
        const inputWidth = 240;

        this.inputEl = document.createElement('input');
        this.inputEl.type = 'text';
        this.inputEl.placeholder = 'Your username here';

        Object.assign(this.inputEl.style, {
            position: 'absolute',
            left: `${centerXOnScreen - inputWidth / 2}px`,
            top: `${rect.top + inputY - 20}px`,
            width: `${inputWidth}px`,
            padding: '10px',
            fontSize: '18px',
            textAlign: 'center',
            borderRadius: '6px',
            border: '2px solid #1e90ff',
            boxSizing: 'border-box',
        });

        document.body.appendChild(this.inputEl);
    }

    submitUsername() {
        const raw = this.inputEl.value.trim();
        const username = raw || 'Player'; 
        savePlayerName(username);
        this.inputEl.remove();

        const playerId = getOrCreatePlayerId();
        // Listen ONCE for ack before emitting to avoid stacking handlers
        const onAck = () => {                           
            EventBus.off('username-set', onAck);         
            this.scene.start('MainMenu');                
        };                                              
        EventBus.on('username-set', onAck);             

        // IMPORTANT: backend expects { playerId, username }
        sendSetUsername({ playerId, username });     
    }

    handleResize(gameSize: Phaser.Structs.Size) {
    const { width, height } = gameSize;
    if (!this.scene.isActive()) return;

    resizeSceneBase(this, width, height);
    const { x: centerX } = getCenter(this.scale);
    const titleSize = getResponsiveFontSize(width, height, 72, 56);

    this.title1.setFontSize(titleSize);
    this.title2.setFontSize(titleSize);
    this.title1.setPosition(centerX, height * (1 / 6));
    this.title2.setPosition(centerX, this.title1.y + this.title1.height);
    this.confirmButton.setPosition(centerX, height * (5 / 6));

    if (this.inputEl) {
        requestAnimationFrame(() => {
            const rect = this.game.canvas.getBoundingClientRect();
            const centerXOnScreen = rect.left + rect.width / 2;
            const inputWidth = 240;
            this.inputEl.style.left = `${centerXOnScreen - inputWidth / 2}px`;
            this.inputEl.style.top = `${rect.top + height * (1 / 2) - 20}px`;
        });
    }
}
}
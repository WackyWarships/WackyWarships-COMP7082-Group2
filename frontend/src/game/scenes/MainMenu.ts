import { GameObjects, Scene } from 'phaser';
import EventBus from '../EventBus';
import { clearPlayerName, getStoredPlayerName } from '../utils/playerUsername';
import {
    getCenter,
    isMobile,
    getResponsiveFontSize,
    resizeSceneBase
} from '../utils/layout';

export class MainMenu extends Scene {
    background!: GameObjects.Image;
    titleTop!: GameObjects.Text;
    titleBottom!: GameObjects.Text;
    usernameText!: GameObjects.Text;
    menuContainer!: Phaser.GameObjects.Container;

    constructor() {
        super('MainMenu');
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
        const fontSizeTop = getResponsiveFontSize(width, height, 72, 56);
        const fontSizeBottom = getResponsiveFontSize(width, height, 72, 56);

        this.titleTop = this.add.text(centerX, height * 0.12, 'Wacky', {
            fontFamily: 'Arial Black',
            fontSize: `${fontSizeTop}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
        }).setOrigin(0.5);

        this.titleBottom = this.add.text(centerX, height * 0.21, 'Warships', {
            fontFamily: 'Arial Black',
            fontSize: `${fontSizeBottom}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
        }).setOrigin(0.5);

        // Current Username
        const playerName = getStoredPlayerName();
        const usernameFontSize = getResponsiveFontSize(width, height, 28, 22);

        this.usernameText = this.add.text(width - 20, 20, `Username: ${playerName}`, {
            fontFamily: 'Arial',
            fontSize: `${usernameFontSize}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'right',
        }).setOrigin(1, 0);

        // Menu Container
        this.menuContainer = this.add.container(centerX, height * 0.55);

        const buttonStyle = {
            fontFamily: 'Arial',
            fontSize: `${mobile ? 24 : 32}px`,
            color: '#ffffff',
            backgroundColor: '#1e90ff',
            padding: { x: 20, y: 10 },
            align: 'center',
            fixedWidth: mobile ? 260 : 300,
        };

        const makeButton = (
            label: string, 
            yOffset: number, 
            action: string | (() => void)
        ) => {
            const btn = this.add.text(0, yOffset, label, buttonStyle)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            const onClick = typeof action === 'string'
                ? () => this.scene.start(action)
                : action;

            btn
                .on('pointerdown', onClick)
                .on('pointerover', () => btn.setStyle({ backgroundColor: '#63b3ff' }))
                .on('pointerout', () => btn.setStyle({ backgroundColor: '#1e90ff' }));
            
            this.menuContainer.add(btn);
        };

        // Create all buttons
        makeButton('Create Lobby', -90, 'CreateLobby');
        makeButton('Join Lobby', -30, 'JoinLobby');
        makeButton('How to Play', 30, 'HowToPlay');
        makeButton('Settings', 90, 'Settings');
        makeButton('Credits', 150, 'Credits');
        makeButton(
            'Play Mini-Game',
            210, 
            () => { this.scene.start('FuelSortGame', { difficulty: "easy" }) }
        );
        makeButton(
            'Change Username',
            270, 
            () => {
                clearPlayerName();
                this.scene.start('EnterUsername');
            }
        );
        makeButton('Start Battle', 330, 'Game');

        // Handle resizing
        this.scale.on('resize', this.handleResize, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
        });

        EventBus.emit('current-scene-ready', this);
    }

    handleResize(gameSize: Phaser.Structs.Size) {
        // If this is not the current scene, ignore this resize
        if (!this.background || !this.scene.isActive()) return;

        const { width, height } = gameSize;

        resizeSceneBase(this, width, height);

        const { x: centerX } = getCenter(this.scale);

        const fontSizeTop = getResponsiveFontSize(width, height, 72, 56);
        const fontSizeBottom = getResponsiveFontSize(width, height, 72, 56);
        const usernameFontSize = getResponsiveFontSize(width, height, 28, 22);

        this.titleTop.setFontSize(fontSizeTop);
        this.titleBottom.setFontSize(fontSizeBottom);

        // Reposition dynamic elements
        this.titleTop.setPosition(centerX, height * 0.12);
        this.titleBottom.setPosition(centerX, height * 0.21);
        this.menuContainer.setPosition(centerX, height * 0.55);

        this.usernameText
            .setFontSize(usernameFontSize)
            .setPosition(width - 20, 20);
    }
}

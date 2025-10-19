import { GameObjects, Scene } from 'phaser';
import EventBus from '../EventBus';

export class MainMenu extends Scene {
    background!: GameObjects.Image;
    titleTop!: GameObjects.Text;
    titleBottom!: GameObjects.Text;
    menuContainer!: Phaser.GameObjects.Container;

    constructor() {
        super('MainMenu');
    }

    create() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        const isMobile = width < 700;
        const fontSizeTop = isMobile ? 56 : 72;
        const fontSizeBottom = isMobile ? 56 : 72;

        // Background
        this.background = this.add.image(centerX, centerY, 'background')
            .setDisplaySize(width, height)
            .setOrigin(0.5);

        // Title 
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

        // Menu Container 
        this.menuContainer = this.add.container(centerX, height * 0.55);

        const buttonStyle = {
            fontFamily: 'Arial',
            fontSize: `${isMobile ? 26 : 34}px`,
            color: '#ffffff',
            backgroundColor: '#1e90ff',
            padding: { x: 20, y: 10 },
            align: 'center',
            fixedWidth: isMobile ? 260 : 300,
        };

        const makeButton = (label: string, yOffset: number, sceneKey: string) => {
            const btn = this.add.text(0, yOffset, label, buttonStyle)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.scene.start(sceneKey))
                .on('pointerover', () => btn.setStyle({ backgroundColor: '#63b3ff' }))
                .on('pointerout', () => btn.setStyle({ backgroundColor: '#1e90ff' }));

            this.menuContainer.add(btn);
        };

        makeButton('Create Lobby', -90, 'CreateLobby');
        makeButton('Join Game', -30, 'JoinGame');
        makeButton('How to Play', 30, 'HowToPlay');
        makeButton('Settings', 90, 'Settings');
        makeButton('Credits', 150, 'Credits');

        // --- Handle resizing ---
        this.scale.on('resize', this.handleResize, this);

        EventBus.emit('current-scene-ready', this);
    }

    handleResize(gameSize: Phaser.Structs.Size) {
        const { width, height } = gameSize;
        this.cameras.resize(width, height);
        this.background.setDisplaySize(width, height).setPosition(width / 2, height / 2);

        const centerX = width / 2;
        const isMobile = width < 700;
        const isVeryTall = height > width * 1.5;

        const fontSizeTop = isMobile ? (isVeryTall ? 48 : 56) : 72;
        const fontSizeBottom = isMobile ? (isVeryTall ? 48 : 56) : 72;

        this.titleTop.setFontSize(fontSizeTop).setPosition(centerX, height * 0.12);
        this.titleBottom.setFontSize(fontSizeBottom).setPosition(centerX, height * 0.21);

        this.menuContainer.setPosition(centerX, height * 0.55);
    }
}

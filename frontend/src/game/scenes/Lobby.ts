import { Scene, GameObjects } from 'phaser';
import EventBus from '../EventBus';
import { getCenter, isMobile, getResponsiveFontSize, resizeSceneBase } from '../utils/layout';
import { getStoredPlayerName } from '../utils/playerUsername';
import type { LobbyUpdate, PlayerId, PlayerInfo, HostInfo } from 'shared/types';
import { sendStartGame } from '../../api/socket';

type LobbyInitData = {
    lobbyId: string;
    playerId: PlayerId;
    lobbyName: string;
    host?: HostInfo;
    players?: PlayerInfo[];
};

export class Lobby extends Scene {
    background!: GameObjects.Image;
    title!: GameObjects.Text;
    codeLabel!: GameObjects.Text;
    playersTitle!: GameObjects.Text;
    playerTexts: GameObjects.Text[] = [];
    startButton?: GameObjects.Text;

    lobbyId!: string;
    playerId!: PlayerId;
    lobbyName!: string;
    hostId!: PlayerId;
    hostName!: string;
    players: PlayerInfo[] = [];

    constructor() {
        super('Lobby');
    }

    init(data: LobbyInitData) {
        this.lobbyId = data.lobbyId;
        this.playerId = data.playerId;
        this.lobbyName = data.lobbyName;
        if (data.host) { this.hostId = data.host.hostId; this.hostName = data.host.hostName; }
        if (data.players) this.players = data.players;
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
        const titleSize = getResponsiveFontSize(width, height, 56, 44);
        this.title = this.add.text(centerX, height * 0.10, `Lobby: ${this.lobbyName}`, {
            fontFamily: 'Arial Black',
            fontSize: `${titleSize}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
        }).setOrigin(0.5);

        // Lobby Code
        const codeSize = getResponsiveFontSize(width, height, 36, 28);
        this.codeLabel = this.add.text(centerX, height * 0.20, `Code: ${this.lobbyId.slice(0, 6)}`, {
            fontFamily: 'Arial Black',
            fontSize: `${codeSize}px`,
            color: '#ffeb3b',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
        }).setOrigin(0.5);

        // Player List
        const listHeaderSize = getResponsiveFontSize(width, height, 28, 22);
        this.playersTitle = this.add.text(centerX, height * 0.30, 'Players', {
            fontFamily: 'Arial Black',
            fontSize: `${listHeaderSize}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
        }).setOrigin(0.5);

        // Start Button
        const btnFontSize = `${mobile ? 26 : 32}px`;
        this.startButton = this.add.text(centerX, height * 0.85, 'Start Game', {
            fontFamily: 'Arial',
            fontSize: btnFontSize,
            color: '#ffffff',
            backgroundColor: '#1e90ff',
            padding: { x: 20, y: 10 },
            align: 'center',
            fixedWidth: mobile ? 220 : 260,
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.handleStartGame())
            .on('pointerover', () => this.startButton?.setStyle({ backgroundColor: '#63b3ff' }))
            .on('pointerout', () => this.startButton?.setStyle({ backgroundColor: '#1e90ff' }));

        // Initial start button visibility (hide for non-host or unknown host)
        const isHostInitial = this.hostId ? (this.playerId === this.hostId) : false;
        this.startButton.setVisible(isHostInitial).setActive(isHostInitial);

        // Render any initial state passed in (e.g., first lobbyUpdate)
        if (this.players.length > 0) {
            this.renderPlayers();
        }

        // Subscribe to lobby updates
        EventBus.on('lobby-update', this.onLobbyUpdate);

        // Resize handling
        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            EventBus.off('lobby-update', this.onLobbyUpdate);
            this.scale.off('resize', this.handleResize, this);
        });
    }

    private onLobbyUpdate = (lu: LobbyUpdate) => {
        if (lu.lobbyId !== this.lobbyId) return;
        this.hostId = lu.host.hostId;
        this.hostName = lu.host.hostName;
        this.players = lu.players;

        this.renderPlayers();

        if (this.startButton) {
            const isHost = this.playerId === this.hostId;
            this.startButton.setVisible(isHost).setActive(isHost);
        }
    };

    private renderPlayers() {
        this.playerTexts.forEach(t => t.destroy());
        this.playerTexts = [];

        const { width, height } = this.scale;
        const { x: centerX } = getCenter(this.scale);
        const itemSize = getResponsiveFontSize(width, height, 26, 20);
        const startY = height * 0.36;
        const lineHeight = itemSize + 10;

        const myName = getStoredPlayerName() || 'You';
        const short = (id: string) => id.slice(0, 8);

        this.players.forEach((p, idx) => {
            const pid = p.playerId;
            const isHost = pid === this.hostId;
            const isMe = pid === this.playerId;
            const icon = isHost ? '★ ' : '• ';
            const name = isMe
                ? (isHost ? `${this.hostName} (You)` : `${myName} (You)`)
                : (isHost ? this.hostName : (p.playerName || `Player ${short(pid)}`));

            const text = this.add.text(centerX, startY + idx * lineHeight, `${icon}${name}`, {
                fontFamily: 'Arial',
                fontSize: `${itemSize}px`,
                color: isHost ? '#ffeb3b' : '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center',
            }).setOrigin(0.5);

            this.playerTexts.push(text);
        });
    }

    private handleStartGame() {
        if (this.playerId !== this.hostId) return;
        sendStartGame({ lobbyId: this.lobbyId });
    }

    handleResize(gameSize: Phaser.Structs.Size) {
        if (!this.scene.isActive()) return;
        const { width, height } = gameSize;
        resizeSceneBase(this, width, height);
        const { x: centerX } = getCenter(this.scale);

        const titleSize = getResponsiveFontSize(width, height, 56, 44);
        const codeSize = getResponsiveFontSize(width, height, 36, 28);
        const listHeaderSize = getResponsiveFontSize(width, height, 28, 22);

        this.title.setFontSize(titleSize).setPosition(centerX, height * 0.10);
        this.codeLabel.setFontSize(codeSize).setPosition(centerX, height * 0.20);
        this.playersTitle.setFontSize(listHeaderSize).setPosition(centerX, height * 0.30);
        this.startButton?.setPosition(centerX, height * 0.85);

        this.renderPlayers();
    }
}

export default Lobby;

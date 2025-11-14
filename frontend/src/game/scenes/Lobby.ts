import { Scene, GameObjects } from 'phaser';
import EventBus from '../EventBus';
import { getCenter, isMobile, getResponsiveFontSize, resizeSceneBase } from '../utils/layout';
import { getStoredPlayerName } from '../utils/playerUsername';
import type { LobbyUpdate, PlayerId, PlayerInfo, HostInfo } from 'shared/types';
import { sendStartGame, sendLeaveLobby, sendKickPlayer, sendDisbandLobby } from '../../api/socket';

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
    leaveButton?: GameObjects.Text;
    disbandButton?: GameObjects.Text;
    kickButtons: GameObjects.Text[] = [];

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
        this.background = this.add.image(centerX, centerY, 'spacebackground')
          .setDisplaySize(height*0.46, height)
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

        // Leave Button (players only)
        this.leaveButton = this.add.text(centerX, height * 0.90, 'Leave Lobby', {
            fontFamily: 'Arial',
            fontSize: `${mobile ? 22 : 26}px`,
            color: '#ffffff',
            backgroundColor: '#444444',
            padding: { x: 16, y: 8 },
            align: 'center',
            fixedWidth: mobile ? 200 : 220,
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.handleLeaveLobby())
            .on('pointerover', () => this.leaveButton?.setStyle({ backgroundColor: '#666666' }))
            .on('pointerout', () => this.leaveButton?.setStyle({ backgroundColor: '#444444' }));

        // Disband Button (host only)
        this.disbandButton = this.add.text(centerX, height * 0.95, 'Disband Lobby', {
            fontFamily: 'Arial',
            fontSize: `${mobile ? 20 : 24}px`,
            color: '#ffffff',
            backgroundColor: '#a52a2a',
            padding: { x: 16, y: 6 },
            align: 'center',
            fixedWidth: mobile ? 200 : 240,
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.handleDisbandLobby())
            .on('pointerover', () => this.disbandButton?.setStyle({ backgroundColor: '#c34242' }))
            .on('pointerout', () => this.disbandButton?.setStyle({ backgroundColor: '#a52a2a' }));

        const isHostInitial = this.hostId ? (this.playerId === this.hostId) : false;
        this.startButton.setVisible(isHostInitial).setActive(isHostInitial);
        this.leaveButton.setVisible(!isHostInitial).setActive(!isHostInitial);
        this.disbandButton.setVisible(isHostInitial).setActive(isHostInitial);

        // Render any initial state passed in (e.g., first lobbyUpdate)
        if (this.players.length > 0) {
            this.renderPlayers();
        }

        // Subscribe to lobby updates
        EventBus.on('lobby-update', this.onLobbyUpdate);

        // Moderation notices
        const onKicked = (n: any) => {
            if (n && n.lobbyId === this.lobbyId && n.targetPlayerId === this.playerId) {
                this.scene.start('MainMenu');
            }
        };
        const onDisbanded = (n: any) => {
            if (n && n.lobbyId === this.lobbyId) {
                this.scene.start('MainMenu');
            }
        };
        EventBus.on('player-kicked', onKicked as any);
        EventBus.on('lobby-disbanded', onDisbanded as any);

        // Resize handling
        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            EventBus.off('lobby-update', this.onLobbyUpdate);
            EventBus.off('player-kicked', onKicked as any);
            EventBus.off('lobby-disbanded', onDisbanded as any);
            this.scale.off('resize', this.handleResize, this);
        });
    }

    private onLobbyUpdate = (lu: LobbyUpdate) => {
        if (lu.lobbyId !== this.lobbyId) return;

        this.hostId = lu.host.hostId;
        this.hostName = lu.host.hostName;
        this.players = lu.players;

        this.renderPlayers();

        const isHost = this.playerId === this.hostId;

        if (this.startButton) {
            this.startButton.setVisible(isHost).setActive(isHost);
        }

        if (this.leaveButton) {
            this.leaveButton.setVisible(!isHost).setActive(!isHost);
        }

        if (this.disbandButton) {
            this.disbandButton.setVisible(isHost).setActive(isHost);
        }
    };

    private renderPlayers() {
        // Clear previous text objects
        this.playerTexts.forEach(t => t.destroy());
        this.kickButtons.forEach(b => b.destroy());
        this.playerTexts = [];
        this.kickButtons = [];

        const { width, height } = this.scale;
        const { x: centerX } = getCenter(this.scale);
        const itemSize = getResponsiveFontSize(width, height, 26, 20);
        const startY = height * 0.36;
        const lineHeight = itemSize + 10;

        const localName = getStoredPlayerName() || 'You';
        const short = (id: string) => id.slice(0, 8);

        // Find yourself in the latest server update
        const me = this.players.find(p => p.playerId === this.playerId);
        // Server’s displayed name, fallback to local name
        const displayName = me?.playerName || localName;

        this.players.forEach((p, idx) => {
            const pid = p.playerId;
            const isHost = pid === this.hostId;
            const isMe = pid === this.playerId;
            const icon = isHost ? '★ ' : '• ';

            // Use server name for everyone, but only label yourself with (You)
            const name = isMe
                ? `${displayName} (You)`
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

            // Add kick button (only visible for host, not on mobile)
            const mobile = isMobile(width);
            const offsetX = mobile ? 70 : 180;

            if (this.playerId === this.hostId && !isHost && !isMe) {
                const kick = this.add.text(centerX + offsetX, startY + idx * lineHeight, 'Kick', {
                    fontFamily: 'Arial',
                    fontSize: `${Math.max(16, itemSize - 6)}px`,
                    color: '#ffffff',
                    backgroundColor: '#a52a2a',
                    padding: { x: 8, y: 4 },
                    align: 'center',
                })
                    .setOrigin(0.5)
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.handleKick(pid))
                    .on('pointerover', () => kick.setStyle({ backgroundColor: '#c34242' }))
                    .on('pointerout', () => kick.setStyle({ backgroundColor: '#a52a2a' }));

                this.kickButtons.push(kick);
            }
        });
    }

    private handleStartGame() {
        if (this.playerId !== this.hostId) return;
        sendStartGame({ lobbyId: this.lobbyId });
    }

    private handleLeaveLobby() {
        const playerName = getStoredPlayerName() || 'Player';
        sendLeaveLobby({ lobbyId: this.lobbyId, playerId: this.playerId, playerName });
        this.scene.start('MainMenu');
    }

    private handleDisbandLobby() {
        if (this.playerId !== this.hostId) return;
        sendDisbandLobby({ lobbyId: this.lobbyId });
        this.scene.start('MainMenu');
    }

    private handleKick(targetPlayerId: PlayerId) {
        if (this.playerId !== this.hostId) return;
        sendKickPlayer({ lobbyId: this.lobbyId, targetPlayerId });
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
        this.leaveButton?.setPosition(centerX, height * 0.90);
        this.disbandButton?.setPosition(centerX, height * 0.95);

        this.renderPlayers();
    }
}

export default Lobby;

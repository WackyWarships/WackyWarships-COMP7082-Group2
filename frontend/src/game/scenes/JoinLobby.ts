import { Scene } from 'phaser';
import EventBus from '../EventBus';
import {
    getCenter,
    isMobile,
    getResponsiveFontSize,
    resizeSceneBase
} from '../utils/layout';
import { getStoredPlayerName } from '../utils/playerUsername';
import {
    sendJoinLobby,
    getPlayerId
} from '../../api/socket';
import {
    JoinLobbyEvent,
    LobbyUpdate,
    Lobby
} from 'shared/types';

export class JoinLobby extends Scene {
    background!: Phaser.GameObjects.Image;
    title!: Phaser.GameObjects.Text;
    codeInput?: HTMLInputElement;
    joinButton!: Phaser.GameObjects.Text;
    backButton!: Phaser.GameObjects.Text;
    errorText?: Phaser.GameObjects.Text;

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

        // Error message (hidden by default)
        this.errorText = this.add.text(centerX, height * 0.75, '', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ff6b6b',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
        }).setOrigin(0.5).setVisible(false);

        // Handle resizing 
        this.scale.on('resize', this.handleResize, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
            this.codeInput?.remove();
            this.codeInput = undefined;
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

    async handleJoinClick() {
        const partialCode = this.codeInput?.value?.trim();
        if (!partialCode || partialCode.length < 1) {
            this.showError('Please enter a lobby code.');
            return;
        }

        const playerId = getPlayerId();
        const playerName = getStoredPlayerName();
        if (!playerName) {
            this.scene.start('EnterUsername');
            return;
        }

        // Find lobby by matching first 6 characters of the lobbyId
        let targetLobby: Lobby | undefined;
        try {
            console.log("[JoinLobby] Fetching lobbies from /api/lobbies...");
            const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
            const res = await fetch(`${backendUrl}/api/lobbies`);

            console.log("[JoinLobby] Response status:", res.status);

            if (!res.ok) {
                console.error("[JoinLobby] Fetch failed. Response not OK.");
                throw new Error('Failed to fetch lobbies');
            }

            const lobbies = (await res.json()) as Lobby[];
            console.log("[JoinLobby] Received lobbies:", lobbies);

            targetLobby = lobbies.find(l => l.lobbyId.startsWith(partialCode));
            console.log("[JoinLobby] Matching lobby:", targetLobby);

        } catch (e) {
            console.error("[JoinLobby] Error fetching lobbies:", e);
            this.showError('Unable to check lobby code. Try again.');
            return;
        }

        if (!targetLobby) {
            this.showError('Lobby code not found.');
            return;
        }

        const payload: JoinLobbyEvent = {
            lobbyId: targetLobby.lobbyId,
            playerId: playerId,
            playerName: playerName
        };

        // Clear any previous error
        this.showError('', false);

        sendJoinLobby(payload);

        const onUpdate = (update: LobbyUpdate) => {
            if (update.lobbyId !== targetLobby!.lobbyId) return;
            if (update.players.some(p => p.playerId === getPlayerId())) {
                if (this.codeInput) {
                    this.codeInput.remove();
                    this.codeInput = undefined;
                }
                this.scene.start('Lobby', {
                    lobbyId: update.lobbyId,
                    playerId,
                    lobbyName: update.lobbyName ?? 'Lobby',
                    host: update.host,
                    players: update.players,
                });
                EventBus.off('lobby-update', onUpdate);
                EventBus.off('error', onError as any);
            }
        };

        const onError = (err: { code?: number; message?: string }) => {
            // Show only if it relates to this lobby attempt
            if (err && typeof err.message === 'string' && err.message.includes(targetLobby!.lobbyId)) {
                this.showError('Failed to join lobby. It may no longer exist.');
                EventBus.off('lobby-update', onUpdate);
                EventBus.off('error', onError as any);
            }
        };

        EventBus.on('lobby-update', onUpdate);
        EventBus.on('error', onError as any);
    }

    private showError(msg: string, visible: boolean = true) {
        if (!this.errorText) return;
        this.errorText.setText(msg).setVisible(visible);
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
        this.errorText?.setPosition(centerX, height * 0.75);

    }
}

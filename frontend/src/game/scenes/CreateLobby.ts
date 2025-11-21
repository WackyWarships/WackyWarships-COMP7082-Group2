import { Scene, GameObjects } from "phaser";
import EventBus from "../EventBus";
import type { LobbyUpdate } from "shared/types";
import { getStoredPlayerName } from "../utils/playerUsername";
import { saveSession } from "../utils/playerSession";
import {
    getCenter,
    isMobile,
    getResponsiveFontSize,
    resizeSceneBase,
} from "../utils/layout";

import { CreateLobbyEvent } from "shared/types";
import { getPlayerId, sendCreateLobby } from "../../api/socket";

export class CreateLobby extends Scene {
    background!: GameObjects.Image;
    title!: GameObjects.Text;
    nameInput?: HTMLInputElement;
    createButton!: GameObjects.Text;
    backButton!: GameObjects.Text;

    constructor() {
        super("CreateLobby");
    }

    create() {
        const { width, height } = this.scale;
        const { x: centerX, y: centerY } = getCenter(this.scale);
        const mobile = isMobile(width);

        saveSession({
            lobbyId: null,
            scene: "CreateLobby",
            timestamp: Date.now(),
        });

        // Background
        this.background = this.add
          .image(centerX, centerY, "spacebackground")
          .setDisplaySize(height * 1.12, height)
          .setOrigin(0.5);

        // Title
        const titleFontSize = getResponsiveFontSize(width, height, 50, 32);
        this.title = this.add
            .text(centerX, height * 0.15, "Create\nLobby", {
                fontFamily: "Orbitron",
                fontSize: `${titleFontSize}px`,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 8,
                align: "center",
            })
            .setOrigin(0.5);

        // Input Field
        this.createLobbyNameInput();

        // Buttons
        const buttonStyle = {
            fontFamily: "Orbitron",
            fontSize: `${mobile ? 26 : 34}px`,
            color: "#ffffff",
            backgroundColor: "#262079",
            padding: { x: 20, y: 10 },
            align: "center",
            fixedWidth: mobile ? 190 : 250,
        };

        this.createButton = this.add
            .text(centerX, height * 0.55, "Create", buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerdown", () => this.handleCreateClick())
            .on("pointerover", () =>
                this.createButton.setStyle({ backgroundColor: "#63b3ff" })
            )
            .on("pointerout", () =>
                this.createButton.setStyle({ backgroundColor: "#262079" })
            );

        this.backButton = this.add
            .text(centerX, height * 0.65, "Back", {
                ...buttonStyle,
                backgroundColor: "#5555ff",
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerdown", () => this.scene.start("MainMenu"))
            .on("pointerover", () =>
                this.backButton.setStyle({ backgroundColor: "#7a7aff" })
            )
            .on("pointerout", () =>
                this.backButton.setStyle({ backgroundColor: "#5555ff" })
            );

        // Handle resizing
        this.scale.on("resize", this.handleResize, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off("resize", this.handleResize, this);
        });

        // Cleanup input on shutdown
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (this.nameInput) {
                this.nameInput.remove();
                this.nameInput = undefined;
            }
        });

        EventBus.emit("current-scene-ready", this);
    }

    // Input creation
    createLobbyNameInput() {
        this.nameInput = document.createElement("input");
        this.nameInput.type = "text";
        this.nameInput.placeholder = "Enter lobby name...";

        Object.assign(this.nameInput.style, {
            position: "absolute",
            background: "white",
            color: "black",
            border: "2px solid #262079",
            borderRadius: "6px",
            padding: "10px",
            width: "240px",
            height: "32px",
            fontSize: "18px",
            outline: "none",
            textAlign: "center",
            zIndex: "10",
            pointerEvents: "auto",
        });
        
        this.nameInput.addEventListener('blur', function() {
            const app = document.getElementById("game-container");
            if (app) {
                const rect = app.getBoundingClientRect();
                const centerXOnScreen = rect.left + rect.width / 2;
                this.style.top = `${rect.height * 0.4}px`;
                this.style.left = `${centerXOnScreen - 120}px`;
            }
        });
        
        this.nameInput.addEventListener('focus', function() {
            const app = document.getElementById("game-container");
            if (app) {
                const rect = app.getBoundingClientRect();
                const centerXOnScreen = rect.left + rect.width / 2;
                this.style.top = `${rect.height * 0.4}px`;
                this.style.left = `${centerXOnScreen - 120}px`;
            }
        });

        document.body.appendChild(this.nameInput);

        this.updateInputPosition();
    }

    // Correct input placement relative to canvas
    private updateInputPosition() {
        if (!this.nameInput) return;

        const rect = this.game.canvas.getBoundingClientRect();
        const centerXOnScreen = rect.left + rect.width / 2;

        this.nameInput.style.left = `${centerXOnScreen - 120}px`;
        this.nameInput.style.top = `${rect.height * 0.4}px`;
    }

    handleCreateClick() {
        const playerId = getPlayerId();
        const hostName = getStoredPlayerName();
        const lobbyName = (this.nameInput?.value ?? "").trim() || "My Lobby";

        if (!hostName) {
            this.scene.start("EnterUsername");
            return;
        }

        const payload: CreateLobbyEvent = {
            hostName: hostName,
            hostId: playerId,
            lobbyName: lobbyName,
        };

        sendCreateLobby(payload);

        const handler = (update: LobbyUpdate) => {
            if (update.host.hostId === playerId) {
                if (this.nameInput) {
                    this.nameInput.remove();
                    this.nameInput = undefined;
                }
                this.scene.start("Lobby", {
                    lobbyId: update.lobbyId,
                    playerId,
                    host: update.host,
                    lobbyName: update.lobbyName ?? lobbyName,
                    players: update.players,
                });
                EventBus.off("lobby-update", handler);
            }
        };

        EventBus.on("lobby-update", handler);
    }

    handleResize(gameSize: Phaser.Structs.Size) {
        // If this is not the current scene, ignore this resize
        if (!this.background || !this.scene.isActive()) return;

        const { width, height } = gameSize;
        resizeSceneBase(this, width, height);

        const { x: centerX } = getCenter(this.scale);

        // Reposition elements
        this.title.setPosition(centerX, height * 0.15);
        this.createButton.setPosition(centerX, height * 0.55);
        this.backButton.setPosition(centerX, height * 0.65);

        this.updateInputPosition();
    }
}

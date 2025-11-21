// src/game/scenes/EnterUsername.ts
import { Scene, GameObjects } from "phaser";
import { savePlayerName, getOrCreatePlayerId } from "../utils/playerUsername";
import { sendSetUsername } from "../../api/socket";
import EventBus from "../EventBus";
import { saveSession } from "../utils/playerSession";
import {
    getCenter,
    isMobile,
    getResponsiveFontSize,
    resizeSceneBase,
} from "../utils/layout";

export class EnterUsername extends Scene {
    background!: GameObjects.Image;
    title1!: GameObjects.Text;
    title2!: GameObjects.Text;
    confirmButton!: GameObjects.Text;
    inputEl!: HTMLInputElement;
    errorText!: GameObjects.Text;

    constructor() {
        super("EnterUsername");
    }

    create() {
        const { width, height } = this.scale;
        const { x: centerX } = getCenter(this.scale);
        const mobile = isMobile(width);

        saveSession({
            lobbyId: null,
            scene: "EnterUsername",
            timestamp: Date.now(),
        });

        // Background
        this.background = this.add
            .image(centerX, height / 2, "spacebackground")
            .setDisplaySize(height * 1.12, height)
            .setOrigin(0.5);

        // Titles
        const titleSize = getResponsiveFontSize(width, height, 50, 32);
        this.title1 = this.add
            .text(centerX, height * (1 / 6), "Enter Your", {
                fontFamily: "Orbitron",
                fontSize: `${titleSize}px`,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 8,
                align: "center",
            })
            .setOrigin(0.5);

        this.title2 = this.add
            .text(centerX, this.title1.y + this.title1.height, "Username!", {
                fontFamily: "Orbitron",
                fontSize: `${titleSize}px`,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 8,
                align: "center",
            })
            .setOrigin(0.5);

        // Input
        this.createInput(height * 0.5);

        // Error line (hidden by default)
        const errorY = Math.min(height * 0.75, height - 40);
        this.errorText = this.add
            .text(width / 2, errorY, "", {
                fontFamily: "Orbitron",
                fontSize: `${mobile ? 18 : 20}px`,
                color: "#ff5555",
                align: "center",
                wordWrap: { width: width * 0.8 },
            })
            .setOrigin(0.5)
            .setVisible(false);

        // Confirm button
        const buttonStyle = {
            fontFamily: "Orbitron",
            fontSize: `${mobile ? 26 : 32}px`,
            color: "#ffffff",
            backgroundColor: "#262079",
            padding: { x: 20, y: 10 },
            align: "center" as const,
            fixedWidth: mobile ? 220 : 260,
        };

        this.confirmButton = this.add
            .text(centerX, height * (5 / 6), "Confirm", buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerdown", () => this.submitUsername())
            .on("pointerover", () =>
                this.confirmButton.setStyle({ backgroundColor: "#63b3ff" })
            )
            .on("pointerout", () =>
                this.confirmButton.setStyle({ backgroundColor: "#262079" })
            );

        // Resize + cleanup
        this.scale.on("resize", this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off("resize", this.handleResize, this);
            if (this.inputEl) this.inputEl.remove();
        });
    }

    private createInput(inputY: number) {
        const rect = this.game.canvas.getBoundingClientRect();
        const centerXOnScreen = rect.left + rect.width / 2;
        const inputWidth = 240;

        this.inputEl = document.createElement("input");
        this.inputEl.type = "text";
        this.inputEl.placeholder = "Your username...";

        Object.assign(this.inputEl.style, {
            position: "absolute",
            left: `${centerXOnScreen - inputWidth / 2}px`,
            top: `${rect.top + inputY - 20}px`,
            width: `${inputWidth}px`,
            padding: "10px",
            fontSize: "18px",
            textAlign: "center",
            borderRadius: "6px",
            border: "2px solid #262079",
            boxSizing: "border-box",
        } as CSSStyleDeclaration);
        
        this.inputEl.addEventListener('blur', function() {
            const app = document.getElementById("app");
            if (app) {
                const rect = app.getBoundingClientRect();
                const centerXOnScreen = rect.left + rect.width / 2;
                this.style.top = `${rect.height * 0.4}px`;
                this.style.left = `${centerXOnScreen - 120}px`;
            }
        });
        
        this.inputEl.addEventListener('focus', function(event) {
            const app = document.getElementById("app");
            if (app) {
                const rect = app.getBoundingClientRect();
                const centerXOnScreen = rect.left + rect.width / 2;
                this.style.top = `${rect.height * 0.4}px`;
                this.style.left = `${centerXOnScreen - 120}px`;
            }
        });

        document.body.appendChild(this.inputEl);
    }

    private submitUsername() {
        const playerName = (this.inputEl?.value ?? "").trim();
        const playerId = getOrCreatePlayerId();

        // Validation
        if (playerName.length === 0) {
            this.showError("Username cannot be empty.");
            return;
        }
        const USERNAME_REGEX = /^[A-Za-z0-9 _-]{3,16}$/;
        if (!USERNAME_REGEX.test(playerName)) {
            this.showError(
                'Only letters, numbers, spaces, "_" and "-" allowed (3–16 chars).'
            );
            return;
        }
        this.showError("");

        // Save locally and send to server
        savePlayerName(playerName);
        this.inputEl?.remove();

        // One-time wait for ack (use on/off instead of once)
        const onAck = () => {
            EventBus.off("username-set", onAck);
            this.scene.start("MainMenu");
        };
        EventBus.on("username-set", onAck);

        // SetUsernameEvent expects { playerId, playerName }
        sendSetUsername({ playerId, playerName });
    }

    private showError(msg: string) {
        if (!this.errorText) return;
        this.errorText.setText(msg).setVisible(!!msg);
    }

    private handleResize(gameSize: Phaser.Structs.Size) {
        const { width, height } = gameSize;
        if (!this.scene.isActive()) return;

        resizeSceneBase(this, width, height);
        const { x: centerX } = getCenter(this.scale);
        const titleSize = getResponsiveFontSize(width, height, 50, 32);

        this.title1
            .setFontSize(titleSize)
            .setPosition(centerX, height * (1 / 6));
        this.title2
            .setFontSize(titleSize)
            .setPosition(centerX, this.title1.y + this.title1.height);
        this.confirmButton.setPosition(centerX, height * (5 / 6));

        if (this.inputEl) {
            requestAnimationFrame(() => {
                const rect = this.game.canvas.getBoundingClientRect();
                const centerXOnScreen = rect.left + rect.width / 2;
                const inputWidth = 240;
                this.inputEl.style.left = `${
                    centerXOnScreen - inputWidth / 2
                }px`;
                this.inputEl.style.top = `${rect.height * 0.4}px`;
            });
        }

        if (this.errorText) {
            const errorY = Math.min(height * 0.75, height - 40);
            this.errorText.setPosition(centerX, errorY);
        }
    }
}

export default EnterUsername;

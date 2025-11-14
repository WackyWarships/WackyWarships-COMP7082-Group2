import { Scene } from "phaser";
import { initSocket } from "../../api/socket";
import {
    getStoredPlayerName,
    getOrCreatePlayerId,
} from "../utils/playerUsername";
import { getLastSession, saveSession } from "../utils/playerSession";
import EventBus from "../EventBus";

export class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    preload() {
        // Minimal assets required before Preloader runs
        this.load.image("background", "assets/bg.png");
    }

    create() {
        initSocket();

        EventBus.on("turn-start", this.handleTurnStart);

        const session = getLastSession();
        const savedName = getStoredPlayerName();
        const playerId = getOrCreatePlayerId();

        if (session?.scene) {
            switch (session.scene) {
                case "EnterUsername":
                    return this.scene.start("EnterUsername");

                case "MainMenu":
                    return this.scene.start("MainMenu");

                case "CreateLobby":
                    return this.scene.start("CreateLobby");

                case "JoinLobby":
                    return this.scene.start("JoinLobby");

                case "Lobby":
                    return this.scene.start("Lobby", {
                        lobbyId: session.lobbyId,
                        playerId: getOrCreatePlayerId(),
                    });

                case "Game":
                    return this.scene.start("Game", {
                        lobbyId: session.lobbyId,
                        playerId,
                    });
            }
        }

        if (savedName) {
            this.scene.start("Preloader");
        } else {
            this.scene.start("EnterUsername");
        }
    }

    private handleTurnStart = (evt: any) => {
        const session = getLastSession();
        if (!session?.lobbyId) return;

        const playerId = getOrCreatePlayerId();
        const lobbyId = session.lobbyId;

        // Save updated session
        saveSession({
            lobbyId,
            scene: "Game",
            timestamp: Date.now(),
            lastKnownTurnId: evt.turnId,
        });

        // Start Game scene globally
        this.scene.start("Game", {
            lobbyId,
            playerId,
            turnStart: evt,
        });
    };
}

export default Boot;


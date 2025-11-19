import { Scene } from "phaser";
import { initSocket } from "../../api/socket";
import {
    getStoredPlayerName,
    getOrCreatePlayerId,
} from "../utils/playerUsername";
import { getLastSession } from "../utils/playerSession";

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
                        playerId,
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
}

export default Boot;

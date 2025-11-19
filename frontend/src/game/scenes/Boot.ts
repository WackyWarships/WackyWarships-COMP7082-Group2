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
        this.scene.start("Preloader");
    }
}

export default Boot;

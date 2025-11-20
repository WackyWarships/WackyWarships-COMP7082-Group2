import { Scene } from 'phaser';
import {
    getStoredPlayerName,
    getOrCreatePlayerId,
} from "../utils/playerUsername";
import { getLastSession } from "../utils/playerSession";

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    init() {
        const { width: W, height: H } = this.scale;
        // 'background' is assumed loaded by Boot; show it behind the loading bar
        this.add.image(W / 2, H / 2, 'background').setOrigin(0.5);

        // Progress bar frame
        this.add.rectangle(W / 2, H / 2, 468, 32).setStrokeStyle(1, 0xffffff).setOrigin(0.5);

        // Progress fill
        const bar = this.add.rectangle(W / 2 - 230, H / 2, 4, 28, 0xffffff).setOrigin(0.5);

        this.load.on('progress', (progress: number) => {
            // 100% = 460px
            bar.width = 4 + 460 * progress;
        });
    }

    preload() {
        // All files are relative to /assets
        this.load.setPath('assets');

        // --- Background ---
        this.load.image('spacebackground', 'spacebackground2.png');

        // Weapons
        this.load.image('weapon_easy', 'weapon_easy.png');
        this.load.image('weapon_medium', 'weapon_medium.png');
        this.load.image('weapon_hard', 'weapon_hard.png');

        // Base ship sprites
        this.load.image('redship', 'redship.png');
        this.load.image('blueship', 'blueship.png');

        // --- New variants for HP-state swapping ---
        // Enemy variants
        this.load.image('redship_dmg', 'redship_dmg.png'); // 20–69%
        this.load.image('redship_crit', 'redship_crit.png'); // <20%

        // Player variants
        this.load.image('blueship_dmg', 'blueship_dmg.png');   // 20–69%
        this.load.image('blueship_crit', 'blueship_crit.png');  // <20%

        // --- Impact FX (single-frame is fine) ---
        this.load.image('explosion', 'explosion.png');

        // --- UI icons used in Game (optional but recommended) ---
        this.load.image('home', 'home.svg');
        this.load.image('home_button', 'home.png');

        // Enemy destroyed
        this.load.image('redship_destroyed', 'redship_destroyed.png');
        // Player destroyed
        this.load.image('blueship_destroyed', 'blueship_destroyed.png');

        // Main Menu logo and title
        this.load.image('title_image', 'title_image.png');

        // If want to load the background here (instead of Boot), uncomment:
        // this.load.image('background', 'background.png');   
        
        // Load font
        this.load.font({
            key: "Orbitron",
            url: "fonts/Orbitron-Regular.ttf",
            format: "truetype"
        });
    }

    create() {
        // Define global animations here if you add an explosion spritesheet later.

        // Continue to main menu or previous session scene
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
            this.scene.start('MainMenu');
        } else {
            this.scene.start("EnterUsername");
        }
    }
}

export default Preloader;

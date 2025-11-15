import { Scene } from 'phaser';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    init() {
        // 'background' is assumed loaded by Boot; show it behind the loading bar
        this.add.image(512, 384, 'background');

        // Progress bar frame
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        // Progress fill
        const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff);

        this.load.on('progress', (progress: number) => {
            // 100% = 460px
            bar.width = 4 + 460 * progress;
        });
    }

    preload() {
        // All files are relative to /assets
        this.load.setPath('assets');

        // --- Existing ---
        this.load.image('logo', 'logo.png');
        this.load.image('star', 'star.png');
        this.load.image('laser', 'laser.png');
        this.load.image('rockets', 'rockets.png');
        this.load.image('spacebackground', 'spacebackground.png');

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

        // Enemy destroyed
        this.load.image('redship_destroyed', 'redship_destroyed.png');
        // Player destroyed
        this.load.image('blueship_destroyed', 'blueship_destroyed.png');

        // If want to load the background here (instead of Boot), uncomment:
        // this.load.image('background', 'background.png');
    }

    create() {
        // Define global animations here if you add an explosion spritesheet later.

        // Continue to main menu
        this.scene.start('MainMenu');
    }
}

export default Preloader;

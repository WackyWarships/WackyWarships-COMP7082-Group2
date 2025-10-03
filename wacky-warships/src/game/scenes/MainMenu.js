import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class MainMenu extends Scene
{
    logoTween;

    constructor ()
    {
        super('MainMenu');
    }

    create () {
        const { width: W, height: H } = this.scale;

        // Background
        this.bg = this.add.image(W/2, H/2, 'background')
            .setOrigin(0.5)
            .setDisplaySize(W, H);

        // Logo
        this.logo = this.add.image(W/2, H * 0.35, 'logo').setDepth(100);

        // --- NEW: scale logo relative to button width later ---
        // Just set an initial scale first
        this.logo.setScale(0.4);

        // START button
        this.startBtn = this.add.image(W/2 + 10, H * 0.65, 'start') // +80 = move right
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.changeScene());

        // Scale button to ~60% canvas width
        const btnTargetW = W * 0.6;
        this.startBtn.setScale(btnTargetW / this.startBtn.width);

        // --- NEW: resize logo to match button width ---
        this.logo.setScale(this.startBtn.displayWidth / this.logo.width);

        // header buttons
        const pad = 24;

        // HOME (top-left)
        // From Main Menu: go back in browser history; if none, stay here.
        // If you prefer always going to MainMenu, replace body with: this.scene.start('MainMenu')
        this.homeBtn = this.add.image(pad + 24, pad + 24, 'home')
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            if (window.history.length > 1) window.history.back();
        });

        // SETTINGS (top-right) → go to Settings scene
        this.settingsBtn = this.add.image(W - (pad + 24), pad + 24, 'settings')
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scene.start('Settings'));

        EventBus.emit('current-scene-ready', this);
        this.scale.on('resize', this.onResize, this);
    }

    onResize (gameSize) {
        const { width: W, height: H } = gameSize;

        this.bg.setPosition(W/2, H/2).setDisplaySize(W, H);

        // Re-align start button to the right
        this.startBtn.setPosition(W/2 + 10, H * 0.65);
        const btnTargetW = W * 0.6;
        this.startBtn.setScale(btnTargetW / this.startBtn.width);

        // Resize logo to match button width
        this.logo.setPosition(W/2, H * 0.35);
        this.logo.setScale(this.startBtn.displayWidth / this.logo.width);

        this.homeBtn.setPosition(24 + 24, 24 + 24);
        this.settingsBtn.setPosition(W - (24 + 24), 24 + 24);
    }




    changeScene ()
    {
        if (this.logoTween)
        {
            this.logoTween.stop();
            this.logoTween = null;
        }

        this.scene.start('Game');
    }

    moveLogo (reactCallback)
    {
        if (this.logoTween)
        {
            if (this.logoTween.isPlaying())
            {
                this.logoTween.pause();
            }
            else
            {
                this.logoTween.play();
            }
        }
        else
        {
            this.logoTween = this.tweens.add({
                targets: this.logo,
                x: { value: 750, duration: 3000, ease: 'Back.easeInOut' },
                y: { value: 80, duration: 1500, ease: 'Sine.easeOut' },
                yoyo: true,
                repeat: -1,
                onUpdate: () => {
                    if (reactCallback)
                    {
                        reactCallback({
                            x: Math.floor(this.logo.x),
                            y: Math.floor(this.logo.y)
                        });
                    }
                }
            });
        }
    }
}

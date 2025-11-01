import Phaser from 'phaser';
import { UI_CONFIG, LEVEL_DATA, REGISTRY_KEYS } from '../config/Constants';
import { ensureParticleTexture, ensureTubeIconTexture, getTubeIconKey } from '../utils/textures';
import EventBus from '../../EventBus';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WaterSortIntro' });
  }

  preload(): void {
    ensureParticleTexture(this);
    ensureTubeIconTexture(this);
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const isPortrait = height > width;
    const scaleFactor = Phaser.Math.Clamp(Math.min(width / 1024, height / 768), 0.6, 1.05);

    this.registry.set(REGISTRY_KEYS.CURRENT_LEVEL_INDEX, LEVEL_DATA.defaultLevelIndex);

    this.createBackground();

    const icon = this.add.image(width / 2, height * 0.2, getTubeIconKey());
    icon.setOrigin(0.5, 0.55);
    icon.setScale(scaleFactor * (isPortrait ? 0.55 : 0.5));
    icon.setAlpha(0);

    const title = this.add.text(width / 2, height * 0.35, 'Water Sort', {
      fontSize: `${Math.round(UI_CONFIG.TITLE_SIZE * 1.05 * scaleFactor)}px`,
      color: '#fff',
      fontFamily: 'Arial Black',
      fontStyle: 'bold'
    });
    title.setOrigin(0.5);
    title.setAlpha(0);

    const subtitle = this.add.text(width / 2, height * 0.42, 'Puzzle', {
      fontSize: `${Math.round(UI_CONFIG.SUBTITLE_SIZE * 1.15 * scaleFactor)}px`,
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    });
    subtitle.setOrigin(0.5);
    subtitle.setAlpha(0);

    const instructions = this.add.text(
      width / 2,
      height * 0.55,
      'Sort liquids by color\nTap tubes to pour\nMatch colors to win!',
      {
        fontSize: `${Math.round(UI_CONFIG.UI_TEXT_SIZE * scaleFactor)}px`,
        color: '#d7e6ff',
        fontFamily: 'Arial, sans-serif',
        align: 'center',
        lineSpacing: Math.round(12 * scaleFactor)
      }
    );
    instructions.setOrigin(0.5);
    instructions.setAlpha(0);

    const startButton = this.createButton(
      width / 2,
      height * (isPortrait ? 0.78 : 0.72),
      'Start Game',
      scaleFactor,
      () => {
        this.cameras.main.fade(280, 0, 0, 0);
        this.time.delayedCall(280, () => {
          this.scene.start('DifficultySelection');
        });
      }
    );
    startButton.setAlpha(0);

    this.tweens.add({
      targets: icon,
      alpha: 1,
      duration: 500,
      ease: 'Sine.easeOut'
    });

    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 500,
      ease: 'Sine.easeOut',
      delay: 200
    });
    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: 400,
      delay: 420
    });
    this.tweens.add({
      targets: instructions,
      alpha: 1,
      duration: 400,
      delay: 620
    });

    this.tweens.add({
      targets: startButton,
      alpha: 1,
      duration: 400,
      delay: 900
    });

    this.tweens.add({
      targets: startButton,
      scale: { from: startButton.scale, to: startButton.scale * 1.05 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 1100
    });

    this.cameras.main.fadeIn(500);

    EventBus.emit('current-scene-ready', this);
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;

    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x07163b, 0x071d4d, 0x05102a, 0x07163b, 1);
    graphics.fillRect(0, 0, width, height);

    const bubbleColors = [0x1e4d8f, 0x132d58, 0x0a2250];
    for (let i = 0; i < 10; i++) {
      const bubble = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(6, 16),
        bubbleColors[i % bubbleColors.length],
        Phaser.Math.FloatBetween(0.08, 0.16)
      );

      this.tweens.add({
        targets: bubble,
        y: bubble.y - Phaser.Math.Between(12, 28),
        alpha: { from: bubble.alpha, to: bubble.alpha * 0.4 },
        duration: Phaser.Math.Between(2400, 3600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 800)
      });
    }
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    scaleFactor: number,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const buttonWidth = UI_CONFIG.BUTTON_WIDTH * (0.95 + scaleFactor * 0.15);
    const buttonHeight = UI_CONFIG.BUTTON_HEIGHT * (0.9 + scaleFactor * 0.12);
    const radius = UI_CONFIG.BUTTON_RADIUS * (0.85 + scaleFactor * 0.12);

    const bg = this.add.graphics();
    const drawGradient = (topAlpha: number) => {
      bg.clear();
      bg.fillGradientStyle(
        Phaser.Display.Color.IntegerToColor(0x33c8ff).color,
        Phaser.Display.Color.IntegerToColor(0x52a8ff).color,
        Phaser.Display.Color.IntegerToColor(0x1b88ff).color,
        Phaser.Display.Color.IntegerToColor(0x0f6aff).color,
        1,
        1,
        topAlpha,
        topAlpha
      );
      bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, radius);
      bg.lineStyle(3, 0x8fd8ff, 0.9);
      bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, radius);
    };
    drawGradient(1);

    const buttonText = this.add.text(0, 0, text, {
      fontSize: `${Math.round(UI_CONFIG.BUTTON_TEXT_SIZE * 0.95 * scaleFactor)}px`,
      color: '#ffffff',
      fontFamily: 'Arial Black',
      shadow: {
        offsetX: 0,
        offsetY: 6 * scaleFactor,
        color: '#0b3ca8',
        blur: 12 * scaleFactor,
        fill: true
      }
    });
    buttonText.setOrigin(0.5);

    container.add([bg, buttonText]);
    container.setSize(buttonWidth, buttonHeight);
    container.setScale(scaleFactor);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      drawGradient(1.1);
      this.tweens.add({ targets: container, scale: scaleFactor * 1.04, duration: 100 });
    });

    container.on('pointerout', () => {
      drawGradient(1);
      this.tweens.add({ targets: container, scale: scaleFactor, duration: 120 });
    });

    container.on('pointerdown', () => {
      this.tweens.add({
        targets: container,
        scale: scaleFactor * 0.96,
        duration: 70,
        yoyo: true,
        onComplete: callback
      });
    });

    return container;
  }
}

export default IntroScene;

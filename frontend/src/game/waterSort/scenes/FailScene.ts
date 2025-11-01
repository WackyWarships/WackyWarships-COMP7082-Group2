import Phaser from 'phaser';
import { UI_CONFIG, REGISTRY_KEYS, LEVEL_DATA } from '../config/Constants';

interface FailSceneData {
  moves?: number;
  time?: number;
  levelIndex?: number;
}

export class FailScene extends Phaser.Scene {
  private moves = 0;
  private elapsedTime = 0;
  private failedLevelIndex = 0;

  constructor() {
    super({ key: 'WaterSortFail' });
  }

  init(data: FailSceneData): void {
    this.moves = data.moves ?? 0;
    this.elapsedTime = data.time ?? 0;
    this.failedLevelIndex = Phaser.Math.Clamp(
      data.levelIndex ?? this.registry.get(REGISTRY_KEYS.CURRENT_LEVEL_INDEX) ?? 0,
      0,
      LEVEL_DATA.levels.length - 1
    );
    this.registry.set(REGISTRY_KEYS.CURRENT_LEVEL_INDEX, this.failedLevelIndex);
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const isPortrait = height > width;
    const scaleFactor = Phaser.Math.Clamp(Math.min(width / 1024, height / 768), 0.58, 1);

    this.drawBackground();

    const icon = this.add.text(width / 2, height * 0.22, '⏳', {
      fontSize: `${Math.round(110 * scaleFactor)}px`
    });
    icon.setOrigin(0.5);
    icon.setScale(0);

    const heading = this.add.text(width / 2, height * 0.38, 'Time Ran Out!', {
      fontSize: `${Math.round(UI_CONFIG.TITLE_SIZE * 0.8 * scaleFactor)}px`,
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    });
    heading.setOrigin(0.5);
   
    
    heading.setAlpha(0);

    const stats = this.add.text(
      width / 2,
      height * 0.52,
      `Moves: ${this.moves}\nTime Played: ${this.elapsedTime}s`,
      {
        fontSize: `${Math.round(UI_CONFIG.SUBTITLE_SIZE * 0.9 * scaleFactor)}px`,
        color: '#cccccc',
        fontFamily: 'Arial, sans-serif',
        align: 'center',
        lineSpacing: Math.max(8, Math.round(10 * scaleFactor))
      }
    );
    stats.setOrigin(0.5);
    stats.setAlpha(0);

    const tip = this.add.text(
      width / 2,
      height * 0.63,
      'Give it another try or take a breather!',
      {
        fontSize: `${Math.round(20 * scaleFactor)}px`,
        color: '#9fb3ff',
        fontFamily: 'Arial, sans-serif',
        align: 'center'
      }
    );
    tip.setOrigin(0.5);
    tip.setAlpha(0);

    const buttonY = height * (isPortrait ? 0.8 : 0.78);
    const buttonSpacing = Math.min(200, width * 0.38);
    const buttonScale = Phaser.Math.Clamp(scaleFactor * 0.95, 0.52, 0.95);

    const retryButton = this.createButton(
      width / 2 - buttonSpacing / 2,
      buttonY,
      'Replay Level',
      () => {
        this.cameras.main.fade(250);
        this.time.delayedCall(250, () => {
          this.scene.start('WaterSortGame', { levelIndex: this.failedLevelIndex });
        });
      }
    );
    retryButton.setScale(0);

    const menuButton = this.createButton(
      width / 2 + buttonSpacing / 2,
      buttonY,
      'Main Menu',
      () => {
        this.cameras.main.fade(250);
        this.time.delayedCall(250, () => {
          this.scene.start('WaterSortIntro');
        });
      }
    );
    menuButton.setScale(0);

    this.tweens.add({
      targets: icon,
      scale: 1,
      duration: 600,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: [heading, stats, tip],
      alpha: 1,
      duration: 400,
      delay: 350,
      stagger: 180
    });

    this.tweens.add({
      targets: [retryButton, menuButton],
      scale: buttonScale,
      duration: 420,
      ease: 'Back.easeOut',
      delay: 800
    });

    this.tweens.add({
      targets: [retryButton, menuButton],
      scale: buttonScale * 1.05,
      duration: 950,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay: 1250
    });

    this.cameras.main.fadeIn(450);
  }

  private drawBackground(): void {
    const { width, height } = this.cameras.main;
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x141a33, 0x141a33, 1);
    graphics.fillRect(0, 0, width, height);
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(UI_CONFIG.BUTTON_COLOR, 1);
    bg.fillRoundedRect(
      -UI_CONFIG.BUTTON_WIDTH / 2,
      -UI_CONFIG.BUTTON_HEIGHT / 2,
      UI_CONFIG.BUTTON_WIDTH,
      UI_CONFIG.BUTTON_HEIGHT,
      UI_CONFIG.BUTTON_RADIUS
    );

    const label = this.add.text(0, 0, text, {
      fontSize: `${UI_CONFIG.BUTTON_TEXT_SIZE}px`,
      color: UI_CONFIG.TEXT_COLOR,
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    });
    label.setOrigin(0.5);

    container.add([bg, label]);
    container.setSize(UI_CONFIG.BUTTON_WIDTH, UI_CONFIG.BUTTON_HEIGHT);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(UI_CONFIG.BUTTON_HOVER_COLOR, 1);
      bg.fillRoundedRect(
        -UI_CONFIG.BUTTON_WIDTH / 2,
        -UI_CONFIG.BUTTON_HEIGHT / 2,
        UI_CONFIG.BUTTON_WIDTH,
        UI_CONFIG.BUTTON_HEIGHT,
        UI_CONFIG.BUTTON_RADIUS
      );
      this.tweens.add({ targets: container, scale: container.scale * 1.05, duration: 100 });
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(UI_CONFIG.BUTTON_COLOR, 1);
      bg.fillRoundedRect(
        -UI_CONFIG.BUTTON_WIDTH / 2,
        -UI_CONFIG.BUTTON_HEIGHT / 2,
        UI_CONFIG.BUTTON_WIDTH,
        UI_CONFIG.BUTTON_HEIGHT,
        UI_CONFIG.BUTTON_RADIUS
      );
      this.tweens.add({ targets: container, scale: container.scale / 1.05, duration: 100 });
    });

    container.on('pointerdown', () => {
      this.tweens.add({
        targets: container,
        scale: container.scale * 0.95,
        duration: 60,
        yoyo: true,
        onComplete: callback
      });
    });

    return container;
  }
}

export default FailScene;

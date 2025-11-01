import Phaser from 'phaser';
import { UI_CONFIG, LEVEL_DATA, REGISTRY_KEYS } from '../config/Constants';

export class WinScene extends Phaser.Scene {
  private moves = 0;
  private elapsedTime = 0;
  private completedLevelIndex = 0;

  constructor() {
    super({ key: 'WaterSortWin' });
  }

  init(data: { moves: number; time: number; levelIndex: number }): void {
    this.moves = data.moves;
    this.elapsedTime = data.time;
    this.completedLevelIndex = data.levelIndex ?? 0;
  }

  preload(): void {
    this.load.svg('trophy', '/src/assets/miniGame/trophy-svgrepo-com.svg');
  }

  create(): void {
    this.setupResponsiveLayout();
  }

  private setupResponsiveLayout(): void {
    const { width, height } = this.cameras.main;
    const isPortrait = height > width;
    
    // Enhanced scaling for different screen sizes
    const baseScale = Math.min(width / 1024, height / 768);
    const scaleFactor = Phaser.Math.Clamp(baseScale, 0.4, 1.2);
    
    // Responsive positioning based on screen orientation and size
    const positions = this.calculateResponsivePositions(width, height, isPortrait);
    
    // Simple background
    this.createBackground();

    // SVG trophy image with responsive scaling
    const trophy = this.add.image(width / 2, positions.trophy, 'trophy');
    trophy.setOrigin(0.5);
    const trophyScale = scaleFactor * (isPortrait ? 0.12 : 0.15);
    trophy.setScale(Phaser.Math.Clamp(trophyScale, 0.08, 0.2));

    // Congratulations text with responsive font size
    const titleSize = Math.max(24, Math.min(48, UI_CONFIG.TITLE_SIZE * scaleFactor));
    const congrats = this.add.text(width / 2, positions.title, 'Level Complete!', {
      fontSize: `${Math.round(titleSize)}px`,
      color: UI_CONFIG.TEXT_COLOR,
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    });
    congrats.setOrigin(0.5);

    // Stats text with responsive sizing and positioning
    const subtitleSize = Math.max(16, Math.min(28, UI_CONFIG.SUBTITLE_SIZE * scaleFactor));
    const statsText = this.add.text(width / 2, positions.stats, `Moves: ${this.moves}\nTime: ${this.elapsedTime}s`, {
      fontSize: `${Math.round(subtitleSize)}px`,
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif',
      align: 'center',
      lineSpacing: Math.round(8 * scaleFactor)
    });
    statsText.setOrigin(0.5);

    // Rating with responsive sizing
    const rating = this.calculateRating();
    const starSize = Math.max(24, Math.min(60, 48 * scaleFactor));
    const stars = this.add.text(width / 2, positions.stars, rating.stars, {
      fontSize: `${Math.round(starSize)}px`
    });
    stars.setOrigin(0.5);

    const ratingSize = Math.max(14, Math.min(32, 22 * scaleFactor));
    const ratingText = this.add.text(width / 2, positions.rating, rating.text, {
      fontSize: `${Math.round(ratingSize)}px`,
      color: rating.color,
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    });
    ratingText.setOrigin(0.5);

    // Responsive button layout
    this.createResponsiveButtons(width, height, isPortrait, scaleFactor, positions.buttons);
    
    // Add resize handler for dynamic responsiveness
    this.scale.on('resize', this.handleResize, this);
  }

  private calculateResponsivePositions(width: number, height: number, isPortrait: boolean) {
    const safeAreaTop = height * 0.1;
    const safeAreaBottom = height * 0.9;
    const availableHeight = safeAreaBottom - safeAreaTop;
    
    if (isPortrait) {
      return {
        trophy: safeAreaTop + availableHeight * 0.15,
        title: safeAreaTop + availableHeight * 0.35,
        stats: safeAreaTop + availableHeight * 0.5,
        stars: safeAreaTop + availableHeight * 0.65,
        rating: safeAreaTop + availableHeight * 0.75,
        buttons: safeAreaTop + availableHeight * 0.9
      };
    } else {
      return {
        trophy: safeAreaTop + availableHeight * 0.2,
        title: safeAreaTop + availableHeight * 0.4,
        stats: safeAreaTop + availableHeight * 0.55,
        stars: safeAreaTop + availableHeight * 0.7,
        rating: safeAreaTop + availableHeight * 0.8,
        buttons: safeAreaTop + availableHeight * 0.95
      };
    }
  }

  private createResponsiveButtons(width: number, height: number, isPortrait: boolean, scaleFactor: number, buttonY: number): void {
    // Responsive button spacing and sizing
    const minSpacing = 180;
    const maxSpacing = 300;
    const buttonSpacing = Phaser.Math.Clamp(width * 0.35, minSpacing, maxSpacing);
    
    // Button scale based on screen size
    const buttonScale = Phaser.Math.Clamp(scaleFactor, 0.6, 1.1);
    
    // Replay button
    const replayButton = this.createButton(
      width / 2 - buttonSpacing / 2,
      buttonY,
      'Replay Level',
      () => {
        this.scene.start('WaterSortGame', { levelIndex: this.completedLevelIndex });
      },
      buttonScale
    );

    // Next level or menu button
    const nextLevelAvailable = this.completedLevelIndex < LEVEL_DATA.levels.length - 1;
    const proceedButton = this.createButton(
      width / 2 + buttonSpacing / 2,
      buttonY,
      nextLevelAvailable ? 'Next Level' : 'Main Menu',
      () => {
        if (nextLevelAvailable) {
          const nextIndex = this.completedLevelIndex + 1;
          this.registry.set(REGISTRY_KEYS.CURRENT_LEVEL_INDEX, nextIndex);
          this.scene.start('WaterSortGame', { levelIndex: nextIndex });
        } else {
          this.scene.start('MainMenu');
        }
      },
      buttonScale
    );
  }

  private handleResize(): void {
    // Clear existing elements and recreate with new dimensions
    this.children.removeAll();
    this.setupResponsiveLayout();
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x1a1a2e, 1);
    graphics.fillRect(0, 0, width, height);
  }

  private calculateRating(): { stars: string; text: string; color: string } {
    if (this.moves <= 10) {
      return { stars: '', text: 'Perfect!', color: '#ffd23f' };
    }
    if (this.moves <= 15) {
      return { stars: '', text: 'Great!', color: '#4bf77a' };
    }
    return { stars: '', text: 'Good!', color: '#3fb6ff' };
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    callback: () => void,
    scale: number = 1
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Simple button background with scaling
    const bg = this.add.graphics();
    bg.fillStyle(UI_CONFIG.BUTTON_COLOR, 1);
    bg.fillRoundedRect(
      -UI_CONFIG.BUTTON_WIDTH / 2 * scale,
      -UI_CONFIG.BUTTON_HEIGHT / 2 * scale,
      UI_CONFIG.BUTTON_WIDTH * scale,
      UI_CONFIG.BUTTON_HEIGHT * scale,
      UI_CONFIG.BUTTON_RADIUS * scale
    );

    // Button text with scaling
    const buttonText = this.add.text(0, 0, text, {
      fontSize: `${UI_CONFIG.BUTTON_TEXT_SIZE * scale}px`,
      color: UI_CONFIG.TEXT_COLOR,
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    });
    buttonText.setOrigin(0.5);

    container.add([bg, buttonText]);
    container.setSize(UI_CONFIG.BUTTON_WIDTH * scale, UI_CONFIG.BUTTON_HEIGHT * scale);
    container.setInteractive({ useHandCursor: true });

    // Simple hover effect with scaling
    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(UI_CONFIG.BUTTON_HOVER_COLOR, 1);
      bg.fillRoundedRect(
        -UI_CONFIG.BUTTON_WIDTH / 2 * scale,
        -UI_CONFIG.BUTTON_HEIGHT / 2 * scale,
        UI_CONFIG.BUTTON_WIDTH * scale,
        UI_CONFIG.BUTTON_HEIGHT * scale,
        UI_CONFIG.BUTTON_RADIUS * scale
      );
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(UI_CONFIG.BUTTON_COLOR, 1);
      bg.fillRoundedRect(
        -UI_CONFIG.BUTTON_WIDTH / 2 * scale,
        -UI_CONFIG.BUTTON_HEIGHT / 2 * scale,
        UI_CONFIG.BUTTON_WIDTH * scale,
        UI_CONFIG.BUTTON_HEIGHT * scale,
        UI_CONFIG.BUTTON_RADIUS * scale
      );
    });

    container.on('pointerdown', callback);

    return container;
  }
}

export default WinScene;
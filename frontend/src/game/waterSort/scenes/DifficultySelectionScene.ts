import Phaser from 'phaser';
import { ConfigurationManager, DifficultyLevel } from '../config/ConfigurationManager';
import { UI_CONFIG } from '../config/Constants';

export class DifficultySelectionScene extends Phaser.Scene {
  private configManager!: ConfigurationManager;
  private background!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private backButton!: Phaser.GameObjects.Container;
  private adminButton!: Phaser.GameObjects.Container;
  private difficultyButtons: Phaser.GameObjects.Container[] = [];
  private decorativeCircles: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super({ key: 'DifficultySelection' });
  }

  create(): void {
    this.configManager = ConfigurationManager.getInstance();
    const { width, height } = this.scale;

    this.createBackground(width, height);
    this.createHeader(width, height);
    this.createDifficultyButtons(width, height);
    this.createNavigationButtons(width, height);

    // Handle resize
    this.scale.on('resize', this.handleResize, this);
  }

  private createBackground(width: number, height: number): void {
    // Clear existing background elements
    if (this.background) {
      this.background.destroy();
    }
    this.decorativeCircles.forEach(circle => circle.destroy());
    this.decorativeCircles = [];

    this.background = this.add.graphics();
    
    // Create gradient background
    const gradient = this.add.graphics();
    gradient.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    gradient.fillRect(0, 0, width, height);

    // Add responsive decorative elements based on screen size
    const circleCount = Math.min(30, Math.max(10, Math.floor((width * height) / 10000)));
    for (let i = 0; i < circleCount; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const size = Phaser.Math.Between(2, Math.min(12, width / 100));
      const alpha = Phaser.Math.FloatBetween(0.1, 0.3);
      
      const circle = this.add.circle(x, y, size, 0xffffff, alpha);
      this.decorativeCircles.push(circle);
    }
  }

  private createHeader(width: number, height: number): void {
    const isPortrait = height > width;
    const scaleFactor = Math.min(width / 1024, height / 768);
    const isMobile = width < 768;
    
    // Calculate responsive font sizes
    const titleFontSize = Math.max(24, Math.min(48, width * 0.05));
    const subtitleFontSize = Math.max(16, Math.min(24, width * 0.025));
    
    // Calculate responsive positioning
    const titleY = isMobile ? height * 0.08 : Math.max(60, height * 0.12);
    const subtitleY = titleY + (isMobile ? 40 : 50);

    if (this.titleText) {
      this.titleText.destroy();
    }
    if (this.subtitleText) {
      this.subtitleText.destroy();
    }

    this.titleText = this.add.text(width / 2, titleY, 'Select Difficulty', {
      fontSize: `${titleFontSize}px`,
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.subtitleText = this.add.text(width / 2, subtitleY, 'Choose your challenge level', {
      fontSize: `${subtitleFontSize}px`,
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);
  }

  private createDifficultyButtons(width: number, height: number): void {
    // Clear existing buttons
    this.difficultyButtons.forEach(button => button.destroy());
    this.difficultyButtons = [];

    const difficulties = this.configManager.getAllDifficultyLevels();
    const difficultyEntries = Object.entries(difficulties);
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    
    // Responsive card sizing
    const baseCardWidth = isMobile ? Math.min(280, width * 0.85) : isTablet ? 250 : 300;
    const baseCardHeight = isMobile ? 180 : isTablet ? 190 : 200;
    
    // Determine layout: horizontal for desktop/tablet, vertical for mobile
    const useVerticalLayout = isMobile || (difficultyEntries.length > 2 && width < 900);
    
    if (useVerticalLayout) {
      // Vertical layout for mobile and narrow screens
      const spacing = isMobile ? 20 : 30;
      const totalHeight = difficultyEntries.length * baseCardHeight + (difficultyEntries.length - 1) * spacing;
      const startY = Math.max(height * 0.25, (height - totalHeight) / 2);
      
      difficultyEntries.forEach(([difficultyId, difficulty], index) => {
        const x = width / 2;
        const y = startY + index * (baseCardHeight + spacing) + baseCardHeight / 2;
        const button = this.createDifficultyCard(x, y, difficultyId, difficulty, baseCardWidth, baseCardHeight);
        this.difficultyButtons.push(button);
      });
    } else {
      // Horizontal layout for desktop and wide tablets
      const spacing = isTablet ? 30 : 50;
      const totalWidth = difficultyEntries.length * baseCardWidth + (difficultyEntries.length - 1) * spacing;
      const startX = (width - totalWidth) / 2;
      const centerY = height / 2;

      difficultyEntries.forEach(([difficultyId, difficulty], index) => {
        const x = startX + index * (baseCardWidth + spacing) + baseCardWidth / 2;
        const button = this.createDifficultyCard(x, centerY, difficultyId, difficulty, baseCardWidth, baseCardHeight);
        this.difficultyButtons.push(button);
      });
    }
  }

  private createDifficultyCard(x: number, y: number, difficultyId: string, difficulty: DifficultyLevel, cardWidth: number = 300, cardHeight: number = 200): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    // Calculate responsive dimensions
    const halfWidth = cardWidth / 2;
    const halfHeight = cardHeight / 2;
    const isMobile = cardWidth < 300;
    
    // Card background
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x2a2a3e, 0.9);
    cardBg.fillRoundedRect(-halfWidth, -halfHeight, cardWidth, cardHeight, 15);
    cardBg.lineStyle(2, 0x4a90e2, 0.8);
    cardBg.strokeRoundedRect(-halfWidth, -halfHeight, cardWidth, cardHeight, 15);

    // Difficulty color indicator
    const colorMap: Record<string, number> = {
      'easy': 0x4CAF50,    // Green
      'medium': 0xFF9800,  // Orange
      'hard': 0xF44336     // Red
    };
    const indicatorColor = colorMap[difficultyId] || 0x4a90e2;
    
    const indicator = this.add.graphics();
    indicator.fillStyle(indicatorColor);
    const indicatorWidth = cardWidth * 0.9;
    const indicatorHeight = 8;
    indicator.fillRoundedRect(-indicatorWidth / 2, -halfHeight + 10, indicatorWidth, indicatorHeight, 4);

    // Responsive font sizes
    const titleFontSize = Math.max(18, Math.min(28, cardWidth * 0.08));
    const descFontSize = Math.max(11, Math.min(14, cardWidth * 0.04));
    const statsFontSize = Math.max(10, Math.min(12, cardWidth * 0.035));

    // Title
    const title = this.add.text(0, -halfHeight + 40, difficulty.name, {
      fontSize: `${titleFontSize}px`,
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Description
    const description = this.add.text(0, -halfHeight + 80, difficulty.description, {
      fontSize: `${descFontSize}px`,
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif',
      align: 'center',
      wordWrap: { width: cardWidth * 0.85 }
    }).setOrigin(0.5);

    // Stats
    const statsText = [
      `Tubes: ${difficulty.totalTubes} (${difficulty.filledTubes} filled)`,
      `Target Score: ${difficulty.targetScore.toLocaleString()}`,
      `Time Limit: ${Math.floor(difficulty.timeLimit / 60)}:${(difficulty.timeLimit % 60).toString().padStart(2, '0')}`,
      `Max Undos: ${difficulty.maxUndos}`
    ].join('\n');

    const stats = this.add.text(0, halfHeight - 40, statsText, {
      fontSize: `${statsFontSize}px`,
      color: '#aaaaaa',
      fontFamily: 'Arial, sans-serif',
      align: 'center',
      lineSpacing: isMobile ? 2 : 4
    }).setOrigin(0.5);

    container.add([cardBg, indicator, title, description, stats]);
    container.setSize(cardWidth, cardHeight);
    container.setInteractive(new Phaser.Geom.Rectangle(-halfWidth, -halfHeight, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains);

    // Hover effects
    container.on('pointerover', () => {
      cardBg.clear();
      cardBg.fillStyle(0x3a3a4e, 0.95);
      cardBg.fillRoundedRect(-halfWidth, -halfHeight, cardWidth, cardHeight, 15);
      cardBg.lineStyle(3, indicatorColor, 1);
      cardBg.strokeRoundedRect(-halfWidth, -halfHeight, cardWidth, cardHeight, 15);
      
      this.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 200,
        ease: 'Power2'
      });
    });

    container.on('pointerout', () => {
      cardBg.clear();
      cardBg.fillStyle(0x2a2a3e, 0.9);
      cardBg.fillRoundedRect(-halfWidth, -halfHeight, cardWidth, cardHeight, 15);
      cardBg.lineStyle(2, 0x4a90e2, 0.8);
      cardBg.strokeRoundedRect(-halfWidth, -halfHeight, cardWidth, cardHeight, 15);
      
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 200,
        ease: 'Power2'
      });
    });

    container.on('pointerdown', () => {
      this.selectDifficulty(difficultyId);
    });

    return container;
  }

  private createNavigationButtons(width: number, height: number): void {
    const isMobile = width < 768;
    const buttonMargin = isMobile ? 20 : 100;
    const buttonY = height - (isMobile ? 60 : 80);

    // Clear existing buttons
    if (this.backButton) {
      this.backButton.destroy();
    }
    if (this.adminButton) {
      this.adminButton.destroy();
    }

    // Back button
    this.backButton = this.createButton(buttonMargin, buttonY, 'Back to Menu', () => {
      this.scene.start('MainMenu');
    });

    // Admin button (hidden by default, can be shown with a key combination)
    this.adminButton = this.createButton(width - buttonMargin, buttonY, 'Admin Panel', () => {
      this.scene.start('AdminPanel');
    });
    this.adminButton.setVisible(false);

    // Secret key combination to show admin button (Ctrl+Shift+A)
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        this.adminButton.setVisible(!this.adminButton.visible);
      }
    });
  }

  private createButton(x: number, y: number, text: string, callback: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    // Responsive button sizing
    const isMobile = this.scale.width < 768;
    const buttonWidth = isMobile ? 120 : 150;
    const buttonHeight = isMobile ? 40 : 50;
    const halfWidth = buttonWidth / 2;
    const halfHeight = buttonHeight / 2;
    const fontSize = isMobile ? '14px' : '16px';
    
    const background = this.add.graphics();
    background.fillStyle(UI_CONFIG.BUTTON_COLOR);
    background.fillRoundedRect(-halfWidth, -halfHeight, buttonWidth, buttonHeight, 10);
    
    const buttonText = this.add.text(0, 0, text, {
      fontSize: fontSize,
      color: UI_CONFIG.TEXT_COLOR,
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);

    container.add([background, buttonText]);
    container.setInteractive(new Phaser.Geom.Rectangle(-halfWidth, -halfHeight, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
    
    container.on('pointerdown', callback);

    container.on('pointerover', () => {
      background.clear();
      background.fillStyle(UI_CONFIG.BUTTON_HOVER_COLOR);
      background.fillRoundedRect(-halfWidth, -halfHeight, buttonWidth, buttonHeight, 10);
    });

    container.on('pointerout', () => {
      background.clear();
      background.fillStyle(UI_CONFIG.BUTTON_COLOR);
      background.fillRoundedRect(-halfWidth, -halfHeight, buttonWidth, buttonHeight, 10);
    });

    return container;
  }

  private selectDifficulty(difficultyId: string): void {
    // Set the selected difficulty in the configuration manager
    this.configManager.setCurrentDifficulty(difficultyId);
    
    // Add a nice transition effect
    this.cameras.main.fadeOut(500, 0, 0, 0);
    
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Start the game with the selected difficulty
      this.scene.start('WaterSortGame', { difficulty: difficultyId });
    });
  }

  private handleResize = (gameSize: Phaser.Structs.Size): void => {
    const { width, height } = gameSize;
    
    // Recreate all elements with new responsive sizing
    this.createBackground(width, height);
    this.createHeader(width, height);
    this.createDifficultyButtons(width, height);
    this.createNavigationButtons(width, height);
  };
}

export default DifficultySelectionScene;
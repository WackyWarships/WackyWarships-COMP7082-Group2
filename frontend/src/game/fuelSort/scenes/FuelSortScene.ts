import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { TubeVisual } from '../components/TubeVisual';
import { PourAnimation } from '../components/PourAnimation';
import {
  TUBE_CONFIG,
  UI_CONFIG,
  GAME_CONFIG,
  ANIMATION_CONFIG,
  LevelDefinition,
  REGISTRY_KEYS
} from '../config/Constants';
import { ConfigurationManager } from '../config/ConfigurationManager';
import EventBus from '../../EventBus';
import { ensureParticleTexture, FUEL_SORT_PARTICLE_KEY } from '../utils/textures';

export class FuelSortScene extends Phaser.Scene {
  private gameState!: GameState;
  private tubeVisuals: TubeVisual[] = [];
  private selectedTube: TubeVisual | null = null;
  private pourAnimation!: PourAnimation;
  private isAnimating = false;
  private currentLevel!: LevelDefinition;
  private currentLevelIndex = 0;
  private isGameActive = false;
  private hasCountdownStarted = false;

  private backgroundGraphics!: Phaser.GameObjects.Graphics;
  private backgroundDecorations: Phaser.GameObjects.Arc[] = [];

  private titleText!: Phaser.GameObjects.Text;

  private moveText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private levelDescriptionText!: Phaser.GameObjects.Text;
  private homeButton!: Phaser.GameObjects.Container;
  private settingsButton!: Phaser.GameObjects.Container;
  private pauseModal?: Phaser.GameObjects.Container;
  private isPaused = false;

  private timeInterval?: Phaser.Time.TimerEvent;
  private countdownEvent?: Phaser.Time.TimerEvent;

  private hintContainer?: Phaser.GameObjects.Container;
  private hintBackdrop?: Phaser.GameObjects.Rectangle;
  private hintPanel?: Phaser.GameObjects.Rectangle;
  private hintTitle?: Phaser.GameObjects.Text;
  private hintBody?: Phaser.GameObjects.Text;
  private hintPrompt?: Phaser.GameObjects.Text;
  private countdownText?: Phaser.GameObjects.Text;

  private levelTimeLimit = 0;
  private remainingTime = 0;

  constructor() {
    super({ key: 'FuelSortGame' });
  }

  preload(): void {    
    // Load SVG assets for home and settings buttons
    this.load.svg('home', '/src/assets/miniGame/home.svg');
    this.load.svg('settings', '/src/assets/miniGame/settings.svg');
  }

  private shouldShowHintForLevel(levelIndex: number): boolean {
    const registryFlag = this.registry.get('fuel-sort-hint-shown');
    if (levelIndex !== 0) {
      return false;
    }

    if (registryFlag) {
      return false;
    }

    this.registry.set('fuel-sort-hint-shown', true);
    return true;
  }

  private startCountdownImmediately(): void {
    if (this.countdownEvent) {
      this.countdownEvent.remove(false);
      this.countdownEvent = undefined;
    }

    this.time.delayedCall(200, () => {
      this.startGameplay();
    });
  }

  init(data?: { levelIndex?: number; difficulty?: string }): void {
    const configManager = ConfigurationManager.getInstance();
    
    // Set difficulty if provided
    if (data?.difficulty) {
      configManager.setCurrentDifficulty(data.difficulty);
    }

    this.registry.set(REGISTRY_KEYS.CURRENT_LEVEL_INDEX, 0);
  }

  create(): void {
    ensureParticleTexture(this);

    const { width, height } = this.scale;
    const configManager = ConfigurationManager.getInstance();

    // Generate level from current difficulty configuration
    this.currentLevelIndex = 0;
    this.currentLevel = this.generateLevelFromConfig(configManager);
    this.registry.set(REGISTRY_KEYS.CURRENT_LEVEL_INDEX, this.currentLevelIndex);

    this.gameState = new GameState(this.currentLevel.tubes);
    this.pourAnimation = new PourAnimation(this);
    this.tubeVisuals = [];
    this.selectedTube = null;

    this.createBackground(width, height);
    this.createTubes(width, height);
    this.createUI(width, height);
    this.positionTubes(width, height);
    this.layoutUI(width, height);

    this.levelTimeLimit = this.getLevelTimeLimit(this.currentLevelIndex);
    this.remainingTime = this.levelTimeLimit;
    this.updateTimeText();

    this.isGameActive = false;
    this.hasCountdownStarted = false;

    const shouldShowHint = this.shouldShowHintForLevel(this.currentLevelIndex);
    if (shouldShowHint) {
      this.showHintOverlay();
    } else {
      this.clearHintOverlay();
      this.startCountdownImmediately();
    }

    this.cameras.main.fadeIn(300);

    EventBus.emit('current-scene-ready', this);

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
      if (this.timeInterval) {
        this.timeInterval.destroy();
        this.timeInterval = undefined;
      }
      if (this.countdownEvent) {
        this.countdownEvent.destroy();
        this.countdownEvent = undefined;
      }
    });
  }

  private createBackground(width: number, height: number): void {
    this.backgroundGraphics = this.add.graphics();
    this.drawBackground(width, height);

    const minDim = Math.min(width, height);
    const circle1 = this.add.circle(0, 0, minDim * 0.12, 0x4a90e2, 0.1);
    const circle2 = this.add.circle(0, 0, minDim * 0.18, 0x8b5cff, 0.1);
    this.backgroundDecorations = [circle1, circle2];
    this.positionBackgroundDecorations(width, height);

    this.tweens.add({
      targets: circle1,
      scale: 1.2,
      alpha: 0.15,
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tweens.add({
      targets: circle2,
      scale: 1.3,
      alpha: 0.15,
      duration: 4000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private createTubes(width: number, height: number): void {
    const tubes = this.gameState.getTubes();
    const scaleFactor = this.getTubeScale(width, height, tubes.length);
    const positions = this.calculateTubePositions(width, height, tubes.length, scaleFactor);

    tubes.forEach((tube, index) => {
      const pos = positions[index];
      const tubeVisual = new TubeVisual(this, pos.x, pos.y, tube, index);
      tubeVisual.setScale(scaleFactor);
      tubeVisual.on('pointerdown', () => {
        this.handleTubeClick(tubeVisual);
      });
      this.tubeVisuals.push(tubeVisual);
    });
  }

  private createUI(width: number, height: number): void {
    this.titleText = this.add.text(width / 2, 60, 'Fuel Sort Puzzle', {
      fontSize: '32px',
      color: UI_CONFIG.TEXT_COLOR,
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    });
    this.titleText.setOrigin(0.5);

    this.levelText = this.add.text(
      width / 2,
      120,
      `Level ${this.currentLevel.id}: ${this.currentLevel.name}`.toUpperCase(),
      {
        fontSize: '26px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold'
      }
    );
    this.levelText.setOrigin(0.5);

    this.levelDescriptionText = this.add.text(width / 2, 170, this.currentLevel.description, {
      fontSize: '20px',
      color: '#bbbbbb',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    });
    this.levelDescriptionText.setOrigin(0.5);

    this.moveText = this.add.text(width * 0.25, height * 0.2, 'Moves: 0', {
      fontSize: `${UI_CONFIG.UI_TEXT_SIZE}px`,
      color: UI_CONFIG.TEXT_COLOR,
      fontFamily: 'Arial, sans-serif'
    });
    this.moveText.setOrigin(0.5);

    this.timeText = this.add.text(width * 0.75, height * 0.2, 'Time: 0s', {
      fontSize: `${UI_CONFIG.UI_TEXT_SIZE}px`,
      color: UI_CONFIG.TEXT_COLOR,
      fontFamily: 'Arial, sans-serif'
    });
    this.timeText.setOrigin(0.5);

    // Add home button at top-left
    this.homeButton = this.createSvgButton(
      width * 0.1,
      height * 0.08,
      'home',
      () => this.handleHomeButton(),
      0.06
    );

    // Add settings button at top-right
    this.settingsButton = this.createSvgButton(
      width * 0.9,
      height * 0.08,
      'settings',
      () => this.handleSettingsButton(),
      0.06
    );
  }

  private createSvgButton(
    x: number,
    y: number,
    svgKey: string,
    callback: () => void,
    scale: number = 0.08
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x2a2a3e, 1);
    bg.fillCircle(0, 0, 35);
    bg.lineStyle(2, 0x4a4a5e, 1);
    bg.strokeCircle(0, 0, 35);

    const svgImage = this.add.image(0, 0, svgKey);
    svgImage.setOrigin(0.5);
    svgImage.setScale(scale);

    container.add([bg, svgImage]);
    container.setSize(70, 70);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerdown', () => {
      this.tweens.add({
        targets: container,
        scale: 0.9,
        duration: 100,
        yoyo: true,
        onComplete: callback
      });
    });

    return container;
  }

  private handleTubeClick(tube: TubeVisual): void {
    if (!this.isGameActive || this.isAnimating) {
      return;
    }

    if (!this.selectedTube) {
      if (!tube.getTube().isEmpty()) {
        this.selectedTube = tube;
        tube.setSelected(true);
      }
    } else if (this.selectedTube === tube) {
      this.selectedTube.setSelected(false);
      this.selectedTube = null;
    } else {
      this.attemptPour(this.selectedTube, tube);
    }
  }

  private async attemptPour(source: TubeVisual, dest: TubeVisual): Promise<void> {
    const sourceIndex = source.getIndex();
    const destIndex = dest.getIndex();

    if (this.gameState.isValidMove(sourceIndex, destIndex)) {
      this.isAnimating = true;

      const sourceTube = this.gameState.getTube(sourceIndex)!;
      const color = sourceTube.getTopColor()!;
      const units = sourceTube.calculatePourAmount(this.gameState.getTube(destIndex)!);

      this.gameState.executeMove(sourceIndex, destIndex);

      await this.pourAnimation.animatePour(source, dest, color, units);

      source.setSelected(false);
      this.selectedTube = null;

      this.updateUI();

      this.isAnimating = false;

      if (this.gameState.isGameWon()) {
        this.handleWin();
      }
    } else {
      dest.animateInvalidMove();
      this.cameras.main.shake(ANIMATION_CONFIG.SHAKE_DURATION, 0.005);

      source.setSelected(false);
      this.selectedTube = null;
    }
  }

  private handleHomeButton(): void {
    this.showPauseModal('home');
  }

  private handleSettingsButton(): void {
    this.showPauseModal('settings');
  }

  private showPauseModal(type: 'home' | 'settings'): void {
    if (this.isPaused) return;
    
    this.isPaused = true;
    this.scene.pause();
    
    this.createPauseModal(type);
  }

  private createPauseModal(type: 'home' | 'settings'): void {
    const { width, height } = this.cameras.main;
    
    // Create a single container for everything
    this.pauseModal = this.add.container(0, 0);
    this.pauseModal.setDepth(1000);
    
    // Create backdrop
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    backdrop.setInteractive();
    backdrop.on('pointerdown', () => {
      if (type === 'home') {
        this.hidePauseModal();
      }
    });
    
    // Create modal panel
    const panel = this.add.rectangle(width / 2, height / 2, width * 0.8, height * 0.6, 0x2a2a3e);
    panel.setStrokeStyle(4, 0x4a4a5e);
    
    // Create title
    const title = this.add.text(width / 2, height * 0.25, 
      type === 'home' ? 'Pause Menu' : 'Settings', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });
    title.setOrigin(0.5);
    
    this.pauseModal.add([backdrop, panel, title]);
    
    if (type === 'home') {
      // Home modal content
      const content = this.add.text(width / 2, height * 0.4, 
        'Game is paused.\nClick outside to resume or use the buttons below.', {
        fontSize: '18px',
        color: '#cccccc',
        fontFamily: 'Arial, sans-serif',
        align: 'center'
      });
      content.setOrigin(0.5);
      
      const resumeButton = this.createSimpleButton(width / 2, height * 0.55, 'Resume', () => {
        this.hidePauseModal();
      });
      
      this.pauseModal.add([content, resumeButton]);
    } else {
      // Settings modal - create buttons individually and add them
      const menuItems = [
        { text: 'Return to Lobby', action: () => this.handleReturnToLobby() },
        { text: 'Help & Tutorial', action: () => this.handleHelpTutorial() },
        { text: 'Game Info', action: () => this.handleGameInfo() },
        { text: 'Close', action: () => this.hidePauseModal() }
      ];
      
      const startY = height * 0.35;
      const buttonSpacing = height * 0.08;
      
      menuItems.forEach((item, index) => {
        const button = this.createSimpleButton(
          width / 2, 
          startY + (index * buttonSpacing), 
          item.text, 
          item.action
        );
        this.pauseModal!.add(button);
      });
    }
  }

  private createSimpleButton(x: number, y: number, text: string, callback: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    const buttonWidth = 200;
    const buttonHeight = 40;
    
    // Create button background
    const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x4a4a5e);
    bg.setStrokeStyle(2, 0x6a6a7e);
    
    // Create button text
    const buttonText = this.add.text(0, 0, text, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });
    buttonText.setOrigin(0.5);
    
    container.add([bg, buttonText]);
    
    // Make the entire container interactive
    container.setSize(buttonWidth, buttonHeight);
    container.setInteractive({ useHandCursor: true });
    
    // Add event handlers directly to container
    container.on('pointerover', () => {
      bg.setFillStyle(0x5a5a6e);
      container.setScale(1.05);
    });
    
    container.on('pointerout', () => {
      bg.setFillStyle(0x4a4a5e);
      container.setScale(1);
    });
    
    container.on('pointerdown', () => {
      container.setScale(0.95);
      
      // Execute callback after visual feedback
      this.time.delayedCall(100, () => {
        container.setScale(1.05); // Return to hover state briefly
        callback();
      });
    });
    
    return container;
  }

  private hidePauseModal(): void {
    if (this.pauseModal) {
      this.pauseModal.destroy();
      this.pauseModal = undefined;
    }
    
    this.isPaused = false;
    this.scene.resume();
  }

  private handleReturnToLobby(): void {
    // Show confirmation dialog
    this.hidePauseModal();
    this.showReturnToLobbyConfirmation();
  }

  private handleHelpTutorial(): void {
    this.hidePauseModal();
    // TODO: Implement help/tutorial functionality
    console.log('Help & Tutorial clicked - functionality to be implemented');
  }

  private handleGameInfo(): void {
    this.hidePauseModal();
    // TODO: Implement game info functionality  
    console.log('Game Info clicked - functionality to be implemented');
  }

  private showReturnToLobbyConfirmation(): void {
    const { width, height } = this.cameras.main;
    
    this.isPaused = true;
    this.scene.pause();
    
    // Create confirmation modal
    this.pauseModal = this.add.container(0, 0);
    this.pauseModal.setDepth(1000);
    
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    backdrop.setInteractive();
    
    const panel = this.add.rectangle(width / 2, height / 2, width * 0.8, height * 0.5, 0x2a2a3e);
    panel.setStrokeStyle(4, 0x4a4a5e);
    
    const title = this.add.text(width / 2, height * 0.35, 'Return to Lobby?', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });
    title.setOrigin(0.5);
    
    const content = this.add.text(width / 2, height * 0.45, 
      'Are you sure you want to leave the game?\nYour progress will be lost.', {
      fontSize: '18px',
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif',
      align: 'center'
    });
    content.setOrigin(0.5);
    
    const yesButton = this.createSimpleButton(width * 0.35, height * 0.6, 'Yes', () => {
      this.hidePauseModal();
      this.scene.start('MainMenu');
    });
    
    const noButton = this.createSimpleButton(width * 0.65, height * 0.6, 'No', () => {
      this.hidePauseModal();
    });
    
    this.pauseModal.add([backdrop, panel, title, content, yesButton, noButton]);
  }

  private updateUI(): void {
    const stats = this.gameState.getStats();
    this.moveText.setText(`Moves: ${stats.moves}`);

    this.updateTimeText();
  }

  private layoutUI(width: number, height: number): void {
    if (!this.titleText) {
      return;
    }

    const titleFont = this.getResponsiveFontSize(36, width, height);
    const levelFont = this.getResponsiveFontSize(24, width, height);
    const descriptionFont = this.getResponsiveFontSize(18, width, height);
    const infoFont = this.getResponsiveFontSize(UI_CONFIG.UI_TEXT_SIZE, width, height);

    this.titleText.setFontSize(titleFont);
    this.titleText.setPosition(width / 2, height * 0.08);

    this.levelText.setFontSize(levelFont);
    this.levelText.setPosition(width / 2, height * 0.14);

    this.levelDescriptionText.setFontSize(descriptionFont);
    this.levelDescriptionText.setWordWrapWidth(width * 0.8, true);
    this.levelDescriptionText.setPosition(width / 2, height * 0.19);

    const infoY = height * 0.25;
    this.moveText.setFontSize(infoFont);
    this.timeText.setFontSize(infoFont);
    this.moveText.setPosition(width * 0.25, infoY);
    this.timeText.setPosition(width * 0.75, infoY);

    // Position home and settings buttons at the top
    const topButtonY = height * 0.05;
    const topButtonScale = Phaser.Math.Clamp(Math.min(width / 1200, height / 1200), 0.6, 1.0);
    this.homeButton.setPosition(width * 0.08, topButtonY);
    this.homeButton.setScale(topButtonScale);
    this.settingsButton.setPosition(width * 0.92, topButtonY);
    this.settingsButton.setScale(topButtonScale);
  }

  private updateTimeText(): void {
    if (!this.timeText) {
      return;
    }

    const clampedTime = Math.max(0, Math.ceil(this.remainingTime));
    this.timeText.setText(`TIME LEFT: ${clampedTime}s`);
  }

  private handleWin(): void {
    if (!this.isGameActive) {
      return;
    }

    this.isGameActive = false;

    if (this.timeInterval) {
      this.timeInterval.remove(false);
      this.timeInterval = undefined;
    }
    if (this.countdownEvent) {
      this.countdownEvent.remove(false);
      this.countdownEvent = undefined;
    }

    const { width, height } = this.cameras.main;
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 200, () => {
        const x = width * (0.2 + Math.random() * 0.6);
        const y = height * (0.3 + Math.random() * 0.4);
        this.createWinParticles(x, y);
      });
    }

    this.time.delayedCall(1500, () => {
      this.cameras.main.fade(500);
      this.time.delayedCall(500, () => {
        this.scene.start('MainMenu');
      });
    });
  }

  private startLevelTimer(): void {
    if (this.timeInterval) {
      this.timeInterval.remove(false);
    }

    this.timeInterval = this.time.addEvent({
      delay: 1000,
      loop: true,
      callbackScope: this,
      callback: this.handleTimerTick
    });
  }

  private handleTimerTick(): void {
    if (!this.isGameActive) {
      return;
    }

    this.remainingTime = Math.max(0, this.remainingTime - 1);
    this.updateTimeText();
    this.gameState.getElapsedTime();

    if (this.remainingTime <= 0) {
      this.handleTimeUp();
    }
  }

  private getLevelTimeLimit(levelIndex: number): number {
    return GAME_CONFIG.LEVEL_TIME_BASE + levelIndex * GAME_CONFIG.LEVEL_TIME_INCREMENT;
  }

  private showHintOverlay(): void {
    const { width, height } = this.scale;

    this.clearHintOverlay();

    const container = this.add.container(0, 0);
    container.setDepth(1000);
    container.setAlpha(1);

    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65);
    backdrop.setInteractive({ useHandCursor: true });

    const panel = this.add.rectangle(width / 2, height / 2, Math.min(width * 0.75, 680), Math.min(height * 0.6, 460), 0x252543, 0.95);
    panel.setStrokeStyle(3, 0x4a90e2, 0.8);
    panel.setInteractive({ useHandCursor: true });

    const title = this.add.text(0, 0, 'How to Play', {
      fontSize: '36px',
      color: UI_CONFIG.TEXT_COLOR,
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    });
    title.setOrigin(0.5);

    const instructions = this.add.text(0, 0, '1. Tap a tube to select it.\n2. Tap another tube to pour.\n3. Fill each tube with a single color before time runs out!', {
      fontSize: '22px',
      color: '#d7d7d7',
      fontFamily: 'Arial, sans-serif',
      align: 'center',
      lineSpacing: 12,
      wordWrap: { width: Math.min(width * 0.6, 540) }
    });
    instructions.setOrigin(0.5);

    const prompt = this.add.text(0, 0, 'Preparing puzzle...', {
      fontSize: '20px',
      color: '#b7d9ff',
      fontFamily: 'Arial, sans-serif'
    });
    prompt.setOrigin(0.5);

    const countdown = this.add.text(0, 0, '', {
      fontSize: '64px',
      color: UI_CONFIG.TEXT_COLOR,
      fontFamily: 'Arial Black'
    });
    countdown.setOrigin(0.5);
    countdown.setAlpha(0);

    container.add([backdrop, panel, title, instructions, prompt, countdown]);

    this.hintContainer = container;
    this.hintBackdrop = backdrop;
    this.hintPanel = panel;
    this.hintTitle = title;
    this.hintBody = instructions;
    this.hintPrompt = prompt;
    this.countdownText = countdown;

    this.layoutHintOverlay(width, height);

    const startCountdown = () => {
      this.beginCountdown();
    };

    backdrop.once('pointerdown', startCountdown);
    panel.once('pointerdown', startCountdown);

    this.time.delayedCall(1600, () => this.beginCountdown());
  }

  private beginCountdown(): void {
    if (this.hasCountdownStarted || this.countdownEvent) {
      return;
    }

    this.hasCountdownStarted = true;

    if (this.hintBody) {
      this.tweens.add({
        targets: this.hintBody,
        alpha: 0.5,
        duration: 200
      });
    }

    if (this.hintPrompt) {
      this.hintPrompt.setText('Get ready...');
    }

    let current = 3;
    this.updateCountdownDisplay(current);

    this.countdownEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callbackScope: this,
      callback: () => {
        current -= 1;

        if (current > 0) {
          this.updateCountdownDisplay(current);
          return;
        }

        if (current === 0) {
          this.updateCountdownDisplay('Go!');
          this.countdownEvent?.remove(false);
          this.countdownEvent = undefined;
          this.time.delayedCall(600, () => {
            this.startGameplay();
          });
          return;
        }
      }
    });
  }

  private updateCountdownDisplay(value: number | string): void {
    if (!this.countdownText) {
      return;
    }

    this.countdownText.setAlpha(1);
    this.countdownText.setText(`${value}`);
    this.countdownText.setScale(0.4);

    this.tweens.add({
      targets: this.countdownText,
      scale: 1,
      duration: 250,
      ease: 'Back.easeOut'
    });
  }

  private startGameplay(): void {
    if (this.countdownEvent) {
      this.countdownEvent.remove(false);
      this.countdownEvent = undefined;
    }

    this.remainingTime = this.levelTimeLimit;
    this.updateTimeText();

    this.gameState.resetTimer();
    this.isGameActive = true;

    if (this.hintContainer) {
      this.tweens.add({
        targets: this.hintContainer,
        alpha: 0,
        duration: 250,
        onComplete: () => {
          this.clearHintOverlay();
        }
      });
    } else {
      this.clearHintOverlay();
    }

    this.startLevelTimer();
  }

  private handleTimeUp(): void {
    if (!this.isGameActive) {
      return;
    }

    this.isGameActive = false;

    if (this.timeInterval) {
      this.timeInterval.remove(false);
      this.timeInterval = undefined;
    }

    this.cameras.main.shake(200, 0.01);

    const { width, height } = this.scale;
    const timeoutText = this.add.text(width / 2, height * 0.5, "Time's up!", {
      fontSize: '48px',
      color: '#ff5b5b',
      fontFamily: 'Arial Black'
    });
    timeoutText.setOrigin(0.5);
    timeoutText.setDepth(1001);

    this.tweens.add({
      targets: timeoutText,
      alpha: { from: 0, to: 1 },
      duration: 200,
      yoyo: true,
      repeat: 1
    });

    this.time.delayedCall(1200, () => {
      this.cameras.main.fade(400, 0, 0, 0);
      this.time.delayedCall(420, () => {
        this.scene.start('MainMenu');
      });
    });
  }

  private layoutHintOverlay(width: number, height: number): void {
    if (!this.hintContainer || !this.hintBackdrop || !this.hintPanel) {
      return;
    }

    const panelWidth = Math.min(width * 0.75, 680);
    const panelHeight = Math.min(height * 0.6, 460);
    const centerX = width / 2;
    const centerY = height / 2;

    this.hintBackdrop.setPosition(centerX, centerY);
    this.hintBackdrop.setDisplaySize(width, height);

    this.hintPanel.setPosition(centerX, centerY);
    this.hintPanel.setDisplaySize(panelWidth, panelHeight);

    const titleFont = this.getResponsiveFontSize(32, width, height);
    const bodyFont = this.getResponsiveFontSize(20, width, height);
    const promptFont = this.getResponsiveFontSize(18, width, height);
    const countdownFont = this.getResponsiveFontSize(60, width, height);

    this.hintTitle?.setFontSize(titleFont);
    this.hintBody?.setFontSize(bodyFont);
    this.hintPrompt?.setFontSize(promptFont);
    this.countdownText?.setFontSize(countdownFont);

    this.hintTitle?.setPosition(centerX, centerY - panelHeight * 0.3);
    this.hintBody?.setPosition(centerX, centerY - panelHeight * 0.05);
    this.hintBody?.setWordWrapWidth(panelWidth * 0.85);
    this.hintPrompt?.setPosition(centerX, centerY + panelHeight * 0.25);
    this.countdownText?.setPosition(centerX, centerY + panelHeight * 0.05);
  }

  private clearHintOverlay(): void {
    if (this.hintContainer) {
      this.hintContainer.destroy(true);
    }

    this.hintContainer = undefined;
    this.hintBackdrop = undefined;
    this.hintPanel = undefined;
    this.hintTitle = undefined;
    this.hintBody = undefined;
    this.hintPrompt = undefined;
    this.countdownText = undefined;
  }

  private createWinParticles(x: number, y: number): void {
    const colors = [0xff4da6, 0x4bf77a, 0x8b5cff, 0x3fb6ff, 0xffd23f, 0xff5b5b];

    const particles = this.add.particles(x, y, FUEL_SORT_PARTICLE_KEY, {
      speed: { min: 100, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 1000,
      quantity: 30,
      tint: colors,
      blendMode: 'ADD',
      gravityY: 200
    });

    this.time.delayedCall(1200, () => {
      particles.destroy();
    });
  }

  update(): void {}

  private handleResize = (gameSize: Phaser.Structs.Size) => {
    if (!this.scene.isActive()) {
      return;
    }

    const width = gameSize.width;
    const height = gameSize.height;

    this.cameras.resize(width, height);

    this.drawBackground(width, height);
    this.positionBackgroundDecorations(width, height);
    this.positionTubes(width, height);
    this.layoutUI(width, height);
    this.layoutHintOverlay(width, height);
  };

  private drawBackground(width: number, height: number): void {
    if (!this.backgroundGraphics) {
      return;
    }
    this.backgroundGraphics.clear();
    this.backgroundGraphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    this.backgroundGraphics.fillRect(0, 0, width, height);
  }

  private positionBackgroundDecorations(width: number, height: number): void {
    if (this.backgroundDecorations.length === 0) {
      return;
    }

    const minDim = Math.min(width, height);
    const circle1 = this.backgroundDecorations[0];
    circle1.setPosition(width * 0.2, height * 0.15);
    circle1.setDisplaySize(minDim * 0.24, minDim * 0.24);

    if (this.backgroundDecorations[1]) {
      const circle2 = this.backgroundDecorations[1];
      circle2.setPosition(width * 0.8, height * 0.85);
      circle2.setDisplaySize(minDim * 0.36, minDim * 0.36);
    }
  }

  private positionTubes(width: number, height: number): void {
    if (this.tubeVisuals.length === 0) {
      return;
    }

    const scaleFactor = this.getTubeScale(width, height, this.tubeVisuals.length);
    const positions = this.calculateTubePositions(width, height, this.tubeVisuals.length, scaleFactor);

    this.tubeVisuals.forEach((tube, index) => {
      const pos = positions[index];
      tube.setBasePosition(pos.x, pos.y);
      tube.setScale(scaleFactor);
    });
  }

  private getTubeScale(width: number, height: number, totalTubes: number): number {
    if (totalTubes <= 0) {
      return 1;
    }

    const baseScale = Phaser.Math.Clamp(Math.min(width / 900, height / 1200), 0.5, 1.1);
    const minScale = 0.45;
    let scale = baseScale;

    if (totalTubes === 1) {
      return scale;
    }

    for (let i = 0; i < 8; i += 1) {
      const tubeWidth = TUBE_CONFIG.WIDTH * scale;
      const horizontalMargin = Math.max(width * 0.05, tubeWidth * 0.6);
      const usableWidth = width - horizontalMargin * 2;

      if (usableWidth <= tubeWidth || scale <= minScale) {
        scale = Math.max(scale, minScale);
        break;
      }

      const spacing = (usableWidth - tubeWidth) / (totalTubes - 1);

      if (spacing >= tubeWidth * 0.9) {
        break;
      }

      scale = Math.max(scale - 0.05, minScale);
    }

    return Phaser.Math.Clamp(scale, minScale, 1.1);
  }

  private calculateTubePositions(
    width: number,
    height: number,
    totalTubes: number,
    scaleFactor: number
  ): { x: number; y: number }[] {
    if (totalTubes === 0) {
      return [];
    }

    const topCount = totalTubes <= 4 ? totalTubes : Math.ceil(totalTubes / 2);
    const bottomCount = Math.max(0, totalTubes - topCount);
    const rowCounts = bottomCount > 0 ? [topCount, bottomCount] : [topCount];
    const positions: { x: number; y: number }[] = [];

    const tubeWidth = TUBE_CONFIG.WIDTH * scaleFactor;
    const tubeHeight = TUBE_CONFIG.HEIGHT * scaleFactor;
    const horizontalMargin = Math.max(width * 0.05, tubeWidth * 0.6);
    const usableWidth = Math.max(width - horizontalMargin * 2, tubeWidth);

    const rows = rowCounts.length;
    const portrait = height > width;
    const topReserve = portrait
      ? Math.max(height * 0.08, 70 * scaleFactor)
      : Math.max(height * 0.12, 90 * scaleFactor);
    const bottomReserve = portrait
      ? Math.max(height * 0.12, 110 * scaleFactor)
      : Math.max(height * 0.16, 140 * scaleFactor);
    const usableHeight = Math.max(height - (topReserve + bottomReserve), tubeHeight + 100 * scaleFactor);

    let rowSpacing = 0;
    if (rows > 1) {
      const evenSpacing = usableHeight / Math.max(rows - 1, 1);
      const minSpacing = tubeHeight * (portrait ? 0.7 : 0.8);
      const maxSpacing = tubeHeight * (portrait ? 1.05 : 1.25);
      rowSpacing = Phaser.Math.Clamp(evenSpacing, minSpacing, maxSpacing);
    }

    const totalCoveredHeight = rows > 1 ? rowSpacing * (rows - 1) : 0;
    let startY: number;
    if (rows === 1) {
      const centerFactor = portrait ? 0.58 : 0.5;
      startY = topReserve + usableHeight * centerFactor;
    } else {
      const leftover = Math.max(usableHeight - totalCoveredHeight, 0);
      startY = topReserve + leftover / 2;
    }

    rowCounts.forEach((count, rowIndex) => {
      const rowY = startY + rowIndex * rowSpacing;
      if (count === 1) {
        positions.push({ x: width / 2, y: rowY });
        return;
      }

      const spacingDenominator = Math.max(count - 1, 1);
      const placementSpan = Math.max(usableWidth - tubeWidth, 0);
      let spacing = spacingDenominator > 0 ? placementSpan / spacingDenominator : 0;
      const maxSpacing = TUBE_CONFIG.SPACING_X * Math.max(scaleFactor, 0.7);
      spacing = Math.min(spacing, maxSpacing);

      const totalRowWidth = spacing * (count - 1);
      const minStart = horizontalMargin + tubeWidth / 2;
      const maxStart = width - horizontalMargin - tubeWidth / 2 - totalRowWidth;
      let startX = width / 2 - totalRowWidth / 2;
      startX = Phaser.Math.Clamp(startX, minStart, Math.max(minStart, maxStart));

      for (let i = 0; i < count; i++) {
        positions.push({ x: startX + i * spacing, y: rowY });
      }
    });

    return positions;
  }

  private getResponsiveFontSize(base: number, width: number, height: number): number {
    const scaleFactor = Phaser.Math.Clamp(Math.min(width / 768, height / 1024), 0.65, 1.25);
    return Math.round(base * scaleFactor);
  }

  private generateLevelFromConfig(configManager: ConfigurationManager): LevelDefinition {
    const difficulty = configManager.getCurrentDifficulty();
    const processedConfig = configManager.getProcessedConfiguration(difficulty);
    
    return {
      id: 1, // Use a numeric id
      name: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Mode`,
      description: `Target Score: ${processedConfig.difficulty.targetScore}`,
      tubes: processedConfig.tubes // Use the pre-configured tube arrangement
    };
  }

}

export default FuelSortScene;
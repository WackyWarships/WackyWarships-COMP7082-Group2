import Phaser from 'phaser';
import { ConfigurationManager, DifficultyLevel } from '../config/ConfigurationManager';
import { UI_CONFIG } from '../config/Constants';

export class AdminPanelScene extends Phaser.Scene {
  private configManager!: ConfigurationManager;
  private currentDifficulty: string = 'easy';
  private isDirty: boolean = false;

  // UI Elements
  private background!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private backButton!: Phaser.GameObjects.Container;
  private saveButton!: Phaser.GameObjects.Container;
  private exportButton!: Phaser.GameObjects.Container;
  private importButton!: Phaser.GameObjects.Container;

  // Difficulty Selection
  private difficultyContainer!: Phaser.GameObjects.Container;
  private difficultyButtons: Phaser.GameObjects.Container[] = [];

  // Configuration Panel
  private configPanel!: Phaser.GameObjects.Container;
  private configBackground!: Phaser.GameObjects.Graphics;
  
  // Form Elements
  private formElements: {
    nameInput?: HTMLInputElement;
    descriptionInput?: HTMLTextAreaElement;
    totalTubesInput?: HTMLInputElement;
    filledTubesInput?: HTMLInputElement;
    targetScoreInput?: HTMLInputElement;
    timeLimitInput?: HTMLInputElement;
    maxUndosInput?: HTMLInputElement;
  } = {};

  private colorInputs: Record<string, HTMLInputElement> = {};
  private tubeConfigTextArea?: HTMLTextAreaElement;

  constructor() {
    super({ key: 'AdminPanel' });
  }

  create(): void {
    this.configManager = ConfigurationManager.getInstance();
    const { width, height } = this.scale;

    this.createBackground(width, height);
    this.createHeader(width, height);
    this.createDifficultySelector(width, height);
    this.createConfigurationPanel(width, height);
    this.createActionButtons(width, height);

    this.loadCurrentConfiguration();

    // Handle resize
    this.scale.on('resize', this.handleResize, this);
  }

  private createBackground(width: number, height: number): void {
    this.background = this.add.graphics();
    this.background.fillStyle(0x1a1a2e);
    this.background.fillRect(0, 0, width, height);
  }

  private createHeader(width: number, height: number): void {
    this.titleText = this.add.text(width / 2, 50, 'Game Configuration Admin Panel', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Back button
    this.backButton = this.createButton(50, 50, 'Back', () => {
      if (this.isDirty) {
        this.showConfirmDialog('You have unsaved changes. Are you sure you want to go back?', () => {
          this.scene.start('MainMenu');
        });
      } else {
        this.scene.start('MainMenu');
      }
    });
  }

  private createDifficultySelector(width: number, height: number): void {
    this.difficultyContainer = this.add.container(0, 120);

    const difficulties = this.configManager.getAllDifficultyLevels();
    const buttonWidth = 150;
    const spacing = 20;
    const totalWidth = Object.keys(difficulties).length * buttonWidth + (Object.keys(difficulties).length - 1) * spacing;
    const startX = (width - totalWidth) / 2;

    Object.keys(difficulties).forEach((difficulty, index) => {
      const x = startX + index * (buttonWidth + spacing);
      const button = this.createDifficultyButton(x, 0, difficulty, difficulties[difficulty].name);
      this.difficultyButtons.push(button);
      this.difficultyContainer.add(button);
    });

    this.updateDifficultySelection();
  }

  private createDifficultyButton(x: number, y: number, difficulty: string, name: string): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    const background = this.add.graphics();
    background.fillStyle(0x4a90e2);
    background.fillRoundedRect(-75, -25, 150, 50, 10);
    
    const text = this.add.text(0, 0, name, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);

    container.add([background, text]);
    container.setInteractive(new Phaser.Geom.Rectangle(-75, -25, 150, 50), Phaser.Geom.Rectangle.Contains);
    
    container.on('pointerdown', () => {
      this.selectDifficulty(difficulty);
    });

    container.on('pointerover', () => {
      background.clear();
      background.fillStyle(0x5ba3f5);
      background.fillRoundedRect(-75, -25, 150, 50, 10);
    });

    container.on('pointerout', () => {
      const isSelected = this.currentDifficulty === difficulty;
      background.clear();
      background.fillStyle(isSelected ? 0x2d5aa0 : 0x4a90e2);
      background.fillRoundedRect(-75, -25, 150, 50, 10);
    });

    return container;
  }

  private createConfigurationPanel(width: number, height: number): void {
    this.configPanel = this.add.container(0, 200);
    
    this.configBackground = this.add.graphics();
    this.configBackground.fillStyle(0x2a2a3e, 0.9);
    this.configBackground.fillRoundedRect(50, 0, width - 100, height - 300, 10);
    this.configPanel.add(this.configBackground);

    this.createFormElements(width, height);
  }

  private createFormElements(width: number, height: number): void {
    const formX = 80;
    let formY = 30;
    const lineHeight = 60;

    // Basic Configuration
    this.add.text(formX, formY, 'Basic Configuration', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    });
    formY += 40;

    // Name
    this.add.text(formX, formY, 'Name:', { fontSize: '16px', color: '#ffffff' });
    this.formElements.nameInput = this.createInput(formX + 200, formY - 10, 300, 30);
    formY += lineHeight;

    // Description
    this.add.text(formX, formY, 'Description:', { fontSize: '16px', color: '#ffffff' });
    this.formElements.descriptionInput = this.createTextArea(formX + 200, formY - 10, 300, 60);
    formY += 80;

    // Total Tubes
    this.add.text(formX, formY, 'Total Tubes:', { fontSize: '16px', color: '#ffffff' });
    this.formElements.totalTubesInput = this.createInput(formX + 200, formY - 10, 100, 30, 'number');
    formY += lineHeight;

    // Filled Tubes
    this.add.text(formX, formY, 'Filled Tubes:', { fontSize: '16px', color: '#ffffff' });
    this.formElements.filledTubesInput = this.createInput(formX + 200, formY - 10, 100, 30, 'number');
    formY += lineHeight;

    // Target Score
    this.add.text(formX, formY, 'Target Score:', { fontSize: '16px', color: '#ffffff' });
    this.formElements.targetScoreInput = this.createInput(formX + 200, formY - 10, 100, 30, 'number');
    formY += lineHeight;

    // Time Limit
    this.add.text(formX, formY, 'Time Limit (seconds):', { fontSize: '16px', color: '#ffffff' });
    this.formElements.timeLimitInput = this.createInput(formX + 200, formY - 10, 100, 30, 'number');
    formY += lineHeight;

    // Max Undos
    this.add.text(formX, formY, 'Max Undos:', { fontSize: '16px', color: '#ffffff' });
    this.formElements.maxUndosInput = this.createInput(formX + 200, formY - 10, 100, 30, 'number');
    formY += lineHeight + 20;

    // Color Palette Section
    this.add.text(formX, formY, 'Color Palette', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    });
    formY += 40;

    // Color inputs will be created dynamically based on current difficulty
    this.createColorInputs(formX, formY);
    formY += 200;

    // Tube Configuration
    this.add.text(formX, formY, 'Tube Configuration (JSON format):', {
      fontSize: '16px',
      color: '#ffffff'
    });
    formY += 30;
    this.tubeConfigTextArea = this.createTextArea(formX, formY, width - 160, 150);

    // Add change listeners
    this.addFormChangeListeners();
  }

  private createColorInputs(x: number, y: number): void {
    // Clear existing color inputs
    Object.values(this.colorInputs).forEach(input => {
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    });
    this.colorInputs = {};

    const difficulty = this.configManager.getDifficultyLevel(this.currentDifficulty);
    let currentY = y;

    Object.entries(difficulty.colorPalette).forEach(([colorName, colorValue]) => {
      this.add.text(x, currentY, `${colorName}:`, { fontSize: '16px', color: '#ffffff' });
      this.colorInputs[colorName] = this.createInput(x + 150, currentY - 10, 100, 30, 'color');
      this.colorInputs[colorName].value = colorValue;
      currentY += 40;
    });
  }

  private createInput(x: number, y: number, width: number, height: number, type: string = 'text'): HTMLInputElement {
    const input = document.createElement('input');
    input.type = type;
    input.style.position = 'absolute';
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;
    input.style.width = `${width}px`;
    input.style.height = `${height}px`;
    input.style.fontSize = '14px';
    input.style.padding = '5px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '4px';
    input.style.zIndex = '1000';

    document.body.appendChild(input);
    return input;
  }

  private createTextArea(x: number, y: number, width: number, height: number): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.style.position = 'absolute';
    textarea.style.left = `${x}px`;
    textarea.style.top = `${y}px`;
    textarea.style.width = `${width}px`;
    textarea.style.height = `${height}px`;
    textarea.style.fontSize = '12px';
    textarea.style.padding = '5px';
    textarea.style.border = '1px solid #ccc';
    textarea.style.borderRadius = '4px';
    textarea.style.fontFamily = 'monospace';
    textarea.style.zIndex = '1000';

    document.body.appendChild(textarea);
    return textarea;
  }

  private createActionButtons(width: number, height: number): void {
    const buttonY = height - 80;
    const buttonSpacing = 150;
    const centerX = width / 2;

    // Save Button
    this.saveButton = this.createButton(centerX - buttonSpacing, buttonY, 'Save Changes', () => {
      this.saveConfiguration();
    });

    // Export Button
    this.exportButton = this.createButton(centerX, buttonY, 'Export Config', () => {
      this.exportConfiguration();
    });

    // Import Button
    this.importButton = this.createButton(centerX + buttonSpacing, buttonY, 'Import Config', () => {
      this.importConfiguration();
    });
  }

  private createButton(x: number, y: number, text: string, callback: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    const background = this.add.graphics();
    background.fillStyle(UI_CONFIG.BUTTON_COLOR);
    background.fillRoundedRect(-75, -25, 150, 50, 10);
    
    const buttonText = this.add.text(0, 0, text, {
      fontSize: '16px',
      color: UI_CONFIG.TEXT_COLOR,
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);

    container.add([background, buttonText]);
    container.setInteractive(new Phaser.Geom.Rectangle(-75, -25, 150, 50), Phaser.Geom.Rectangle.Contains);
    
    container.on('pointerdown', callback);

    container.on('pointerover', () => {
      background.clear();
      background.fillStyle(UI_CONFIG.BUTTON_HOVER_COLOR);
      background.fillRoundedRect(-75, -25, 150, 50, 10);
    });

    container.on('pointerout', () => {
      background.clear();
      background.fillStyle(UI_CONFIG.BUTTON_COLOR);
      background.fillRoundedRect(-75, -25, 150, 50, 10);
    });

    return container;
  }

  private selectDifficulty(difficulty: string): void {
    if (this.isDirty) {
      this.showConfirmDialog('You have unsaved changes. Are you sure you want to switch difficulty?', () => {
        this.currentDifficulty = difficulty;
        this.updateDifficultySelection();
        this.loadCurrentConfiguration();
        this.isDirty = false;
      });
    } else {
      this.currentDifficulty = difficulty;
      this.updateDifficultySelection();
      this.loadCurrentConfiguration();
    }
  }

  private updateDifficultySelection(): void {
    this.difficultyButtons.forEach((button, index) => {
      const difficulties = Object.keys(this.configManager.getAllDifficultyLevels());
      const difficulty = difficulties[index];
      const background = button.list[0] as Phaser.GameObjects.Graphics;
      const isSelected = this.currentDifficulty === difficulty;
      
      background.clear();
      background.fillStyle(isSelected ? 0x2d5aa0 : 0x4a90e2);
      background.fillRoundedRect(-75, -25, 150, 50, 10);
    });
  }

  private loadCurrentConfiguration(): void {
    const difficulty = this.configManager.getDifficultyLevel(this.currentDifficulty);
    
    if (this.formElements.nameInput) this.formElements.nameInput.value = difficulty.name;
    if (this.formElements.descriptionInput) this.formElements.descriptionInput.value = difficulty.description;
    if (this.formElements.totalTubesInput) this.formElements.totalTubesInput.value = difficulty.totalTubes.toString();
    if (this.formElements.filledTubesInput) this.formElements.filledTubesInput.value = difficulty.filledTubes.toString();
    if (this.formElements.targetScoreInput) this.formElements.targetScoreInput.value = difficulty.targetScore.toString();
    if (this.formElements.timeLimitInput) this.formElements.timeLimitInput.value = difficulty.timeLimit.toString();
    if (this.formElements.maxUndosInput) this.formElements.maxUndosInput.value = difficulty.maxUndos.toString();

    // Recreate color inputs for current difficulty
    this.createColorInputs(80, 470);

    if (this.tubeConfigTextArea) {
      this.tubeConfigTextArea.value = JSON.stringify(difficulty.tubeConfiguration, null, 2);
    }

    this.isDirty = false;
  }

  private addFormChangeListeners(): void {
    const markDirty = () => { this.isDirty = true; };

    Object.values(this.formElements).forEach(element => {
      if (element) {
        element.addEventListener('input', markDirty);
      }
    });

    if (this.tubeConfigTextArea) {
      this.tubeConfigTextArea.addEventListener('input', markDirty);
    }
  }

  private saveConfiguration(): void {
    try {
      const updates: Partial<DifficultyLevel> = {};

      if (this.formElements.nameInput) updates.name = this.formElements.nameInput.value;
      if (this.formElements.descriptionInput) updates.description = this.formElements.descriptionInput.value;
      if (this.formElements.totalTubesInput) updates.totalTubes = parseInt(this.formElements.totalTubesInput.value);
      if (this.formElements.filledTubesInput) updates.filledTubes = parseInt(this.formElements.filledTubesInput.value);
      if (this.formElements.targetScoreInput) updates.targetScore = parseInt(this.formElements.targetScoreInput.value);
      if (this.formElements.timeLimitInput) updates.timeLimit = parseInt(this.formElements.timeLimitInput.value);
      if (this.formElements.maxUndosInput) updates.maxUndos = parseInt(this.formElements.maxUndosInput.value);

      // Update color palette
      const colorPalette: Record<string, string> = {};
      Object.entries(this.colorInputs).forEach(([colorName, input]) => {
        colorPalette[colorName] = input.value;
      });
      updates.colorPalette = colorPalette;

      // Update tube configuration
      if (this.tubeConfigTextArea) {
        updates.tubeConfiguration = JSON.parse(this.tubeConfigTextArea.value);
      }

      this.configManager.updateDifficultyLevel(this.currentDifficulty, updates);
      this.isDirty = false;
      this.showMessage('Configuration saved successfully!', 0x00ff00);
    } catch (error) {
      this.showMessage(`Error saving configuration: ${error instanceof Error ? error.message : 'Unknown error'}`, 0xff0000);
    }
  }

  private exportConfiguration(): void {
    const config = this.configManager.exportConfiguration();
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game-configuration.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showMessage('Configuration exported successfully!', 0x00ff00);
  }

  private importConfiguration(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const config = e.target?.result as string;
            this.configManager.importConfiguration(config);
            this.loadCurrentConfiguration();
            this.showMessage('Configuration imported successfully!', 0x00ff00);
          } catch (error) {
            this.showMessage(`Error importing configuration: ${error instanceof Error ? error.message : 'Unknown error'}`, 0xff0000);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  private showMessage(message: string, color: number): void {
    const messageText = this.add.text(this.scale.width / 2, this.scale.height / 2, message, {
      fontSize: '24px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontFamily: 'Arial, sans-serif',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5);

    this.time.delayedCall(3000, () => {
      messageText.destroy();
    });
  }

  private showConfirmDialog(message: string, onConfirm: () => void): void {
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);

    const dialog = this.add.container(this.scale.width / 2, this.scale.height / 2);
    
    const background = this.add.graphics();
    background.fillStyle(0x2a2a3e);
    background.fillRoundedRect(-200, -100, 400, 200, 10);
    
    const messageText = this.add.text(0, -30, message, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      align: 'center',
      wordWrap: { width: 350 }
    }).setOrigin(0.5);

    const confirmButton = this.createButton(-80, 40, 'Yes', () => {
      overlay.destroy();
      dialog.destroy();
      onConfirm();
    });

    const cancelButton = this.createButton(80, 40, 'No', () => {
      overlay.destroy();
      dialog.destroy();
    });

    dialog.add([background, messageText, confirmButton, cancelButton]);
  }

  private handleResize = (gameSize: Phaser.Structs.Size): void => {
    const { width, height } = gameSize;
    this.createBackground(width, height);
    // Update other UI elements positions as needed
  };

  private cleanupHTMLElements(): void {
    // Clean up HTML elements
    Object.values(this.formElements).forEach(element => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });

    Object.values(this.colorInputs).forEach(input => {
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    });

    if (this.tubeConfigTextArea && this.tubeConfigTextArea.parentNode) {
      this.tubeConfigTextArea.parentNode.removeChild(this.tubeConfigTextArea);
    }
  }

  init(data?: any): void {
    // Clean up any existing HTML elements when scene starts
    this.cleanupHTMLElements();
  }
}

export default AdminPanelScene;
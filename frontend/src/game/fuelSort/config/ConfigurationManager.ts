import { ColorType } from './Constants';
import difficultyConfig from './difficulty-config.json';

export interface DifficultyLevel {
  id: string;
  name: string;
  description: string;
  totalTubes: number;
  filledTubes: number;
  emptyTubes: number;
  targetScore: number;
  timeLimit: number;
  maxUndos: number;
  colorPalette: Record<string, string>;
  tubeConfiguration: string[][];
}

export interface GameConfiguration {
  version: string;
  lastModified: string;
  difficultyLevels: Record<string, DifficultyLevel>;
  defaultDifficulty: string;
  scoring: {
    basePoints: number;
    timeBonus: number;
    undosPenalty: number;
    perfectGameBonus: number;
  };
  ui: {
    adaptiveLayout: boolean;
    maxTubesPerRow: number;
    tubeSpacing: {
      x: number;
      y: number;
    };
    scalingFactors: {
      mobile: number;
      tablet: number;
      desktop: number;
    };
  };
}

export interface ProcessedTubeConfiguration {
  tubes: ColorType[][];
  colors: Record<string, ColorType>;
  difficulty: DifficultyLevel;
}

export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private configuration: GameConfiguration;
  private currentDifficulty: string;

  private constructor() {
    this.configuration = difficultyConfig as GameConfiguration;
    this.currentDifficulty = this.configuration.defaultDifficulty;
    this.validateConfiguration();
  }

  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate version
    if (!this.configuration.version) {
      errors.push('Configuration version is required');
    }

    // Validate difficulty levels
    if (!this.configuration.difficultyLevels || Object.keys(this.configuration.difficultyLevels).length === 0) {
      errors.push('At least one difficulty level must be defined');
    }

    // Validate default difficulty exists
    if (!this.configuration.difficultyLevels[this.configuration.defaultDifficulty]) {
      errors.push(`Default difficulty '${this.configuration.defaultDifficulty}' does not exist`);
    }

    // Validate each difficulty level
    Object.entries(this.configuration.difficultyLevels).forEach(([key, level]) => {
      this.validateDifficultyLevel(key, level, errors);
    });

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  private validateDifficultyLevel(key: string, level: DifficultyLevel, errors: string[]): void {
    const prefix = `Difficulty '${key}'`;

    // Basic properties validation
    if (!level.id || !level.name || !level.description) {
      errors.push(`${prefix}: id, name, and description are required`);
    }

    if (level.totalTubes <= 0) {
      errors.push(`${prefix}: totalTubes must be positive`);
    }

    if (level.filledTubes < 0 || level.emptyTubes < 0) {
      errors.push(`${prefix}: filledTubes and emptyTubes must be non-negative`);
    }

    if (level.filledTubes + level.emptyTubes !== level.totalTubes) {
      errors.push(`${prefix}: filledTubes + emptyTubes must equal totalTubes`);
    }

    if (level.targetScore <= 0) {
      errors.push(`${prefix}: targetScore must be positive`);
    }

    if (level.timeLimit <= 0) {
      errors.push(`${prefix}: timeLimit must be positive`);
    }

    if (level.maxUndos < 0) {
      errors.push(`${prefix}: maxUndos must be non-negative`);
    }

    // Validate color palette
    if (!level.colorPalette || Object.keys(level.colorPalette).length === 0) {
      errors.push(`${prefix}: colorPalette must contain at least one color`);
    }

    // Validate tube configuration
    if (!level.tubeConfiguration || level.tubeConfiguration.length !== level.totalTubes) {
      errors.push(`${prefix}: tubeConfiguration must have exactly ${level.totalTubes} tubes`);
    }

    // Validate tube contents
    let emptyTubeCount = 0;
    level.tubeConfiguration.forEach((tube, index) => {
      if (tube.length === 0) {
        emptyTubeCount++;
      } else if (tube.length > 4) {
        errors.push(`${prefix}: Tube ${index} has more than 4 units`);
      }

      // Validate color references
      tube.forEach((colorRef, unitIndex) => {
        if (!level.colorPalette[colorRef]) {
          errors.push(`${prefix}: Tube ${index}, unit ${unitIndex} references undefined color '${colorRef}'`);
        }
      });
    });

    if (emptyTubeCount !== level.emptyTubes) {
      errors.push(`${prefix}: Expected ${level.emptyTubes} empty tubes, found ${emptyTubeCount}`);
    }
  }

  public getCurrentDifficulty(): string {
    return this.currentDifficulty;
  }

  public setCurrentDifficulty(difficulty: string): void {
    if (!this.configuration.difficultyLevels[difficulty]) {
      throw new Error(`Difficulty '${difficulty}' does not exist`);
    }
    this.currentDifficulty = difficulty;
  }

  public getDifficultyLevel(difficulty?: string): DifficultyLevel {
    const targetDifficulty = difficulty || this.currentDifficulty;
    const level = this.configuration.difficultyLevels[targetDifficulty];
    if (!level) {
      throw new Error(`Difficulty '${targetDifficulty}' does not exist`);
    }
    return level;
  }

  public getAllDifficultyLevels(): Record<string, DifficultyLevel> {
    return { ...this.configuration.difficultyLevels };
  }

  // public getProcessedConfiguration(difficulty?: string): ProcessedTubeConfiguration {
  //   const level = this.getDifficultyLevel(difficulty);
    
  //   // Convert color palette to ColorType values
  //   const colors: Record<string, ColorType> = {};
  //   Object.entries(level.colorPalette).forEach(([key, hexValue]) => {
  //     colors[key] = hexValue as ColorType;
  //   });

  //   // Convert tube configuration to use actual color values
  //   const tubes: ColorType[][] = level.tubeConfiguration.map(tube => 
  //     tube.map(colorRef => colors[colorRef])
  //   );

  //   return {
  //     tubes,
  //     colors,
  //     difficulty: level
  //   };
  // }

  public getConfiguration(): GameConfiguration {
    return { ...this.configuration };
  }

  public updateConfiguration(newConfig: Partial<GameConfiguration>): void {
    this.configuration = { ...this.configuration, ...newConfig };
    this.validateConfiguration();
  }

  public updateDifficultyLevel(difficulty: string, updates: Partial<DifficultyLevel>): void {
    if (!this.configuration.difficultyLevels[difficulty]) {
      throw new Error(`Difficulty '${difficulty}' does not exist`);
    }

    this.configuration.difficultyLevels[difficulty] = {
      ...this.configuration.difficultyLevels[difficulty],
      ...updates
    };

    this.validateConfiguration();
  }

  public addDifficultyLevel(difficulty: string, level: DifficultyLevel): void {
    if (this.configuration.difficultyLevels[difficulty]) {
      throw new Error(`Difficulty '${difficulty}' already exists`);
    }

    this.configuration.difficultyLevels[difficulty] = level;
    this.validateConfiguration();
  }

  public removeDifficultyLevel(difficulty: string): void {
    if (!this.configuration.difficultyLevels[difficulty]) {
      throw new Error(`Difficulty '${difficulty}' does not exist`);
    }

    if (difficulty === this.configuration.defaultDifficulty) {
      throw new Error('Cannot remove the default difficulty level');
    }

    if (Object.keys(this.configuration.difficultyLevels).length <= 1) {
      throw new Error('Cannot remove the last difficulty level');
    }

    delete this.configuration.difficultyLevels[difficulty];

    if (this.currentDifficulty === difficulty) {
      this.currentDifficulty = this.configuration.defaultDifficulty;
    }
  }

  public exportConfiguration(): string {
    return JSON.stringify(this.configuration, null, 2);
  }

  public importConfiguration(configJson: string): void {
    try {
      const newConfig = JSON.parse(configJson) as GameConfiguration;
      this.configuration = newConfig;
      this.validateConfiguration();
      this.currentDifficulty = this.configuration.defaultDifficulty;
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public getScoringConfig() {
    return { ...this.configuration.scoring };
  }

  public getUIConfig() {
    return { ...this.configuration.ui };
  }
}

export default ConfigurationManager;
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ConfigurationManager } from '../ConfigurationManager'

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager
  
  beforeEach(() => {
    // Reset singleton instance before each test
    // @ts-ignore - accessing private static property for testing
    ConfigurationManager.instance = undefined
    configManager = ConfigurationManager.getInstance()
  })

  afterEach(() => {
    // Clean up after each test
    // @ts-ignore - accessing private static property for testing
    ConfigurationManager.instance = undefined
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = ConfigurationManager.getInstance()
      const instance2 = ConfigurationManager.getInstance()
      
      expect(instance1).toBe(instance2)
    })
  })

  describe('Configuration Loading and Validation', () => {
    it('should load configuration from JSON file', () => {
      const config = configManager.getConfiguration()
      
      expect(config).toHaveProperty('version', '1.0.0')
      expect(config).toHaveProperty('defaultDifficulty', 'easy')
      expect(config).toHaveProperty('difficultyLevels')
      expect(Object.keys(config.difficultyLevels)).toHaveLength(3) // easy, medium, hard
    })

    it('should validate configuration on initialization', () => {
      expect(() => ConfigurationManager.getInstance()).not.toThrow()
    })

    it('should throw error for invalid configuration', () => {
      const invalidConfig = {
        version: '',
        lastModified: '2024-01-01',
        defaultDifficulty: 'nonexistent',
        difficultyLevels: {}
      }

      expect(() => {
        configManager.importConfiguration(JSON.stringify(invalidConfig))
      }).toThrow('Configuration validation failed')
    })
  })

  describe('Difficulty Management', () => {
    it('should get current difficulty', () => {
      expect(configManager.getCurrentDifficulty()).toBe('easy')
    })

    it('should set current difficulty', () => {
      configManager.setCurrentDifficulty('medium')
      expect(configManager.getCurrentDifficulty()).toBe('medium')
    })

    it('should throw error when setting non-existent difficulty', () => {
      expect(() => {
        configManager.setCurrentDifficulty('nonexistent')
      }).toThrow("Difficulty 'nonexistent' does not exist")
    })

    it('should get difficulty level by name', () => {
      const easyLevel = configManager.getDifficultyLevel('easy')
      
      expect(easyLevel).toMatchObject({
        id: 'easy',
        name: 'Easy Mode',
        totalTubes: 4,
        filledTubes: 3,
        emptyTubes: 1
      })
    })

    it('should get current difficulty level when no parameter provided', () => {
      configManager.setCurrentDifficulty('medium')
      const currentLevel = configManager.getDifficultyLevel()
      
      expect(currentLevel.id).toBe('medium')
    })

    it('should get all difficulty levels', () => {
      const allLevels = configManager.getAllDifficultyLevels()
      
      expect(allLevels).toHaveProperty('easy')
      expect(allLevels).toHaveProperty('medium')
      expect(allLevels).toHaveProperty('hard')
      expect(Object.keys(allLevels)).toHaveLength(3)
    })
  })

  describe('Processed Configuration', () => {
    it('should return processed tube configuration', () => {
      const processed = configManager.getProcessedConfiguration('easy')
      
      expect(processed).toHaveProperty('tubes')
      expect(processed).toHaveProperty('colors')
      expect(processed).toHaveProperty('difficulty')
      expect(processed.tubes).toHaveLength(4)
      expect(processed.colors).toMatchObject({
        primary: '#ff1493',
        secondary: '#32cd32',
        tertiary: '#8a2be2'
      })
    })

    it('should shuffle tube positions but not contents', () => {
      const processed1 = configManager.getProcessedConfiguration('easy')
      const processed2 = configManager.getProcessedConfiguration('easy')
      
      // Tubes should have same contents but potentially different order
      expect(processed1.tubes).toHaveLength(processed2.tubes.length)
      
      // Contents should be preserved (even if order changes)
      const flatColors1 = processed1.tubes.flat().sort()
      const flatColors2 = processed2.tubes.flat().sort()
      expect(flatColors1).toEqual(flatColors2)
    })
  })
})
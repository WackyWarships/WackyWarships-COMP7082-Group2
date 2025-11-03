export const COLORS = {
  PINK: '#ff4da6',
  GREEN: '#4bf77a',
  PURPLE: '#8b5cff',
  BLUE: '#3fb6ff',
  YELLOW: '#ffd23f',
  RED: '#ff5b5b'
} as const;

export const COLOR_VALUES = {
  '#ff4da6': 0xff4da6,
  '#4bf77a': 0x4bf77a,
  '#8b5cff': 0x8b5cff,
  '#3fb6ff': 0x3fb6ff,
  '#ffd23f': 0xffd23f,
  '#ff5b5b': 0xff5b5b
} as const;

export type ColorType = typeof COLORS[keyof typeof COLORS];

export const TUBE_CONFIG = {
  WIDTH: 80,
  HEIGHT: 200,
  CAPACITY: 4,
  GLASS_COLOR: 0xffffff,
  GLASS_ALPHA: 0.15,
  RIM_COLOR: 0xffffff,
  RIM_ALPHA: 0.4,
  OUTLINE_COLOR: 0xffffff,
  OUTLINE_WIDTH: 3,
  LIQUID_UNIT_HEIGHT: 48,
  CORNER_RADIUS: 12,
  SPACING_X: 120,
  SPACING_Y: 220
};

export const ANIMATION_CONFIG = {
  POUR_DURATION: 800,
  STREAM_DURATION: 600,
  MERGE_DURATION: 400,
  FADE_DURATION: 300,
  SHAKE_DURATION: 200,
  SHAKE_INTENSITY: 10,
  GLOW_ALPHA: 0.6,
  GLOW_SCALE: 1.15,
  PRE_POUR_SHIFT_DURATION: 220,
  POUR_TILT_DURATION: 280,
  RETURN_DURATION: 260,
  MAX_TILT_ANGLE: 26
};

export const UI_CONFIG = {
  BUTTON_WIDTH: 200,
  BUTTON_HEIGHT: 60,
  BUTTON_RADIUS: 30,
  BUTTON_COLOR: 0x4a90e2,
  BUTTON_HOVER_COLOR: 0x5ba3f5,
  TEXT_COLOR: '#ffffff',
  TITLE_SIZE: 72,
  SUBTITLE_SIZE: 28,
  BUTTON_TEXT_SIZE: 32,
  UI_TEXT_SIZE: 24
};

export interface LevelDefinition {
  id: number;
  name: string;
  description: string;
  tubes: ColorType[][];
}

export const LEVEL_DATA: { defaultLevelIndex: number; levels: LevelDefinition[] } = {
  defaultLevelIndex: 0,
  levels: [
    {
      id: 1,
      name: 'Warm-Up Pour',
      description: 'Single-color introduction with one empty tube.',
      tubes: [[COLORS.PINK, COLORS.PINK, COLORS.PINK, COLORS.PINK], []]
    },
    {
      id: 2,
      name: 'Two-Tone Twist',
      description: 'Learn to separate two colors with a single spare tube.',
      tubes: [
        [COLORS.PINK, COLORS.GREEN, COLORS.PINK, COLORS.GREEN],
        [COLORS.GREEN, COLORS.PINK, COLORS.GREEN, COLORS.PINK],
        []
      ]
    },
    {
      id: 3,
      name: 'Triple Cascade',
      description: 'Three colors require careful ordering and staging.',
      tubes: [
        [COLORS.BLUE, COLORS.PINK, COLORS.GREEN, COLORS.BLUE],
        [COLORS.GREEN, COLORS.BLUE, COLORS.PINK, COLORS.GREEN],
        [COLORS.PINK, COLORS.GREEN, COLORS.BLUE, COLORS.PINK],
        []
      ]
    },
    {
      id: 4,
      name: 'Quadra Shuffle',
      description: 'Four colors with a single reserve tube.',
      tubes: [
        [COLORS.PINK, COLORS.GREEN, COLORS.BLUE, COLORS.YELLOW],
        [COLORS.BLUE, COLORS.YELLOW, COLORS.PINK, COLORS.GREEN],
        [COLORS.GREEN, COLORS.PINK, COLORS.YELLOW, COLORS.BLUE],
        [COLORS.YELLOW, COLORS.BLUE, COLORS.GREEN, COLORS.PINK],
        []
      ]
    },
    {
      id: 5,
      name: 'Five-Color Flow',
      description: 'Added complexity with two reserve tubes for planning.',
      tubes: [
        [COLORS.PINK, COLORS.GREEN, COLORS.PURPLE, COLORS.BLUE],
        [COLORS.YELLOW, COLORS.PURPLE, COLORS.GREEN, COLORS.PINK],
        [COLORS.BLUE, COLORS.YELLOW, COLORS.PINK, COLORS.GREEN],
        [COLORS.PURPLE, COLORS.BLUE, COLORS.YELLOW, COLORS.PINK],
        [COLORS.GREEN, COLORS.BLUE, COLORS.YELLOW, COLORS.PURPLE],
        [],
        []
      ]
    },
    {
      id: 6,
      name: 'Strategic Swirl',
      description: 'Five colors with only one empty tube demand efficiency.',
      tubes: [
        [COLORS.PINK, COLORS.GREEN, COLORS.BLUE, COLORS.PURPLE],
        [COLORS.YELLOW, COLORS.PINK, COLORS.GREEN, COLORS.BLUE],
        [COLORS.PURPLE, COLORS.YELLOW, COLORS.PINK, COLORS.GREEN],
        [COLORS.BLUE, COLORS.PURPLE, COLORS.YELLOW, COLORS.PINK],
        [COLORS.GREEN, COLORS.BLUE, COLORS.PURPLE, COLORS.YELLOW],
        []
      ]
    },
    {
      id: 7,
      name: 'Chromatic Mastery',
      description: 'Six-color finale with limited space for mistakes.',
      tubes: [
        [COLORS.RED, COLORS.PINK, COLORS.BLUE, COLORS.GREEN],
        [COLORS.YELLOW, COLORS.PURPLE, COLORS.RED, COLORS.PINK],
        [COLORS.BLUE, COLORS.YELLOW, COLORS.PURPLE, COLORS.RED],
        [COLORS.GREEN, COLORS.BLUE, COLORS.YELLOW, COLORS.PURPLE],
        [COLORS.PURPLE, COLORS.RED, COLORS.PINK, COLORS.BLUE],
        [COLORS.GREEN, COLORS.PINK, COLORS.YELLOW, COLORS.GREEN],
        [],
        []
      ]
    }
  ]
};

export const REGISTRY_KEYS = {
  CURRENT_LEVEL_INDEX: 'fuelSortCurrentLevelIndex'
} as const;

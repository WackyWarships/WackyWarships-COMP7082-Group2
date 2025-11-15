export const COLORS = {
  PINK: '#ff4da6',
  GREEN: '#4bf77a',
  PURPLE: '#8b5cff',
  BLUE: '#3fb6ff',
  YELLOW: '#ffd23f',
  RED: '#ff5b5b'
} as const;

// Utility function to convert hex color string to numeric value for Phaser
export const getColorValue = (hexColor: string): number => {
  return parseInt(hexColor.replace('#', '0x'), 16);
};

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
  STREAM_DURATION: 400,
  MERGE_DURATION: 400,
  FADE_DURATION: 300,
  SHAKE_DURATION: 200,
  SHAKE_INTENSITY: 10,
  GLOW_ALPHA: 0.6,
  GLOW_SCALE: 1.15,
  PRE_POUR_SHIFT_DURATION: 160,
  POUR_TILT_DURATION: 280,
  RETURN_DURATION: 180,
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



import Phaser from 'phaser';

export const FUEL_SORT_PARTICLE_KEY = 'fuel-sort-particle';

export function ensureParticleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FUEL_SORT_PARTICLE_KEY)) {
    return;
  }

  const graphics = scene.add.graphics({ x: 0, y: 0 });
  graphics.setVisible(false);
  graphics.fillStyle(0xffffff, 1);
  graphics.fillCircle(4, 4, 4);
  graphics.generateTexture(FUEL_SORT_PARTICLE_KEY, 8, 8);
  graphics.destroy();
}

const FUEL_SORT_TUBE_ICON_KEY = 'fuel-sort-tube-icon';

export function ensureTubeIconTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FUEL_SORT_TUBE_ICON_KEY)) {
    return;
  }

  const width = 96;
  const height = 192;
  const cornerRadius = 26;
  const fillLevel = 0.58;

  const graphics = scene.add.graphics({ x: 0, y: 0 });
  graphics.setVisible(false);
  graphics.clear();

  graphics.lineStyle(10, 0x6ed4ff, 1);
  graphics.strokeRoundedRect(0, 0, width, height - 16, cornerRadius);
  graphics.lineStyle(8, 0x8ae4ff, 1);
  graphics.beginPath();
  graphics.moveTo(width * 0.1, 10);
  graphics.lineTo(width * 0.9, 10);
  graphics.strokePath();

  const liquidHeight = (height - 32) * fillLevel;
  const liquidTop = height - 24 - liquidHeight;
  graphics.fillStyle(0x2fbaff, 0.92);
  graphics.fillRoundedRect(10, liquidTop, width - 20, liquidHeight, {
    tl: 18,
    tr: 18,
    bl: cornerRadius - 8,
    br: cornerRadius - 8
  });

  graphics.fillStyle(0xffffff, 0.18);
  graphics.fillRoundedRect(16, liquidTop + 12, (width - 32) * 0.55, liquidHeight - 24, 16);

  graphics.generateTexture(FUEL_SORT_TUBE_ICON_KEY, width, height);
  graphics.destroy();
}

export function getTubeIconKey(): string {
  return FUEL_SORT_TUBE_ICON_KEY;
}

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
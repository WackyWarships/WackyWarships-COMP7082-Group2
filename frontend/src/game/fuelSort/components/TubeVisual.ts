import Phaser from 'phaser';
import { Tube } from '../core/Tube';
import { TUBE_CONFIG, getColorValue, ColorType, ANIMATION_CONFIG } from '../config/Constants';

export class TubeVisual extends Phaser.GameObjects.Container {
  private tube: Tube;
  private tubeIndex: number;
  private glassGraphics: Phaser.GameObjects.Graphics;
  private liquidLayers: Phaser.GameObjects.Graphics[];
  private glowGraphics: Phaser.GameObjects.Graphics;
  private isSelected: boolean = false;
  private basePosition: Phaser.Math.Vector2;
  private selectionLift: number = 12;

  constructor(scene: Phaser.Scene, x: number, y: number, tube: Tube, index: number) {
    super(scene, x, y);

    this.tube = tube;
    this.tubeIndex = index;
    this.liquidLayers = [];
    this.basePosition = new Phaser.Math.Vector2(x, y);

    this.glowGraphics = scene.add.graphics();
    this.add(this.glowGraphics);
    this.glowGraphics.setVisible(false);

    this.createLiquidLayers();

    this.glassGraphics = scene.add.graphics();
    this.add(this.glassGraphics);
    this.drawGlass();

    this.setSize(TUBE_CONFIG.WIDTH, TUBE_CONFIG.HEIGHT);
    this.setInteractive();

    scene.add.existing(this);
  }

  getTube(): Tube {
    return this.tube;
  }

  getIndex(): number {
    return this.tubeIndex;
  }

  private drawGlass(): void {
    const g = this.glassGraphics;
    g.clear();

    const width = TUBE_CONFIG.WIDTH;
    const height = TUBE_CONFIG.HEIGHT;
    const radius = TUBE_CONFIG.CORNER_RADIUS;

    g.fillStyle(TUBE_CONFIG.GLASS_COLOR, TUBE_CONFIG.GLASS_ALPHA);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, { bl: radius, br: radius });

    g.lineStyle(TUBE_CONFIG.OUTLINE_WIDTH, TUBE_CONFIG.OUTLINE_COLOR, 0.3);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, { bl: radius, br: radius });

    g.lineStyle(4, TUBE_CONFIG.RIM_COLOR, TUBE_CONFIG.RIM_ALPHA);
    g.beginPath();
    g.moveTo(-width / 2, -height / 2);
    g.lineTo(width / 2, -height / 2);
    g.strokePath();

    g.fillStyle(0xffffff, 0.1);
    g.fillRect(-width / 2 + 5, -height / 2 + 10, 12, height - 20);
  }

  private createLiquidLayers(): void {
    const contents = this.tube.getContents();

    this.liquidLayers.forEach(layer => layer.destroy());
    this.liquidLayers = [];

    contents.forEach((color, index) => {
      const layer = this.scene.add.graphics();
      this.add(layer);
      this.liquidLayers.push(layer);
      this.drawLiquidLayer(layer, color, index, contents.length);
    });
  }

  private drawLiquidLayer(
    graphics: Phaser.GameObjects.Graphics,
    color: ColorType,
    layerIndex: number,
    totalLayers: number
  ): void {
    graphics.clear();

    const width = TUBE_CONFIG.WIDTH - 14;
    const height = TUBE_CONFIG.LIQUID_UNIT_HEIGHT;
    const tubeHeight = TUBE_CONFIG.HEIGHT;

    const yOffset = tubeHeight / 2 - height * (layerIndex + 1) - 5;

    const colorValue = getColorValue(color);

    graphics.fillStyle(colorValue, 1);

    if (layerIndex === 0) {
      graphics.fillRect(-width / 2, yOffset, width, height);
    } else {
      graphics.fillRect(-width / 2, yOffset, width, height);
    }

    if (layerIndex === totalLayers - 1) {
      graphics.fillStyle(0xffffff, 0.12);
      graphics.fillRect(-width / 2, yOffset - 2, width, 3);
    }

    graphics.fillStyle(0xffffff, 0.15);
    graphics.fillRect(-width / 2 + 5, yOffset + 2, 10, height - 4);
  }

  updateVisual(): void {
    this.createLiquidLayers();
  }

  setSelected(selected: boolean): void {
    this.isSelected = selected;

    this.scene.tweens.killTweensOf(this);
    if (selected) {
      this.showGlow();
      this.scene.tweens.add({
        targets: this,
        x: this.basePosition.x,
        y: this.basePosition.y - this.selectionLift,
        angle: 0,
        duration: 200,
        ease: 'Back.easeOut'
      });
    } else {
      this.hideGlow();
      this.scene.tweens.add({
        targets: this,
        x: this.basePosition.x,
        y: this.basePosition.y,
        angle: 0,
        duration: 200,
        ease: 'Back.easeIn'
      });
    }
  }

  private showGlow(): void {
    const g = this.glowGraphics;
    g.clear();
    g.setVisible(true);

    const width = TUBE_CONFIG.WIDTH;
    const height = TUBE_CONFIG.HEIGHT;
    const radius = TUBE_CONFIG.CORNER_RADIUS;

    g.lineStyle(8, 0xffffff, ANIMATION_CONFIG.GLOW_ALPHA);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, { bl: radius, br: radius });

    this.scene.tweens.add({
      targets: g,
      alpha: { from: 0.6, to: 0.3 },
      duration: 500,
      yoyo: true,
      repeat: -1
    });
  }

  private hideGlow(): void {
    this.scene.tweens.killTweensOf(this.glowGraphics);
    this.glowGraphics.setVisible(false);
  }

  animateInvalidMove(): void {
    this.scene.tweens.add({
      targets: this,
      x: this.x - ANIMATION_CONFIG.SHAKE_INTENSITY,
      duration: ANIMATION_CONFIG.SHAKE_DURATION / 4,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut'
    });
  }

  getBasePosition(): Phaser.Math.Vector2 {
    return this.basePosition.clone();
  }

  setBasePosition(x: number, y: number): void {
    this.basePosition.set(x, y);
    const targetY = this.basePosition.y - (this.isSelected ? this.selectionLift : 0);
    this.setPosition(this.basePosition.x, targetY);
  }

  async animatePrePour(target: TubeVisual): Promise<void> {
    return new Promise(resolve => {
      this.scene.tweens.killTweensOf(this);
      const currentBaseY = this.basePosition.y - (this.isSelected ? this.selectionLift : 0);
      const distanceX = target.getBasePosition().x - this.basePosition.x;
      const distanceFactor = Phaser.Math.Clamp(Math.abs(distanceX) / (TUBE_CONFIG.SPACING_X * 1.5), 0, 1);
      const direction = distanceX === 0 ? 0 : Math.sign(distanceX);
      const angle = ANIMATION_CONFIG.MAX_TILT_ANGLE * distanceFactor * direction;
      const shiftX = distanceX * 0.18;
      const shiftY = -25;

      this.scene.tweens.add({
        targets: this,
        x: this.basePosition.x + shiftX,
        y: currentBaseY + shiftY,
        angle,
        duration: ANIMATION_CONFIG.PRE_POUR_SHIFT_DURATION,
        ease: 'Sine.easeOut',
        onComplete: () => resolve()
      });
    });
  }

  async animateReturn(): Promise<void> {
    return new Promise(resolve => {
      this.scene.tweens.killTweensOf(this);
      const targetY = this.basePosition.y - (this.isSelected ? this.selectionLift : 0);
      this.scene.tweens.add({
        targets: this,
        x: this.basePosition.x,
        y: targetY,
        angle: 0,
        duration: ANIMATION_CONFIG.RETURN_DURATION,
        ease: 'Sine.easeInOut',
        onComplete: () => resolve()
      });
    });
  }

  createFillOverlay(startIndex: number, units: number, color: ColorType) {
    if (units <= 0) {
      return {
        setProgress: (_progress: number) => {},
        complete: () => {}
      };
    }

    const overlay = this.scene.add.graphics();
    this.add(overlay);
    this.bringToTop(this.glassGraphics);

    const width = TUBE_CONFIG.WIDTH - 14;
    const unitHeight = TUBE_CONFIG.LIQUID_UNIT_HEIGHT;
    const colorValue = getColorValue(color);

    const drawProgress = (progress: number) => {
      const total = Phaser.Math.Clamp(progress, 0, 1) * units;
      overlay.clear();

      for (let i = 0; i < units; i++) {
        const fillAmount = Phaser.Math.Clamp(total - i, 0, 1);
        if (fillAmount <= 0) continue;

        const layerIndex = startIndex + i;
        const layerTop = this.getLayerYOffset(layerIndex);
        const fullHeight = unitHeight;
        const height = fullHeight * fillAmount;
        const y = layerTop + (fullHeight - height);

        overlay.fillStyle(colorValue, 1);
        overlay.fillRect(-width / 2, y, width, height);

        if (fillAmount >= 0.99) {
          overlay.fillStyle(0xffffff, 0.12);
          overlay.fillRect(-width / 2, layerTop - 2, width, 3);
          overlay.fillStyle(0xffffff, 0.15);
          overlay.fillRect(-width / 2 + 5, layerTop + 2, 10, fullHeight - 4);
        }
      }
    };

    return {
      setProgress: (progress: number) => drawProgress(progress),
      complete: () => overlay.destroy()
    };
  }

  private getLayerYOffset(layerIndex: number): number {
    const tubeHeight = TUBE_CONFIG.HEIGHT;
    const height = TUBE_CONFIG.LIQUID_UNIT_HEIGHT;
    return tubeHeight / 2 - height * (layerIndex + 1) - 5;
  }
  
  /**
   * Gets the world position of the tube's mouth (top center)
   * Accounts for rotation and current position
   * Container rotates around its center, so we calculate the mouth position accordingly
   */
  getMouthPosition(): { x: number; y: number } {
    const angle = this.angle;
    const rad = Phaser.Math.DegToRad(angle);
    const tubeHeight = TUBE_CONFIG.HEIGHT;
    
    // The mouth is at the top center of the tube in local coordinates
    // In the container's local space, this is at (0, -height/2)
    const localMouthX = 0;
    const localMouthY = -tubeHeight / 2;
    
    // Apply rotation transformation around the container's center (0, 0)
    const rotatedX = localMouthX * Math.cos(rad) - localMouthY * Math.sin(rad);
    const rotatedY = localMouthX * Math.sin(rad) + localMouthY * Math.cos(rad);
    
    // Transform to world coordinates
    return {
      x: this.x + rotatedX,
      y: this.y + rotatedY
    };
  }
}

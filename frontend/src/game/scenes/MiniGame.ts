import { GameObjects, Scene } from 'phaser';
import { getCenter, resizeSceneBase } from '../utils/layout';

// Import assets via Vite so they bundle correctly
// Relative to this file: ../../assets/miniGame/
import backgroundImg from '../../assets/miniGame/background.png';
import tubeSvg from '../../assets/miniGame/fuelTube.svg';

export class MiniGame extends Scene {
  private bg!: GameObjects.Image;
  private tubes: GameObjects.Image[] = [];
  private liquidGfx!: GameObjects.Graphics;

  constructor() {
    super('MiniGame');
  }

  preload() {
    this.load.image('mg_background', backgroundImg);
    this.load.image('mg_tube', tubeSvg);
  }

  create() {
    const { width, height } = this.scale;
    const { x: cx, y: cy } = getCenter(this.scale);

    this.bg = this.add.image(cx, cy, 'mg_background');
    this.fitBackground(width, height);

    // Create 3 tubes centered horizontally near the bottom
    const tubeWidth = 72;
    const tubeHeight = 180;
    const yPos = Math.max(420, height * 0.65);
    const spacing = (width - 3 * tubeWidth) / 4;

    const tubeX = (i: number) => spacing * (i + 1) + tubeWidth * (i + 0.5);

    const tA = this.add.image(tubeX(0), yPos, 'mg_tube').setDisplaySize(tubeWidth, tubeHeight);
    const tB = this.add.image(tubeX(1), yPos, 'mg_tube').setDisplaySize(tubeWidth, tubeHeight);
    const tC = this.add.image(tubeX(2), yPos, 'mg_tube').setDisplaySize(tubeWidth, tubeHeight);
    this.tubes = [tA, tB, tC];

    // Simple liquid demo for Tube A (masked rectangle)
    this.liquidGfx = this.add.graphics();
    const level = 100;
    const color = 0x00ff00;
    this.drawLiquid(tA.x, tA.y, tubeWidth, level, color);

    // Mask the liquid by a copy of the tube sprite so it stays within the tube
    const maskImg = this.add.image(tA.x, tA.y, 'mg_tube').setDisplaySize(tubeWidth, tubeHeight);
    this.liquidGfx.setMask(maskImg.createBitmapMask());
    // Ensure tube visible above the liquid
    tA.setDepth(1);

    // Back to Menu button
    const back = this.add.text(16, 16, '← Back', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 10, y: 6 },
    })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MainMenu'))
      .on('pointerover', () => back.setStyle({ backgroundColor: '#000000cc' }))
      .on('pointerout', () => back.setStyle({ backgroundColor: '#00000088' }));

    // Handle resizing
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  private drawLiquid(x: number, y: number, baseWidth: number, height: number, color: number) {
    const bottomY = y + 90;
    this.liquidGfx.clear();
    this.liquidGfx.fillStyle(color, 1);
    this.liquidGfx.beginPath();
    this.liquidGfx.moveTo(x - baseWidth / 2, bottomY);
    this.liquidGfx.lineTo(x + baseWidth / 2, bottomY);
    this.liquidGfx.lineTo(x + baseWidth / 2, bottomY - height);
    this.liquidGfx.lineTo(x - baseWidth / 2, bottomY - height);
    this.liquidGfx.closePath();
    this.liquidGfx.fillPath();
  }

  private fitBackground(width: number, height: number) {
    const scaleX = width / this.bg.width;
    const scaleY = height / this.bg.height;
    const scale = Math.max(scaleX, scaleY);
    this.bg.setScale(scale).setPosition(width / 2, height / 2);
  }

  private handleResize = (gameSize: Phaser.Structs.Size) => {
    if (!this.scene.isActive() || !this.bg) return;
    const { width, height } = gameSize;

    resizeSceneBase(this, width, height);
    this.fitBackground(width, height);

    // Recalculate tube layout
    const tubeWidth = 72;
    const tubeHeight = 180;
    const yPos = Math.max(420, height * 0.65);
    const spacing = (width - 3 * tubeWidth) / 4;
    const tubeX = (i: number) => spacing * (i + 1) + tubeWidth * (i + 0.5);

    this.tubes.forEach((t, i) => {
      t.setPosition(tubeX(i), yPos).setDisplaySize(tubeWidth, tubeHeight);
    });

    // Redraw liquid for tube A
    if (this.tubes[0]) {
      this.drawLiquid(this.tubes[0].x, this.tubes[0].y, tubeWidth, 100, 0x00ff00);
    }
  };
}

export default MiniGame;

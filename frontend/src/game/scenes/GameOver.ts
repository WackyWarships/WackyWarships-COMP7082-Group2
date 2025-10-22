import Phaser, { Scene } from 'phaser';
import { EventBus } from '../EventBus';

type ResultData = {
  result?: 'VICTORY' | 'DEFEAT' | string;
  playerHP?: number;
  enemyHP?: number;
  shots?: number;
  damage?: number;
};

export class GameOver extends Scene {
  // --- Optional compatibility properties (match repo stub style) ---
  public camera!: Phaser.Cameras.Scene2D.Camera;
  public background?: Phaser.GameObjects.Image;
  public gameText?: Phaser.GameObjects.Text;

  // --- UI elements you already use ---
  private bg?: Phaser.GameObjects.Image;
  private card!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private statTexts: Phaser.GameObjects.Text[] = [];
  private menuBtn!: Phaser.GameObjects.Rectangle;
  private menuLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('GameOver');
  }

  create(data: ResultData = {}) {
    const { width: W, height: H } = this.scale;

    // alias the main camera (compat prop)
    this.camera = this.cameras.main;

    // Background (and keep alias `background`)
    if (this.textures.exists('background')) {
      this.bg = this.add.image(W / 2, H / 2, 'background').setOrigin(0.5).setDisplaySize(W, H);
      this.background = this.bg; // compat alias
    } else {
      this.cameras.main.setBackgroundColor(0x0b5fa5);
    }

    // Resolve result + stats
    const result =
      data.result ??
      ((data.playerHP! > 0 && data.enemyHP === 0) ? 'VICTORY' :
       (data.enemyHP! > 0 && data.playerHP === 0) ? 'DEFEAT' : 'GAME OVER');

    const playerHP = typeof data.playerHP === 'number' ? data.playerHP : 0;
    const enemyHP  = typeof data.enemyHP  === 'number' ? data.enemyHP  : 0;
    const shots    = typeof data.shots    === 'number' ? data.shots    : undefined;
    const dmgDealt = typeof data.damage   === 'number' ? data.damage   : undefined;

    // Card container
    const cardW = Math.min(520, W * 0.9);
    const cardH = 320;
    const cardX = W / 2;
    const cardY = H * 0.45;

    this.card = this.add
      .rectangle(cardX, cardY, cardW, cardH, 0x000000, 0.35)
      .setStrokeStyle(2, 0xffffff, 0.7);

    // Title
    this.title = this.add.text(cardX, cardY - cardH / 2 + 40, result, {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5);

    // Stats
    const lines = [
      `Player HP: ${playerHP}`,
      `Enemy HP: ${enemyHP}`,
      ...(shots    !== undefined ? [`Shots Fired: ${shots}`] : []),
      ...(dmgDealt !== undefined ? [`Damage Dealt: ${dmgDealt}`] : [])
    ];

    const baseY = cardY - 20;
    this.statTexts = lines.map((txt, i) =>
      this.add.text(cardX, baseY + i * 32, txt, {
        fontFamily: 'Arial Black',
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5)
    );

    // Main Menu button
    const btnW = 200, btnH = 50;
    this.menuBtn = this.add
      .rectangle(W / 2, H * 0.85, btnW, btnH, 0x000000, 0.35)
      .setStrokeStyle(2, 0xffffff, 0.7)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MainMenu'))
      .on('pointerover', () => this.menuBtn.setAlpha(0.9))
      .on('pointerout', () => this.menuBtn.setAlpha(1));

    this.menuLabel = this.add.text(this.menuBtn.x, this.menuBtn.y, 'MAIN MENU', {
      fontFamily: 'Arial Black',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // compat alias: expose a Text via `gameText` if any code expects it
    this.gameText = this.menuLabel;

    this.scale.on('resize', this.onResize, this);
    EventBus.emit('current-scene-ready', this);
  }

  onResize(gameSize: Phaser.Structs.Size) {
    const { width: W, height: H } = gameSize;

    // Background + alias
    if (this.bg) this.bg.setPosition(W / 2, H / 2).setDisplaySize(W, H);
    if (this.background) this.background.setPosition(W / 2, H / 2).setDisplaySize(W, H);

    // Card + title
    const cardW = Math.min(520, W * 0.9);
    const cardH = 320;
    const cardX = W / 2;
    const cardY = H * 0.45;

    this.card.setPosition(cardX, cardY).setSize(cardW, cardH);
    this.title.setPosition(cardX, cardY - cardH / 2 + 40);

    // Stats
    const baseY = cardY - 20;
    this.statTexts.forEach((t, i) => t.setPosition(cardX, baseY + i * 32));

    // Button + alias text
    this.menuBtn.setPosition(W / 2, H * 0.85);
    this.menuLabel.setPosition(this.menuBtn.x, this.menuBtn.y);
    this.gameText?.setPosition(this.menuLabel.x, this.menuLabel.y); // keep alias aligned
  }
}

export default GameOver;

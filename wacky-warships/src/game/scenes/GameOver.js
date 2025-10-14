import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class GameOver extends Scene {
  constructor () {
    super('GameOver');
  }

  create (data = {}) {
    const { width: W, height: H } = this.scale;

    // --- Background (same style as other scenes) ---
    if (this.textures.exists('background')) {
      this.bg = this.add.image(W/2, H/2, 'background')
        .setOrigin(0.5)
        .setDisplaySize(W, H);
    } else {
      // fallback color if no texture is available
      this.cameras.main.setBackgroundColor(0x0b5fa5);
    }

    // --- Derive / read results ---
    const result =
      data.result ??
      ((data.playerHP > 0 && data.enemyHP === 0) ? 'VICTORY' :
       (data.enemyHP > 0 && data.playerHP === 0) ? 'DEFEAT' : 'GAME OVER');

    const playerHP = (typeof data.playerHP === 'number') ? data.playerHP : 0;
    const enemyHP  = (typeof data.enemyHP  === 'number') ? data.enemyHP  : 0;
    const shots    = (typeof data.shots    === 'number') ? data.shots    : undefined;
    const dmgDealt = (typeof data.damage   === 'number') ? data.damage   : undefined;

    // --- Scoreboard card ---
    const cardW = Math.min(520, W * 0.9);
    const cardH = 320;
    const cardX = W / 2;
    const cardY = H * 0.45;

    this.card = this.add.roundedRectangle
      ? this.add.roundedRectangle(cardX, cardY, cardW, cardH, 18, 0x000000, 0.35)
      : this.add.rectangle(cardX, cardY, cardW, cardH, 0x000000, 0.35);
    this.card.setStrokeStyle(2, 0xffffff, 0.7);

    // Title
    this.title = this.add.text(cardX, cardY - cardH/2 + 40, result, {
      fontFamily: 'Arial Black',
      fontSize: 48,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5);

    // Lines on the scoreboard
    const lines = [
      `Player HP: ${playerHP}`,
      `Enemy HP: ${enemyHP}`,
      ...(shots    !== undefined ? [`Shots Fired: ${shots}`] : []),
      ...(dmgDealt !== undefined ? [`Damage Dealt: ${dmgDealt}`] : []),
    ];

    const baseY = cardY - 20;
    this.statTexts = lines.map((txt, i) =>
      this.add.text(cardX, baseY + i * 32, txt, {
        fontFamily: 'Arial Black',
        fontSize: 20,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5)
    );

    // --- Main Menu button ---
    const btnW = 200, btnH = 50;
    this.menuBtn = this.add.rectangle(W/2, H * 0.85, btnW, btnH, 0x000000, 0.35)
      .setStrokeStyle(2, 0xffffff, 0.7)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MainMenu'))
      .on('pointerover', () => this.menuBtn.setAlpha(0.9))
      .on('pointerout',  () => this.menuBtn.setAlpha(1));

    this.menuLabel = this.add.text(this.menuBtn.x, this.menuBtn.y, 'MAIN MENU', {
      fontFamily: 'Arial Black',
      fontSize: 24,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // Responsive
    this.scale.on('resize', this.onResize, this);

    EventBus.emit('current-scene-ready', this);
  }

  onResize (gameSize) {
    const { width: W, height: H } = gameSize;

    if (this.bg) this.bg.setPosition(W/2, H/2).setDisplaySize(W, H);

    const cardW = Math.min(520, W * 0.9);
    const cardH = 320;
    const cardX = W / 2;
    const cardY = H * 0.45;

    this.card.setPosition(cardX, cardY).setSize(cardW, cardH);
    this.title.setPosition(cardX, cardY - cardH/2 + 40);

    const baseY = cardY - 20;
    this.statTexts?.forEach((t, i) => t.setPosition(cardX, baseY + i * 32));

    this.menuBtn?.setPosition(W/2, H * 0.85);
    this.menuLabel?.setPosition(this.menuBtn.x, this.menuBtn.y);
  }

  changeScene () {
    this.scene.start('MainMenu');
  }
}

import { Scene } from 'phaser';

export class Settings extends Scene {
  constructor() { super('Settings'); }

  create () {
    const { width: W, height: H } = this.scale;

    // background (reuse your main bg)
    this.add.image(W/2, H/2, 'background').setOrigin(0.5).setDisplaySize(W, H);

    // title
    this.add.text(W/2, H * 0.2, 'SETTINGS', {
      fontFamily: 'Arial Black', fontSize: 42, color: '#ffffff',
      stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5);

    // back/home button (top-left)
    const pad = 24;
    const home = this.add.image(pad + 24, pad + 24, 'home')
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MainMenu'));

    // placeholder content
    this.add.text(W/2, H * 0.5, '(Settings go here)', {
      fontFamily: 'Arial', fontSize: 24, color: '#ffffff'
    }).setOrigin(0.5);

    // keep layout responsive
    this.scale.on('resize', ({ width, height }) => {
      this.children.getByName?.('bg')?.setDisplaySize(width, height);
      home.setPosition(24 + 24, 24 + 24);
    });
  }
}

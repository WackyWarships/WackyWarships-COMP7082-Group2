// src/game/scenes/Preloader.ts
import Phaser from "phaser";

export default class Preloader extends Phaser.Scene {
  constructor() {
    super("Preloader");
  }

  init() {
    const { width, height } = this.scale;

    // Simple progress UI
    this.add
      .rectangle(width / 2, height * 0.5, 468, 32)
      .setStrokeStyle(1, 0xffffff);
    const bar = this.add
      .rectangle(width / 2 - 230, height * 0.5, 4, 28, 0xffffff)
      .setOrigin(0, 0.5);

    this.load.on("progress", (p: number) => {
      bar.width = 4 + 460 * p;
    });
  }

  preload() {
    // Where your public assets live: <root>/public/assets/*
    this.load.setPath("assets");

    // Required by your scenes
    this.load.image("background", "bg_v2.png");
    this.load.image("logo", "logo.png");
    this.load.image("start", "start.png"); // used by MainMenu

    // Optional (only if you actually added the files)
    // this.load.image('playerShip', 'player.png');
    // this.load.image('enemyShip',  'enemy.png');
  }

  create() {
    this.scene.start("MainMenu");
  }
}

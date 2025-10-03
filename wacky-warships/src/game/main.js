import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainMenu } from './scenes/MainMenu';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { Settings } from './scenes/Settings';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',          // React mounts this div
  backgroundColor: '#000000',

  // Portrait, responsive canvas (keeps aspect ratio)
  scale: {
    mode: Phaser.Scale.FIT,          // maintain aspect; letterbox if needed
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 540,                      // 9:16 base size
    height: 960,
    min: { width: 270, height: 480 },
    max: { width: 810, height: 1440 }
  },

  // (add physics here if/when you need them)
  scene: [Boot, Preloader, MainMenu, Game, GameOver, Settings]
};

const StartGame = (parent) => new Phaser.Game({ ...config, parent });
export default StartGame;

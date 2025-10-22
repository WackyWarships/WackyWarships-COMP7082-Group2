// frontend/src/game/main.ts
import Phaser from 'phaser';

import Preloader from './scenes/Preloader';
import { Boot } from './scenes/Boot';
import { MainMenu } from './scenes/MainMenu';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';

let game: Phaser.Game | null = null;

export default function createGame(containerId?: string): Phaser.Game {
  if (game) return game;

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: containerId ?? 'game-container',
    width: 540,
    height: 960,
    scene: [Boot, Preloader, MainMenu, Game, GameOver],
    physics: { default: 'arcade' },
  });

  return game;
}

export function destroyGame(): void {
  if (game) {
    game.destroy(true);
    game = null;
  }
}

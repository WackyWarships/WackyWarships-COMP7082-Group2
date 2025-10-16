import Phaser from "phaser";
import { Boot } from "./scenes/Boot";
import { Preloader } from "./scenes/Preloader";
import { MainMenu } from "./scenes/MainMenu";
import { Game } from "./scenes/Game";
import { GameOver } from "./scenes/GameOver";

let gameInstance: Phaser.Game | null = null;

const baseConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    backgroundColor: "#000000",
    scene: [Boot, Preloader, MainMenu, Game, GameOver],
    physics: { default: "arcade", arcade: { debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
};

export function createGame(parent: string | HTMLElement) {
    if (gameInstance) return gameInstance;
    const w = window as any;
    if (w.__PHASER_GAME__)
        try {
            w.__PHASER_GAME__.destroy(true);
        } catch { }
    gameInstance = new Phaser.Game({ ...baseConfig, parent });
    (window as any).__PHASER_GAME__ = gameInstance;
    return gameInstance;
}

export function destroyGame() {
    if (!gameInstance) return;
    try {
        gameInstance.destroy(true);
    } catch (e) {
        console.warn(e);
    }
    (window as any).__PHASER_GAME__ = null;
    gameInstance = null;
}
export default createGame;

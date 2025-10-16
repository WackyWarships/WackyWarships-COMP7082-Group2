// src/components/PhaserGame.tsx
import React, { forwardRef, useEffect, useLayoutEffect, useRef } from "react";
import createGame, { destroyGame } from "./game/main";
import EventBus from "./game/EventBus";
import type Phaser from "phaser";

export interface IRefPhaserGame {
    game: Phaser.Game | null;
    scene: Phaser.Scene | null;
}

interface IProps {
    currentActiveScene?: (scene_instance: Phaser.Scene) => void;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(
    function PhaserGame({ currentActiveScene }, ref) {
        const game = useRef<Phaser.Game | null>(null);

        useLayoutEffect(() => {
            if (!game.current) {
                game.current = createGame("game-container");

                if (typeof ref === "function") {
                    ref({ game: game.current, scene: null });
                } else if (ref) {
                    (ref as React.RefObject<IRefPhaserGame | null>).current = {
                        game: game.current,
                        scene: null,
                    };
                }
            }

            return () => {
                destroyGame();
                game.current = null;
            };
        }, []);

        useEffect(() => {
            const handler = (scene_instance: Phaser.Scene) => {
                if (currentActiveScene) currentActiveScene(scene_instance);

                if (typeof ref === "function") {
                    ref({ game: game.current, scene: scene_instance });
                } else if (ref) {
                    (ref as React.RefObject<IRefPhaserGame | null>).current = {
                        game: game.current,
                        scene: scene_instance,
                    };
                }
            };

            EventBus.on("current-scene-ready", handler);

            return () => {
                EventBus.off("current-scene-ready", handler);
            };
        }, [currentActiveScene, ref]);

        return (
            <div
                id="game-container"
                style={{ width: "100%", height: "100%" }}
            />
        );
    }
);

export default PhaserGame;

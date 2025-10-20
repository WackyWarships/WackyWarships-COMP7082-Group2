import { useRef } from "react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { MainMenu } from "./game/scenes/MainMenu";

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);

    const currentScene = (scene: Phaser.Scene) => {
        // Placeholder for future navbar potentially
    };

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
            {/* 
              Future navbar/ui controls probably
            */}
        </div>
    );
}

export default App;

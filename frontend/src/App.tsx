import { useRef } from "react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { initSocket } from "./api/socket";

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    initSocket();

    const currentScene = () => {
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

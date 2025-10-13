import React, { useEffect } from 'react';
import Phaser from 'phaser';

const MiniGame: React.FC = () => {
  useEffect(() => {
    // Ensure the body and html elements have no margins or paddings
    const resetBodyStyles = () => {
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';
      document.documentElement.style.overflow = 'hidden';
    };

    const adjustCanvasSize = () => {
      const ASPECT_RATIO = 9 / 16;
      let width = window.innerWidth;
      let height = window.innerHeight;

      if (width / height > ASPECT_RATIO) {
        width = height * ASPECT_RATIO;
      } else {
        height = width / ASPECT_RATIO;
      }

      const container = document.getElementById('phaser-container');
      if (container) {
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
      }
    };

    resetBodyStyles();
    adjustCanvasSize();
    window.addEventListener('resize', adjustCanvasSize);

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: 'phaser-container',
      scene: {
        preload: preload,
        create: create,
      },
    };

    const game = new Phaser.Game(config);

    const BACKGROUND_KEY = 'background';
    const TUBE_KEY = 'tube';

    function preload(this: Phaser.Scene) {
      // Load game assets
      this.load.image(BACKGROUND_KEY, 'src/assets/miniGame/background.png');
      this.load.image(TUBE_KEY, 'src/assets/miniGame/fuelTube.png');
    }

    function create(this: Phaser.Scene) {
      // Aspect Ratio of (9:16) for a mobile friendly layout
      const ASPECT_RATIO = 9 / 16;

      // Calculate the width and height based on the screen size while maintaining the aspect ratio
      let newWidth = window.innerWidth;
      let newHeight = window.innerHeight;

      if (newWidth / newHeight > ASPECT_RATIO) {
        newWidth = newHeight * ASPECT_RATIO;
      } else {
        newHeight = newWidth / ASPECT_RATIO;
      }

      this.scale.resize(newWidth, newHeight);

      // Resize and fit the background image to the calculated dimensions
      const bg = this.add.image(newWidth / 2, newHeight / 2, BACKGROUND_KEY);
      const scaleX = newWidth / bg.width;
      const scaleY = newHeight / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale);
      bg.setOrigin(0.5, 0.5);

      // Center the tubes and evenly space them out
      const tubeWidth = 72;
      const tubeSpacing = (this.scale.width - 3 * tubeWidth) / 4;

      const tubeA = this.add.image(tubeSpacing + tubeWidth / 2, 500, TUBE_KEY);
      tubeA.setDisplaySize(tubeWidth, 180);

      const tubeB = this.add.image(tubeSpacing * 2 + tubeWidth * 1.5, 500, TUBE_KEY);
      tubeB.setDisplaySize(tubeWidth, 180);

      const tubeC = this.add.image(tubeSpacing * 3 + tubeWidth * 2.5, 500, TUBE_KEY);
      tubeC.setDisplaySize(tubeWidth, 180);

      // Update canvas size dynamically when the window resizes
      window.addEventListener('resize', () => {
        let newWidth = window.innerWidth;
        let newHeight = window.innerHeight;

        if (newWidth / newHeight > ASPECT_RATIO) {
          newWidth = newHeight * ASPECT_RATIO;
        } else {
          newHeight = newWidth / ASPECT_RATIO;
        }

        this.scale.resize(newWidth, newHeight);
        const scaleX = newWidth / bg.width;
        const scaleY = newHeight / bg.height;
        const scale = Math.max(scaleX, scaleY);
        bg.setScale(scale);
        bg.setPosition(newWidth / 2, newHeight / 2);
      });
    }

    return () => {
      game.destroy(true);
    };
  }, []);

  return (
    <div
      id="phaser-container"
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        margin: '0',
        padding: '0',
      }}
    ></div>
  );
};

export default MiniGame;
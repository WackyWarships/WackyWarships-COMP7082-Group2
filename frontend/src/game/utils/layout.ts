// Utility functions for handling responsive layout logic across all Phaser scenes

import Phaser from 'phaser';

export function isMobile(width: number): boolean {
    return width < 700;
}

export function isVeryTall(width: number, height: number): boolean {
    return height > width * 1.5;
}

/**
 * Returns a responsive font size between desktop and mobile presets
 * Optionally adjusts slightly smaller for tall portrait screens
 */
export function getResponsiveFontSize(
    width: number,
    height: number,
    desktop: number,
    mobile: number
): number {
    const mobileMode = isMobile(width);
    const tall = isVeryTall(width, height);

    if (mobileMode && tall) return mobile * 0.85;
    return mobileMode ? mobile : desktop;
}

/**
 * Gets the center coordinates of the screen.
 */
export function getCenter(scale: Phaser.Scale.ScaleManager) {
    return { x: scale.width / 2, y: scale.height / 2 };
}

/**
 * Resize base scene elements (camera + background) and optionally apply safe-zone scaling.
 * 
 * @param scene - The Phaser scene (must have a 'background' GameObject)
 * @param width - New game width
 * @param height - New game height
 * @param safeAspect - Target aspect ratio for safe area (default: 16/9)
 */
export function resizeSceneBase(
    scene: Phaser.Scene,
    width: number,
    height: number,
    safeAspect: number = 16 / 9
) {
    // Resize camera to new canvas dimensions
    scene.cameras.resize(width, height);

    // Scale and reposition background if available
    const bg = (scene as any).background as Phaser.GameObjects.Image | undefined;
    if (bg) {
        bg.setDisplaySize(height * 0.46, height);
        bg.setPosition(width / 2, height / 2);
    }

    // Compute safe zone (for centering UI in very tall or wide screens)
    const aspect = width / height;
    let safeWidth = width;
    let safeHeight = height;

    if (aspect > safeAspect) {
        // Too wide (desktop ultrawide) → constrain width
        safeWidth = height * safeAspect;
    } else if (aspect < safeAspect) {
        // Too tall (mobile portrait) → constrain height
        safeHeight = width / safeAspect;
    }

    const offsetX = (width - safeWidth) / 2;
    const offsetY = (height - safeHeight) / 2;

    return {
        width,
        height,
        safeWidth,
        safeHeight,
        offsetX,
        offsetY,
        isPortrait: height > width * 1.5
    };
}

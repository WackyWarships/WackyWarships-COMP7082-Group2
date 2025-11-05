import Phaser from 'phaser';
import { TubeVisual } from './TubeVisual';
import { ANIMATION_CONFIG, getColorValue, ColorType, TUBE_CONFIG } from '../config/Constants';

// Animation configuration for tilting
const TILT_CONFIG = {
  ANGLE: -80, // Tilt angle in degrees
  DURATION: 200, // Duration of tilt animation in ms
  POUR_OFFSET_X: 3, // X offset for pour position when tilted
  POUR_OFFSET_Y: -15, // Y offset for pour position when tilted
};

export class PourAnimation {
  private scene: Phaser.Scene;
  private streamGraphics: Phaser.GameObjects.Graphics;
  private isAnimating: boolean = false;
  private animationFrameId: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.streamGraphics = scene.add.graphics();
    this.streamGraphics.setDepth(100);
  }

  /**
   * Animates the pouring of liquid from one tube to another
   * @param source The source tube to pour from
   * @param dest The destination tube to pour into
   * @param color The color of the liquid being poured
   * @param units The number of units of liquid to pour
   */
  async animatePour(
    source: TubeVisual,
    dest: TubeVisual,
    color: ColorType,
    units: number
  ): Promise<void> {
    if (this.isAnimating) return;
    this.isAnimating = true;

    try {

      const destTube = dest.getTube();
      const destContents = destTube.getContents();
      const startIndex = destContents.length - units;
      const overlay = dest.createFillOverlay(Math.max(startIndex, 0), units, color);


      const sourceBase = source.getBasePosition();
      const destBase = dest.getBasePosition();
      
      // Phase 1: Move source tube above and to the side of destination
      // Position it high enough and offset so that when tilted, mouth will be above dest
      const tiltAngleRad = Phaser.Math.DegToRad(TILT_CONFIG.ANGLE);
      // Calculate how much the mouth will shift horizontally when tilted
      const mouthShiftWhenTilted = Math.sin(tiltAngleRad) * TUBE_CONFIG.HEIGHT / 2;
      
      // Position the source tube so its mouth ends up above the destination after tilting
      const pourOffsetY = -TUBE_CONFIG.HEIGHT * 0.9;
      const pourPosition = {
        x: destBase.x - mouthShiftWhenTilted, // Offset to compensate for tilt
        y: destBase.y + pourOffsetY
      };

      await this.animateTubeMovement(
        source,
        pourPosition.x,
        pourPosition.y,
        ANIMATION_CONFIG.PRE_POUR_SHIFT_DURATION
      );

      // Phase 2: Tilt the source tube for pouring
      await this.animateTubeTilt(source, TILT_CONFIG.ANGLE);

      // Calculate pour positions using actual transformed mouth position
      const sourcePos = source.getMouthPosition();
      const destPos = {
        x: destBase.x,
        y: destBase.y - TUBE_CONFIG.HEIGHT * 0.5
      };

      // Phase 3: Animate the pour stream
      await new Promise<void>((resolve) => {
        this.animateStream(
          sourcePos,
          destPos,
          color,
          units,
          (progress: number) => overlay.setProgress(progress),
          resolve
        );
      });

      // Phase 4: Return tube to original state
      await this.animateTubeTilt(source, 0);
      
      // Clean up and update visuals
      overlay.complete();
      source.updateVisual();
      dest.updateVisual();
      
      // Phase 5: Return to original position
      await this.animateTubeMovement(
        source,
        sourceBase.x,
        sourceBase.y - (source['isSelected'] ? source['selectionLift'] : 0),
        ANIMATION_CONFIG.RETURN_DURATION
      );
    } finally {
      this.isAnimating = false;
    }
  }

  /**
   * Animates the tube movement to a target position
   * @param tube The tube to animate
   * @param targetX Target x-coordinate
   * @param targetY Target y-coordinate
   * @param duration Animation duration in milliseconds
   * @param angle Target angle in degrees (optional)
   */
  private async animateTubeMovement(
    tube: TubeVisual,
    targetX: number,
    targetY: number,
    duration: number,
    angle: number = 0
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: tube,
        x: targetX,
        y: targetY,
        angle,
        duration,
        ease: 'Quad.easeInOut',
        onComplete: () => resolve()
      });
    });
  }

  /**
   * Animates the tilting of a tube
   * @param tube The tube to tilt
   * @param targetAngle Target tilt angle in degrees
   * @param duration Animation duration in milliseconds (optional)
   */
  private async animateTubeTilt(
    tube: TubeVisual,
    targetAngle: number,
    duration: number = TILT_CONFIG.DURATION
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: tube,
        angle: targetAngle,
        duration,
        ease: 'Quad.easeInOut',
        onComplete: () => resolve()
      });
    });
  }


  /**
   * Animates the liquid stream between two points
   * @param from Starting position of the stream (mouth of source tube)
   * @param to Ending position of the stream (top of dest tube)
   * @param color Color of the liquid
   * @param units Number of units being poured
   * @param onProgress Callback for animation progress
   * @param onComplete Callback when animation completes
   */
  private animateStream(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: ColorType,
    units: number,
    onProgress: (progress: number) => void,
    onComplete: () => void
  ): void {
    const colorValue = getColorValue(color);
    const streamWidth = Math.min(12 + units * 2, 30);
    const dropCount = Math.min(units * 2, 6);
    
    let progress = 0;
    const duration = ANIMATION_CONFIG.STREAM_DURATION * (0.8 + units * 0.1);
    const startTime = Date.now();

    
    const updateStream = (): void => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);
      
      this.streamGraphics.clear();
      onProgress(progress);
      
      if (progress < 1) {
        // Draw stream flowing straight down from the mouth
        this.streamGraphics.lineStyle(streamWidth, colorValue, 0.8);
        this.streamGraphics.beginPath();
        this.streamGraphics.moveTo(from.x, from.y);
        
        // Stream flows vertically down, ending at destination Y coordinate
        const currentY = from.y + (to.y - from.y) * progress;
        this.streamGraphics.lineTo(from.x, currentY);
        this.streamGraphics.strokePath();
        
        // Add falling drops along vertical stream
        for (let i = 0; i < dropCount; i++) {
          const dropProgress = Math.max(0, progress - (i / dropCount) * 0.3);
          if (dropProgress > 0) {
            const t = dropProgress * (1 + (i * 0.05));
            // Drops fall straight down from the mouth's X position
            const dropX = from.x;
            const dropY = from.y + (to.y - from.y) * t;
            const size = 3 + Math.random() * 3;
            const alpha = 0.4 + Math.random() * 0.4;
            
            this.streamGraphics.fillStyle(colorValue, alpha);
            this.streamGraphics.fillCircle(dropX, dropY, size);
          }
        }
        
        // Add splash effect at the destination
        if (progress > 0.3) {
          const splashProgress = (progress - 0.3) / 0.7;
          const splashRadius = splashProgress * 10;
          const splashAlpha = (1 - splashProgress) * 0.3;
          
          this.streamGraphics.fillStyle(colorValue, splashAlpha);
          this.streamGraphics.fillCircle(to.x, to.y, splashRadius);
        }
        
        this.animationFrameId = requestAnimationFrame(updateStream);
      } else {
        this.streamGraphics.clear();
        onComplete();
      }
    };
    
    this.animationFrameId = requestAnimationFrame(updateStream);
  }

  /**
   * Checks if an animation is currently playing
   */
  isPlaying(): boolean {
    return this.isAnimating;
  }

  /**
   * Cleans up resources used by the animation
   */
  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.streamGraphics.destroy();
  }
}

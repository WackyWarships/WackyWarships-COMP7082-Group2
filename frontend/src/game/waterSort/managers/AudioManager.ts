import Phaser from 'phaser';
import { AUDIO_CONFIG } from '../config/Constants';

type SoundKey = 'click' | 'pour' | 'splash' | 'win' | 'invalid';

export class AudioManager {
  private scene: Phaser.Scene;
  private isMuted = false;
  private sounds: Partial<Record<SoundKey, Phaser.Sound.BaseSound>> = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  init(): void {
    this.sounds.click = this.scene.sound.add('water-sort-click');
    this.sounds.pour = this.scene.sound.add('water-sort-pour');
  }

  playClick(): void {
    this.playSound('click', AUDIO_CONFIG.CLICK_VOLUME);
  }

  playPour(units: number): void {
    const rate = units <= 2 ? 1.05 : 0.85;
    this.playSound('pour', AUDIO_CONFIG.POUR_VOLUME, rate);
  }

  playSplash(): void {
    this.playSound('pour', AUDIO_CONFIG.SPLASH_VOLUME, 1.15);
  }

  playWin(): void {
    this.playSound('pour', AUDIO_CONFIG.WIN_VOLUME, 0.75);
  }

  playInvalid(): void {
    this.playSound('click', AUDIO_CONFIG.CLICK_VOLUME);
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  isSoundMuted(): boolean {
    return this.isMuted;
  }

  destroy(): void {
    Object.values(this.sounds).forEach(sound => {
      sound?.destroy();
    });
    this.sounds = {};
  }

  private playSound(key: SoundKey, volume: number, rate: number = 1): void {
    if (this.isMuted) {
      return;
    }
    const sound = this.sounds[key];
    if (!sound) {
      return;
    }

    const clamped = Phaser.Math.Clamp(volume, 0, 1);
    sound.stop();
    sound.play({ volume: clamped, rate });
  }
}

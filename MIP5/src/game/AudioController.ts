import Phaser from 'phaser';
import { getAudioVolume, isAdViewable } from '../networks';

/** Reusable, first-gesture-safe playable SFX. */
export class AudioController {
  private unlocked = false;
  private readonly click: Phaser.Sound.BaseSound;
  private readonly end: Phaser.Sound.BaseSound;

  constructor(private readonly scene: Phaser.Scene) {
    this.click = scene.sound.add('clickSfx', { volume: 1 });
    this.end = scene.sound.add('endSfx', { volume: 1 });
    this.syncVolume();
    window.addEventListener('mraidaudiovolumechange', this.syncVolume);
    window.addEventListener('mraidlifecyclechange', this.syncLifecycle);
    document.addEventListener('visibilitychange', this.syncLifecycle);
  }

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.scene.sound.locked) this.scene.sound.unlock();
  }

  playClick(): void { this.play(this.click); }
  playEnd(): void { this.play(this.end); }
  destroy(): void {
    window.removeEventListener('mraidaudiovolumechange', this.syncVolume);
    window.removeEventListener('mraidlifecyclechange', this.syncLifecycle);
    document.removeEventListener('visibilitychange', this.syncLifecycle);
    this.click.destroy();
    this.end.destroy();
  }

  private readonly syncVolume = (): void => {
    const volume = Phaser.Math.Clamp(getAudioVolume(), 0, 1);
    this.applyVolume(this.click, volume);
    this.applyVolume(this.end, volume);
  };

  private readonly syncLifecycle = (): void => {
    if (isAdViewable()) return;
    if (this.click.isPlaying) this.click.stop();
    if (this.end.isPlaying) this.end.stop();
  };

  private play(sound: Phaser.Sound.BaseSound): void {
    // Never attempt timer-driven audio before the user has interacted.
    if (!this.unlocked || !isAdViewable()) return;
    this.applyVolume(sound, Phaser.Math.Clamp(getAudioVolume(), 0, 1));
    if (sound.isPlaying) sound.stop();
    try { sound.play(); } catch { /* Audio is optional in restricted WebViews. */ }
  }

  private applyVolume(sound: Phaser.Sound.BaseSound, volume: number): void {
    const adjustable = sound as Phaser.Sound.BaseSound & {
      setVolume?: (value: number) => unknown;
    };
    adjustable.setVolume?.(volume);
  }
}

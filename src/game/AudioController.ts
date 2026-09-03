import Phaser from 'phaser';

/** Reusable, first-gesture-safe playable SFX. */
export class AudioController {
  private unlocked = false;
  private readonly click: Phaser.Sound.BaseSound;
  private readonly end: Phaser.Sound.BaseSound;

  constructor(private readonly scene: Phaser.Scene) {
    this.click = scene.sound.add('clickSfx', { volume: 1 });
    this.end = scene.sound.add('endSfx', { volume: 1 });
  }

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.scene.sound.locked) this.scene.sound.unlock();
  }

  playClick(): void { this.play(this.click); }
  playEnd(): void { this.play(this.end); }
  destroy(): void { this.click.destroy(); this.end.destroy(); }

  private play(sound: Phaser.Sound.BaseSound): void {
    // Never attempt timer-driven audio before the user has interacted.
    if (!this.unlocked) return;
    if (sound.isPlaying) sound.stop();
    sound.play();
  }
}

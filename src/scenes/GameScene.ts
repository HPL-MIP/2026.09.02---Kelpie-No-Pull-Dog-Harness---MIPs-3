import Phaser from 'phaser';
import { Depth, SCENE_BACKGROUND_FADE_MS } from '../constants';
import { track } from '../analytics';
import { bindLifecycle, notifyGameReady, notifyGameStart } from '../networks';
import { Carousel } from '../game/Carousel';
import { AudioController } from '../game/AudioController';
import { getViewport } from '../utils/responsive';

export class GameScene extends Phaser.Scene {
  static readonly KEY = 'Game';
  private carousel?: Carousel;
  private audio?: AudioController;
  private background?: Phaser.GameObjects.Image;
  private backgroundFade?: Phaser.GameObjects.Image;
  private backgroundKey = 'bg';
  private backgroundTargetKey = 'bg';
  private backgroundTween?: Phaser.Tweens.Tween;
  constructor() { super(GameScene.KEY); }
  create(): void {
    this.background = this.add.image(0, 0, 'bg').setDepth(Depth.Background);
    this.backgroundFade = this.add.image(0, 0, 'bg').setDepth(Depth.Background + 0.1).setAlpha(0);
    this.audio = new AudioController(this);
    this.carousel = new Carousel(this, this.audio, (index) => this.setBackgroundForSlide(index));
    bindLifecycle(this); notifyGameReady(); track('DISPLAYED'); this.relayout();
    this.input.once('pointerdown', () => { this.audio?.unlock(); notifyGameStart(); track('CHALLENGE_STARTED'); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.backgroundTween?.remove(); this.audio?.destroy(); this.audio = undefined; });
  }
  relayout(): void {
    this.layoutBackground();
    this.carousel?.relayout();
  }
  private setBackgroundForSlide(index: number): void {
    const nextKey = index === 3 ? 'scene4Background' : 'bg';
    if (!this.background || this.backgroundTargetKey === nextKey) return;
    this.backgroundTween?.remove();
    const outgoingKey = this.backgroundFade && this.backgroundFade.alpha > 0.5 ? this.backgroundTargetKey : this.backgroundKey;
    this.background?.setTexture(outgoingKey).setAlpha(1);
    this.backgroundFade?.setTexture(nextKey).setAlpha(0);
    this.backgroundKey = outgoingKey;
    this.backgroundTargetKey = nextKey;
    this.layoutBackground();
    this.backgroundTween = this.tweens.add({
      targets: this.backgroundFade,
      alpha: 1,
      duration: SCENE_BACKGROUND_FADE_MS,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.background?.setTexture(nextKey).setAlpha(1);
        this.backgroundFade?.setAlpha(0);
        this.backgroundKey = nextKey;
        this.backgroundTargetKey = nextKey;
        this.backgroundTween = undefined;
      },
    });
  }
  private layoutBackground(): void {
    const { width, height } = getViewport();
    const coverSize = Math.max(width, height);
    this.background?.setPosition(width / 2, height / 2).setDisplaySize(coverSize, coverSize);
    this.backgroundFade?.setPosition(width / 2, height / 2).setDisplaySize(coverSize, coverSize);
  }
}

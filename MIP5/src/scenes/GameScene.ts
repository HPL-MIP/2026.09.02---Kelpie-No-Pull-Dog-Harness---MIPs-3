import Phaser from 'phaser';
import { Depth, STORE_URL } from '../constants';
import { track } from '../analytics';
import {
  bindLifecycle,
  notifyGameEnd,
  notifyGameReady,
  notifyGameStart,
  triggerCTA,
} from '../networks';
import { Carousel } from '../game/Carousel';
import { AudioController } from '../game/AudioController';
import { getViewport } from '../utils/responsive';

export class GameScene extends Phaser.Scene {
  static readonly KEY = 'Game';
  private background?: Phaser.GameObjects.Rectangle;
  private carousel?: Carousel;
  private audio?: AudioController;
  private ctaHandler?: () => void;
  constructor() { super(GameScene.KEY); }
  create(): void {
    this.cameras.main.setBackgroundColor(0xf2f8fa);
    this.background = this.add.rectangle(0, 0, 1, 1, 0xf2f8fa).setOrigin(0).setDepth(Depth.Background);
    this.audio = new AudioController(this);
    this.ctaHandler = () => {
      this.audio?.unlock();
      this.audio?.playClick();
      track('CTA_CLICKED');
      triggerCTA(STORE_URL);
    };
    window.__kelpieCTA = this.ctaHandler;
    this.carousel = new Carousel(this, this.audio, this.ctaHandler, () => {
      notifyGameEnd();
      track('ENDCARD_SHOWN');
    });
    bindLifecycle(this); notifyGameReady(); track('DISPLAYED'); this.relayout();
    this.input.once('pointerdown', () => { this.audio?.unlock(); notifyGameStart(); track('CHALLENGE_STARTED'); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__kelpieCTA === this.ctaHandler) window.__kelpieCTA = undefined;
      this.audio?.destroy();
      this.audio = undefined;
    });
  }
  relayout(): void {
    const { width, height } = getViewport();
    this.background?.setDisplaySize(width, height);
    this.carousel?.relayout();
  }
}

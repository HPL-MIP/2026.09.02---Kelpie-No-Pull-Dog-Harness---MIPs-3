import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../constants';
import { track } from '../analytics';
import { bindLifecycle, notifyGameReady, notifyGameStart } from '../networks';
import { Carousel } from '../game/Carousel';
import { AudioController } from '../game/AudioController';

export class GameScene extends Phaser.Scene {
  static readonly KEY = 'Game';
  private carousel?: Carousel;
  private audio?: AudioController;
  constructor() { super(GameScene.KEY); }
  create(): void {
    this.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 0xffffff).setOrigin(0);
    this.audio = new AudioController(this);
    this.carousel = new Carousel(this, this.audio);
    bindLifecycle(this); notifyGameReady(); track('DISPLAYED'); this.relayout();
    this.input.once('pointerdown', () => { this.audio?.unlock(); notifyGameStart(); track('CHALLENGE_STARTED'); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.audio?.destroy(); this.audio = undefined; });
  }
  relayout(): void { this.carousel?.relayout(); }
}

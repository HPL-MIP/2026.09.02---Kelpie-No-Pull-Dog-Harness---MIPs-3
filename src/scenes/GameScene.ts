import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH, STORE_URL } from '../constants';
import { track } from '../analytics';
import { bindLifecycle, notifyGameEnd, notifyGameReady, notifyGameStart, triggerCTA } from '../networks';
import { setViewport } from '../utils/responsive';
import { WelcomePanel } from '../game/WelcomePanel';

export class GameScene extends Phaser.Scene {
  static readonly KEY = 'Game';
  private panel?: WelcomePanel;
  constructor() { super(GameScene.KEY); }
  create(): void {
    this.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 0x103a57).setOrigin(0);
    this.panel = new WelcomePanel(this, () => this.startExperience());
    bindLifecycle(this); notifyGameReady(); track('DISPLAYED'); this.relayout();
  }
  relayout(): void { this.panel?.relayout(); }
  private startExperience(): void { notifyGameStart(); track('CHALLENGE_STARTED'); this.time.delayedCall(350, () => { notifyGameEnd(); track('CTA_CLICKED'); triggerCTA(STORE_URL); }); }
}

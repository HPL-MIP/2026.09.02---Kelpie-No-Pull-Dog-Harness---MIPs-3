import type Phaser from 'phaser';
import { Depth } from '../constants';
import { sd, sx, sy } from '../utils/responsive';

export class WelcomePanel {
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly button: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, onPlay: () => void) {
    this.title = scene.add.text(0, 0, 'KELPIE', { fontFamily: 'Arial, sans-serif', fontSize: '96px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(Depth.Hud);
    this.subtitle = scene.add.text(0, 0, 'NO-PULL DOG HARNESS', { fontFamily: 'Arial, sans-serif', fontSize: '40px', color: '#cbe6ff' }).setOrigin(0.5).setDepth(Depth.Hud);
    this.button = scene.add.text(0, 0, 'TAP TO PLAY', { fontFamily: 'Arial, sans-serif', fontSize: '48px', fontStyle: 'bold', color: '#072639', backgroundColor: '#f6c34e', padding: { x: 44, y: 24 } }).setOrigin(0.5).setDepth(Depth.Input).setInteractive({ useHandCursor: true });
    this.button.on('pointerdown', onPlay);
    this.relayout();
  }
  relayout(): void { this.title.setPosition(sx(540), sy(630)).setFontSize(sd(96)); this.subtitle.setPosition(sx(540), sy(745)).setFontSize(sd(40)); this.button.setPosition(sx(540), sy(1250)).setFontSize(sd(48)); }
}

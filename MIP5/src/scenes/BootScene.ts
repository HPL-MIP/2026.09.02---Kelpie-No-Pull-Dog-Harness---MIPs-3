import Phaser from 'phaser';
import { Assets, Sounds } from '../assets';
import { GameScene } from './GameScene';
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload(): void {
    for (const [key, url] of Object.entries(Assets)) this.load.image(key, url);
    for (const [key, url] of Object.entries(Sounds)) this.load.audio(key, url);
  }
  create(): void { this.scene.start(GameScene.KEY); }
}

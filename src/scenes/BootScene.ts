import Phaser from 'phaser';
import { GameScene } from './GameScene';
export class BootScene extends Phaser.Scene { constructor() { super('Boot'); } create(): void { this.scene.start(GameScene.KEY); } }

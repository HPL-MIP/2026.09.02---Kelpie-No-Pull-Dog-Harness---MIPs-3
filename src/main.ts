import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './constants';
import { initMraid } from './networks';
import { BootScene } from './scenes/BootScene';
import { setViewport } from './utils/responsive';

let game: Phaser.Game | undefined;
let scheduled = false;
let lastWidth = 0; let lastHeight = 0; let lastDpr = 0;
function resize(): void {
  scheduled = false;
  if (!game) return;
  const viewport = window.visualViewport;
  const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));
  const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  if (width === lastWidth && height === lastHeight && dpr === lastDpr) return;
  lastWidth = width; lastHeight = height; lastDpr = dpr;
  game.scale.resize(width * dpr, height * dpr); setViewport(width * dpr, height * dpr);
  game.scene.getScene('Game').events.emit('relayout');
  (game.scene.getScene('Game') as import('./scenes/GameScene').GameScene).relayout();
}
function requestResize(): void { if (!scheduled) { scheduled = true; requestAnimationFrame(resize); } }
async function boot(): Promise<void> {
  await initMraid();
  const parent = document.createElement('div'); parent.id = 'game'; document.body.appendChild(parent);
  game = new Phaser.Game({ type: Phaser.AUTO, parent, transparent: true, scale: { mode: Phaser.Scale.NONE, width: DESIGN_WIDTH, height: DESIGN_HEIGHT }, render: { antialias: true, pixelArt: false }, scene: [BootScene] });
  requestResize(); [100, 300, 600].forEach((delay) => window.setTimeout(requestResize, delay));
  window.visualViewport?.addEventListener('resize', requestResize); window.addEventListener('resize', requestResize);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void boot(), { once: true }); else void boot();

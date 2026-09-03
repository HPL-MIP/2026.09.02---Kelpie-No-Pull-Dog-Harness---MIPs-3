import Phaser from 'phaser';

declare global {
  interface Window {
    mraid?: any;
    trackMraidReadiness?: (mraid: any) => void;
    isMraidUsable?: (mraid: any) => boolean;
    handleClickAction?: () => void;
    clickTag?: string; clickTag1?: string; clickthrough?: string; clickThrough?: string;
    gameReady?: () => void; gameStart?: () => void; gameEnd?: () => void; gameClose?: () => void;
  }
}

let hidden = false;
let exposed = true;
let viewable = true;
let lifecycleBound = false;
let audioVolume = 1;

function callHost(name: 'gameReady' | 'gameStart' | 'gameEnd' | 'gameClose'): void {
  try { window[name]?.(); } catch { /* host callback is optional */ }
}
function pauseRequired(): boolean { return hidden || !exposed || !viewable || document.hidden; }
function notifyLifecycleChange(): void { window.dispatchEvent(new Event('mraidlifecyclechange')); }

export function initMraid(): Promise<void> {
  window.gameReady ??= () => {}; window.gameStart ??= () => {}; window.gameEnd ??= () => {}; window.gameClose ??= () => {};
  const attach = (): void => {
    if (lifecycleBound) return;
    const mraid = window.mraid;
    if (!mraid || typeof mraid.addEventListener !== 'function') return;
    lifecycleBound = true;
    window.trackMraidReadiness?.(mraid);
    try { if (typeof mraid.isViewable === 'function') viewable = Boolean(mraid.isViewable()); } catch { viewable = true; }
    const guarded = (event: string, handler: (...args: any[]) => void) => { try { mraid.addEventListener(event, handler); } catch {} };
    guarded('ready', () => {}); guarded('error', () => {});
    guarded('stateChange', (state: string) => { hidden = state === 'hidden'; notifyLifecycleChange(); });
    guarded('exposureChange', (value: number) => { if (typeof value === 'number') { exposed = value > 0; notifyLifecycleChange(); } });
    guarded('viewableChange', (value: boolean) => { viewable = Boolean(value); notifyLifecycleChange(); });
    guarded('audioVolumeChange', (value: number) => { if (typeof value === 'number') audioVolume = value; });
  };
  attach();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; attach(); resolve(); } };
    const mraid = window.mraid;
    if (!mraid || typeof mraid.getState !== 'function') { window.setTimeout(finish, 500); return; }
    try {
      if (mraid.getState() === 'loading') {
        if (typeof mraid.addEventListener === 'function') mraid.addEventListener('ready', finish);
        window.setTimeout(finish, 2000);
      } else finish();
    } catch { finish(); }
  });
}

export function bindLifecycle(scene: Phaser.Scene): void {
  const sync = () => {
    const key = scene.sys.settings.key;
    if (pauseRequired()) scene.scene.pause(key); else scene.scene.resume(key);
  };
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('mraidlifecyclechange', sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('mraidlifecyclechange', sync);
  });
  sync();
}
export function notifyGameReady(): void { callHost('gameReady'); }
export function notifyGameStart(): void { callHost('gameStart'); }
export function notifyGameEnd(): void { callHost('gameEnd'); }
export function notifyGameClose(): void { callHost('gameClose'); }
export function getAudioVolume(): number { return audioVolume; }
export function triggerCTA(storeUrl: string): void {
  notifyGameClose();
  window.clickTag = storeUrl;
  window.handleClickAction?.();
}

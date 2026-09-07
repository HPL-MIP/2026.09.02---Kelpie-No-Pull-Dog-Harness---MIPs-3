# AGENTS_WEB.md - Applovin Playable, MRAID, and iOS SFX

## Stack
Phaser 3.90, TypeScript, Vite, vite-plugin-singlefile, WebP assets, optional MP3 audio.

Network target: Applovin only (`al`).

This is a basic playable project. It must support Applovin MRAID lifecycle callbacks, responsive Phaser layout, and a guarded Applovin CTA redirect path. It does not support multi-network builds or inline game configuration.

## Project Structure
```
src/
  main.ts              # DOM boot gate, MRAID init, Phaser.Game construction, resize binding
  constants.ts         # Design size, depth constants, authored layout constants, store URL
  networks.ts          # initMraid(), bindLifecycle(), triggerCTA(), notifyGameX()
  analytics.ts         # Optional Applovin analytics wrapper / guarded logging
  utils/
    responsive.ts      # sx(), sy(), sd(), viewport/DPR helpers
  scenes/
    BootScene.ts       # Asset preload
    GameScene.ts       # Orchestrator only; wires game modules and lifecycle
  game/                # Single-responsibility gameplay/UI modules
    # one file per distinct mechanic, widget, or system
assets/
scripts/build-all.mjs  # Applovin-only single-file HTML build
```

Do not add `src/projectDefaults.json`, inline config blocks, config guides, per-network variants, or zipped outputs unless the project scope changes.

## Responsibility Split
- `game/` modules own one concern each. They receive the Phaser scene as a constructor argument and own their game objects.
- `game/` modules must not call ad SDKs, MRAID, analytics, or lifecycle helpers directly.
- `GameScene.ts` is the wiring layer. It creates modules, passes data between them, and calls lifecycle helpers at the correct moments.
- `networks.ts` owns all guarded MRAID access, Applovin-facing callbacks, and CTA redirect logic.
- End-screen CTA buttons must call the shared CTA helper rather than touching `mraid.open()` or `window.open()` directly.

## Rules
- 60 FPS target; never below 30 on mid-range Android.
- `dist/index.html` must stay under 5 MB.
- Use WebP for images and short compressed audio when audio exists.
- No hardcoded layout pixels in scene/game modules. Use `sx()`, `sy()`, and `sd()`.
- No audio autoplay. Start or unmute audio only after the first `pointerdown`.
- Prefer `for` loops in hot game logic; pool frequently spawned objects.
- Use `setDisplaySize(sd(width), sd(height))` for responsive images. Avoid `setScale()` for ordinary image layout.
- Never dim via `body` or page background. Use Phaser overlays at named depths.
- Only one `Phaser.Game` may exist on the page.

## Phaser Config
Use this config shape unless the project has a concrete reason to change it:

```ts
{
  type: Phaser.AUTO,
  transparent: true,
  scale: { mode: Phaser.Scale.NONE, width: 1080, height: 1920 },
  render: { antialias: true, pixelArt: false }
}
```

`Scale.NONE` is required because the project performs manual responsive sizing. CSS size equals viewport pixels; the internal canvas size equals viewport pixels multiplied by DPR.

Keep `antialias: true` to avoid jagged scaled WebP assets.

## Responsive Layout
The authored reference size is `1080 x 1920`.

```ts
const s = Math.min(viewW / 1080, viewH / 1920);
const offX = (viewW - 1080 * s) / 2;
const offY = (viewH - 1920 * s) / 2;
// sx/sy/sd apply offX, offY, and s
```

Requirements:
- Poll `visualViewport` from `update()` or a central responsive service so rotation and browser chrome changes are caught.
- On viewport or DPR change, call `game.scale.resize(vw * dpr, vh * dpr)`, update responsive helpers, then call `relayout()`.
- Debounce resize work with `requestAnimationFrame`; use delayed retries around `100`, `300`, and `600` ms for mobile browser settle.
- Every visible module with authored positions must expose `relayout()` or equivalent.

## Applovin MRAID
These MRAID v2 requirements apply to AppLovin MIP playable HTML builds and take priority for all MRAID work. The implementation must declare the host-provided MRAID bridge exactly once, track readiness near the start of `<head>`, delay creative initialization while MRAID is loading, use `mraid.open()` for click-through inside an MRAID container, preserve supported click-tag/browser fallbacks, pause/resume media based on MRAID viewability, and keep the playable self-contained within the AppLovin size limit.

Declare the bridge in `<head>` before the MRAID helper code:

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="mraid.js"></script>
  </head>
</html>
```

Bridge requirements:
- Include `<script src="mraid.js"></script>` exactly once in the top-level document.
- Use the relative path `mraid.js` exactly as shown.
- Do not use a CDN or absolute URL for the bridge.
- Do not bundle a local implementation of `mraid.js`; the ad container provides it at runtime.
- The network identifier comment may be included for naming/packaging metadata.
- The MRAID bridge and helper must load before the bundled playable script.

Place the readiness helper immediately after the bridge:

```html
<script>
  (function () {
    let mraidIsReady = false;
    let mraidReadyListenerAttached = false;

    function trackMraidReadiness(mraid) {
      if (
        mraidReadyListenerAttached ||
        !mraid ||
        typeof mraid.addEventListener !== "function"
      ) {
        return;
      }

      try {
        mraid.addEventListener("ready", function () {
          mraidIsReady = true;
        });
        mraidReadyListenerAttached = true;
      } catch (error) {
        // getState() remains the primary readiness check.
      }
    }

    window.trackMraidReadiness = trackMraidReadiness;

    window.isMraidUsable = function isMraidUsable(mraid) {
      if (!mraid) {
        return false;
      }

      trackMraidReadiness(mraid);
      if (typeof mraid.getState !== "function") {
        return true;
      }

      try {
        const state = mraid.getState();
        return state === "default" || state === "expanded";
      } catch (error) {
        return mraidIsReady;
      }
    };
  })();
</script>
```

Do not initialize layout, interaction, media playback, orientation handling, or Phaser boot until MRAID is ready. Use this loading-state guard shape:

```js
let creativeInitialized = false;

function init() {
  if (creativeInitialized) return;
  creativeInitialized = true;

  // Initialize the creative here.
}

if (typeof mraid === "undefined") {
  init();
} else {
  if (mraid.getState() === "loading") {
    mraid.addEventListener("ready", init);
  } else {
    init();
  }
}
```

The comparison must be `mraid.getState() === "loading"`, and the `ready` listener must be inside that same branch. Inverse checks such as `getState() !== "loading"` do not pass AppLovin validation. `init()` must be idempotent.

Resolve the standard click variables in this order, use `mraid.open()` when MRAID is usable, and retain the browser fallback:

```js
function handleClickAction() {
  const mraid = window.mraid || {};
  const clickTarget =
    window.clickTag ||
    window.clickTag1 ||
    window.clickthrough ||
    window.clickThrough ||
    "";

  if (
    typeof mraid.open === "function" &&
    window.isMraidUsable(mraid)
  ) {
    try {
      if (clickTarget) {
        mraid.open(clickTarget);
      } else {
        mraid.open();
      }
      return;
    } catch (error) {
      // Continue to the network or browser fallback.
    }
  }

  window.open(clickTarget || "about:blank", "_blank", "noopener");
}
```

Click requirements:
- Do not use only `window.open()` for the playable click action.
- Guard `mraid.open()` with `window.isMraidUsable(mraid)`.
- Wrap `mraid.open()` in `try/catch` so previews and non-MRAID environments can fall back safely.
- Keep all four supported click variables in the fallback chain.
- Scene and game modules must call the shared CTA helper; they must not call redirect APIs directly.
- Do not use `location.href`, `location.assign()`, `location.replace()`, anchor click simulation, or non-AppLovin store SDK APIs.

Any build containing `<video>` or `<audio>` elements must use `mraid.isViewable()` and subscribe to `viewableChange`. Call `setupMraidViewability()` from `init()` before starting media playback. Phaser/WebAudio playback must mirror the same state through `bindLifecycle(scene)`.

```js
let mraidViewable = true;

function syncMediaState() {
  const media = document.querySelectorAll("video, audio");
  media.forEach(function (element) {
    if (!mraidViewable) {
      element.pause();
    } else if (element.tagName === "VIDEO" && element.autoplay) {
      element.play().catch(function () {});
    }
  });
}

function setupMraidViewability() {
  if (typeof mraid === "undefined") return;

  function handleViewableChange(viewable) {
    mraidViewable = Boolean(viewable);
    syncMediaState();
  }

  if (typeof mraid.isViewable === "function") {
    try {
      mraidViewable = Boolean(mraid.isViewable());
    } catch (error) {
      mraidViewable = true;
    }
  }

  if (typeof mraid.addEventListener === "function") {
    mraid.addEventListener("viewableChange", handleViewableChange);
  }
}
```

Runtime lifecycle requirements:
- `main.ts` must wait for DOM readiness and `initMraid()` before constructing `new Phaser.Game(...)`.
- `initMraid()` must never hang startup; use timeouts for late/missing MRAID.
- Guard every MRAID method with `typeof` checks.
- Register `ready`, `error`, `stateChange`, `exposureChange`, `viewableChange`, and `audioVolumeChange` once before Phaser scenes run.
- Seed cached visibility from `mraid.isViewable()` when available.
- Pause on `stateChange: "hidden"`, `exposureChange <= 0`, `viewableChange: false`, and `document.visibilitychange`; resume when visible/exposed again.
- Apply `audioVolumeChange` only when the payload is a number; ignore `null`.
- `bindLifecycle(scene)` must apply cached hidden/non-exposed state immediately once a scene exists.

Common MRAID validation failures:

| Message or symptom | Cause | Fix |
|---|---|---|
| Add exactly one MRAID bridge | The bridge is missing, duplicated, escaped inside generated markup, or uses an absolute URL | Keep one top-level `<script src="mraid.js"></script>` in `<head>` |
| Place readiness helpers after the bridge | Helpers are missing, renamed, placed before the bridge, or buried inside bundled app code | Put the readiness helper immediately after the bridge in `<head>` |
| Missing AppLovin loading-state guard | The condition is inverted or the ready listener is outside the guard | Use the exact `mraid.getState() === "loading"` pattern |
| Missing `mraid.open()` | Clicks use only anchors or `window.open()` | Route the primary click action through guarded `mraid.open()` |
| Guard `mraid.open()` | The call is unguarded or not protected by `try/catch` | Check `window.isMraidUsable(mraid)` and wrap the call |
| Missing click fallback | One or more supported click variables or `window.open()` is absent | Use the complete click-target chain and browser fallback |
| Missing media viewability | A video or audio element exists without MRAID lifecycle handling | Add `isViewable()` and `viewableChange` handling |
| External resources found | The build references a CDN, remote asset, or runtime network request | Embed the asset and remove the external request |

## CTA Redirect
CTA redirect support is Applovin-only and must stay centralized in `networks.ts`.

`triggerCTA(storeUrl)` fallback chain:
```
1. handleClickAction() / mraid.open(clickTarget)
2. window.open(clickTarget || "about:blank", "_blank", "noopener")
```

Requirements:
- Call `notifyGameClose()` before redirecting from a CTA.
- Track `CTA_CLICKED` before redirecting when analytics are enabled.
- `triggerCTA(storeUrl)` may set `window.clickTag = storeUrl` and call `window.handleClickAction()`.
- Use `mraid.open(clickTarget)` only when `window.mraid` exists, `typeof mraid.open === 'function'`, and `window.isMraidUsable(mraid)` returns true.
- Treat missing `mraid.getState()` as ready inside `window.isMraidUsable(mraid)`.
- If MRAID is missing, unsupported, throws, or is not usable, fall back to `window.open(clickTarget || "about:blank", "_blank", "noopener")`.
- Preserve all four supported click variables: `window.clickTag`, `window.clickTag1`, `window.clickthrough`, and `window.clickThrough`.
- Do not use `location.href`, `location.assign()`, `location.replace()`, anchor click simulation, or non-Applovin store SDK APIs.
- Scene and game modules must call the shared helper; they must not call redirect APIs directly.

## Lifecycle Callbacks
Expose guarded stubs on `window` so Applovin preview tooling can detect the lifecycle surface without crashing when SDK methods are absent.

```
gameReady()  -> available after boot stubs are installed
gameStart()  -> notifyGameStart() from GameScene when playable interaction starts
gameEnd()    -> notifyGameEnd() when the playable reaches its terminal state
gameClose()  -> notifyGameClose() only if an internal close/end action exists
```

All lifecycle calls must use `typeof` guards. Missing SDK callbacks are no-ops.

## Analytics
Analytics are optional and must be guarded.

Preferred order:
```
ALPlayableAnalytics.trackEvent(event)
console.log('[Analytics]', event)
```

Do not use cross-network analytics fallbacks such as `playableSDK.reportEvent()`.

Suggested events:
- `DISPLAYED`
- `CHALLENGE_STARTED`
- `CHALLENGE_SOLVED`
- `ENDCARD_SHOWN`
- `CTA_CLICKED`

`CTA_CLICKED` should be emitted immediately before the shared CTA helper redirects.

## Audio
Audio is optional, but when present it must be reliable in mobile ad WebViews and must never autoplay.

The dedicated **iOS SFX implementation** section below is part of this document and takes precedence when sound works on desktop or Android but fails in iPhone Safari, iOS WebViews, or playable-ad previews.

For React ports, all gameplay sound effects must use a shared `src/hooks/useSound.js`-style hook. Do not create audio elements inside event handlers or timers, and do not introduce Web Audio (`AudioContext`) without verifying every supported browser and ad WebView.

The hook architecture must keep separate platform strategies:
- Desktop browsers: create persistent `HTMLAudioElement` instances during layout and silently prime them on the first `pointerdown`.
- iOS and Android: create a media pool before interaction, prime it during the first supported touch/pointer gesture, and retry rejected timer-driven playback during the active drag.
- Keep iPadOS desktop-mode detection in the mobile-media platform check. Do not broaden platform detection to every touchscreen; touchscreen laptops should use the desktop path.

Import assets explicitly from `src/assets/sounds/` and call the sound hook unconditionally near the top of the component. React-style sound registration should look like this:

```jsx
import catchSound from "../assets/sounds/catch.mp3";

const catchAudio = useSound(catchSound, {
  poolSize: 3,
  desktopPoolSize: 1,
});
```

`poolSize` controls the mobile pool. `desktopPoolSize` controls desktop and defaults to `poolSize`. Use multiple instances when a sound may overlap or be restarted quickly.

Play through shared helpers so playback always resets to the beginning:

```jsx
const source = playSound(catchAudio);
playSound(catchAudio, { volume: 0.8 });
stopSound(source);
```

Do not call `.play()` directly unless extending the audio hook or a framework-specific shared audio controller itself.

Audio must unlock from the actual gameplay gesture, not from a separate "Tap to Start" control. For drag games, call `handleUnlockGesture("pointerdown")` from the draggable object's `pointerdown` before pointer capture or other drag work. Also call the helper during pointer movement and release when mobile retry behavior is needed. In React builds, keep native listeners attached directly to the draggable element in addition to React handlers because some mobile WebViews require audio authorization on the touched element rather than through delegated events.

For Phaser projects, apply the same constraints through the Phaser audio controller/module instead of adding the React hook:
- Import audio assets through TypeScript and preload them in `BootScene`; do not create media elements inside event handlers or timers.
- Create/prime reusable Phaser sound instances from the gameplay audio module before the first sound is needed when practical.
- Unlock audio from the actual first gameplay gesture, normally the first `pointerdown` on the interactive play surface, not from a separate start overlay.
- Route all SFX playback through the shared audio controller/module; do not call `.play()` directly from scattered scene/game modules unless extending the audio module itself.
- Reset or restart short SFX through the helper so rapid interactions can replay cleanly.
- Pool or reuse sounds that can overlap or restart quickly, such as scratch/drag/catch effects.
- Preserve muted state and configured volume when priming or unlocking.
- Catch or guard playback failures where the underlying API returns a promise or can throw.
- Keep delayed/timer cues routed through the same audio module so mobile retry/unlock behavior remains centralized.
- MRAID `audioVolumeChange` must apply SDK volume only when the payload is a number; ignore `null`.
- MRAID hidden, zero exposure, `viewableChange: false`, and `document.visibilitychange` must pause or mute active audio and resume only when viewable again.

Audio implementation rules:
- Create and preload audio before the first interaction.
- Prime the exact elements or Phaser sound instances that will later play; replacement elements may remain blocked.
- Preserve muted state and volume while priming.
- Reset `currentTime` or restart short SFX before replaying.
- Catch playback promise rejections or thrown playback errors to avoid unhandled errors.
- Keep timer-delayed cues routed through the same mobile retry/audio helper path.
- Do not remove the desktop `pointerdown` contract.

Audio verification should include desktop Chromium, Safari/WebKit, and physical iOS/Android WebViews when available. The first interaction should be able to be the real gameplay gesture, SFX should play without an earlier page click, overlapping cues should remain audible, and no audio-related console errors should appear.

Suggested verification commands for React/Yarn ports:

```bash
yarn lint
yarn build
yarn dev
```

Suggested verification commands for this Phaser/Vite project:

```bash
npm run build
npm run dev
```

The local missing `mraid.js` warning is expected outside an ad container; investigate all other console errors.

## Build
Vite must output a single classic script creative:
- IIFE format.
- `modulePreload: false`.
- Inline assets through Vite imports and `assetsInlineLimit`.
- Images, fonts, media, styles, and scripts must be embedded or otherwise self-contained.
- Remote `http://`, `https://`, protocol-relative, and WebSocket resources are blocked.
- Runtime requests such as `fetch`, XMLHttpRequest, WebSocket, `sendBeacon`, EventSource, dynamic imports, jQuery AJAX, Axios, and service workers must not call external URLs.
- Navigation through the approved click-through path is allowed.
- The relative `<script src="mraid.js"></script>` declaration is allowed because the ad host supplies it.
- Prefer `data:` URIs for embedded assets. Do not convert the MRAID bridge to a data URI.
- Strip `type="module"` and `crossorigin` from built script tags if present.
- Remove legal/license comments from built HTML and bundled JS.
- Include `<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">`.
- Preserve the Applovin network identifier when the build/naming pipeline uses it.
- Inject exactly one `<script src="mraid.js"></script>` early in the HTML.
- Inject exactly one standard MRAID helper immediately after `mraid.js`, containing `trackMraidReadiness(mraid)`, `window.isMraidUsable(mraid)`, a literal `mraid.getState() === "loading"` guard with `mraid.addEventListener("ready", init)` inside that branch, `function handleClickAction()`, all four click variables, a try/catch guarded `mraid.open(clickTarget)` path, optional `mraid.open()` no-target path, and `window.open(clickTarget || "about:blank", "_blank", "noopener")` fallback.

Expected output:
```
dist/
  index.html
```

If naming variants are needed later, keep the network segment fixed to `al`.

If built output contains `console.error` from Phaser or bundled node modules, drop it at bundle time:

```js
export default {
  esbuild: {
    legalComments: 'none',
    pure: ['console.error'],
  },
};
```

Keep `legalComments: 'none'` or an equivalent build step so `/*! ... */`, `//!`, and generated license banners do not ship in the final Applovin HTML.

Keep project-authored error handling meaningful with visible fallback UI, `console.warn`, or guarded debug logging.

## Asset Loading
- Critical assets in `BootScene` should cover the first visible frame.
- Defer noncritical audio, overlays, and secondary UI when useful.
- Gameplay should not start until required assets are ready.
- Do not reference raw external asset paths from `index.html`; import assets through JS/TS so Vite can inline them.

## Depth Map
Define depths as named constants in `src/constants.ts`. Do not use magic numbers in scene code.

| Layer | Depth |
|---|---:|
| Background | 0 |
| Game objects | 1-10 |
| Logo / HUD | 17 |
| Dim overlay | 20 |
| Result UI | 21 |
| Input blocker / top UI | 25 |

## Ship Checklist
- [ ] Applovin only.
- [ ] CTA redirect uses `triggerCTA(storeUrl)`.
- [ ] CTA fallback chain is `mraid.open(clickTarget)` then `window.open(clickTarget || "about:blank", "_blank", "noopener")`.
- [ ] No direct redirect calls from scene or game modules.
- [ ] `mraid.js` injected exactly once.
- [ ] `trackMraidReadiness(mraid)`, `window.isMraidUsable(mraid)`, and `handleClickAction()` are present in `<head>` immediately after `mraid.js`.
- [ ] MRAID init awaited before Phaser boot and self-resolves on timeout.
- [ ] MRAID `error`, `stateChange`, `exposureChange`, `viewableChange`, and `audioVolumeChange` listeners registered early.
- [ ] CTA path contains all four click variables, `mraid.open(clickTarget)` call, try/catch, and `window.open(clickTarget || "about:blank", "_blank", "noopener")` fallback.
- [ ] Responsive portrait and landscape pass.
- [ ] Canvas resizes to viewport times DPR.
- [ ] No `Scale.FIT`, `Scale.EXPAND`, or `CENTER_BOTH`.
- [ ] Only one `Phaser.Game`.
- [ ] Audio is preloaded/imported through TS, routed through the shared audio module, and muted/unlocked until the first real gameplay gesture.
- [ ] `dist/index.html` under 5 MB.
- [ ] No `type="module"` or `crossorigin` in output script tags.
- [ ] No legal/license comments or generated comment banners in built output.
- [ ] No unsupported inline config output.

## Pitfalls
| Issue | Fix |
|---|---|
| Rotation stuck | Use `Scale.NONE`, poll `visualViewport`, then `resize()` and `relayout()`. |
| Mobile aliasing | Canvas internal size must be viewport times DPR; keep `antialias: true`. |
| FPS drop on resize | Debounce with `requestAnimationFrame` and avoid recreating objects during relayout. |
| MRAID crash | Guard `window.mraid` and every optional method with `typeof`. |
| MRAID ready missed | Check `getState()` first, listen for `ready` only when loading, and self-resolve after about 2 seconds. |
| Late MRAID injection | Poll briefly, about 500 ms, before concluding MRAID is absent. |
| MRAID listener wired too late | Call `initMraid()` at module load and register callbacks before Phaser scenes run. |
| Audio keeps playing when hidden | Pause/mute on MRAID hidden or zero exposure, and also handle `document.visibilitychange`. |
| iPhone black screen | Create only one `Phaser.Game`; avoid synchronous module-load Phaser boot before DOM and MRAID gates. |
| Phaser parent missing | Create the game container in `boot()` and pass the element reference as `parent`. |
| External asset path survives build | Import assets from JS/TS; do not put raw `src/assets/...` paths in `index.html`. |
| Redirect logic scattered | Keep `mraid.open()` and `window.open()` inside `networks.ts`; scene/game modules call `triggerCTA(storeUrl)`. |
| Unsafe redirect API | Do not use `location.href`, `location.assign()`, `location.replace()`, anchor click simulation, or non-Applovin store SDK APIs. |
| Click-chain validation failure | Keep `handleClickAction()`, all four click variables, guarded `mraid.open(clickTarget)`, and the three-argument `window.open()` fallback in the head helper. |
| First SFX blocked | Preload audio, unlock from the first real gameplay `pointerdown`, and route all playback through the shared audio module. |

## iOS SFX Implementation

Use these requirements when SFX works on desktop or Android but fails in iPhone Safari, iOS WebViews, or playable-ad previews. The goal is for the **first real gameplay gesture** (for example, tap-and-drag) to authorize and play sound.

### Core rule

Create the exact audio instances early, before interaction. On the interactive element's native `pointerdown` or `touchstart`, unlock those existing instances and request the immediately audible SFX in that same synchronous event. Do not require a separate "Tap to Start" button.

React is **not** required. Keep Phaser games in Phaser; add a shared native-audio controller. Use a React hook only when the game is already React.

### Required behavior

1. Import/preload every SFX before the first interaction.
2. Create persistent `HTMLAudioElement` instances or a reusable pool during startup/layout—never inside an event handler or timer.
3. Add native capture listeners directly to the draggable/clickable element. Framework-delegated handlers alone can arrive too late in some iOS WebViews.
4. In native `pointerdown` / `touchstart`, call the shared audio unlock helper first, then play the interaction SFX immediately.
5. Keep a rejected `play()` request pending and retry that same element on native `pointermove`, `pointerup`, `touchmove`, or `touchend` while the drag is active.
6. Use a pool when a sound can overlap or restart quickly. Reset `currentTime = 0` before replay.
7. Catch every `play()` rejection. Do not silently create a replacement audio tag after rejection.
8. Pause active sounds when the document/MRAID is hidden or not viewable. Resume only if the interaction is still active and the creative is viewable.

### Phaser implementation

Use Phaser for rendering and gameplay; use a single `SoundController` (or equivalent) for browser audio. This avoids framework audio unlock timing being the only path.

```ts
// SoundController.ts
class SoundController {
  private readonly slider = new Audio(sliderSfxUrl);
  private sliderHeld = false;
  private sliderPending = false;

  constructor() {
    this.slider.preload = 'auto';
    this.slider.loop = true;
    this.slider.volume = 0.7;
  }

  handleUnlockGesture(): void {
    // Runs synchronously from the real native gesture.
    if (this.slider.readyState === HTMLMediaElement.HAVE_NOTHING) {
      this.slider.load();
    }
  }

  startSlider(): void {
    this.sliderHeld = true;
    this.requestSliderPlayback();
  }

  retryActiveSounds(): void {
    if (this.sliderHeld && this.sliderPending) this.requestSliderPlayback();
  }

  stopSlider(): void {
    this.sliderHeld = false;
    this.sliderPending = false;
    this.slider.pause();
    this.slider.currentTime = 0;
  }

  private requestSliderPlayback(): void {
    if (document.hidden || !this.slider.paused) return;
    this.slider.currentTime = 0;
    try {
      const request = this.slider.play();
      if (request) void request.then(() => { this.sliderPending = false; })
        .catch(() => { this.sliderPending = true; });
    } catch {
      this.sliderPending = true;
    }
  }
}
```

Attach native listeners to the Phaser canvas, and call audio before normal drag work:

```ts
canvas.addEventListener('pointerdown', (event) => {
  if (!isOverDraggableHandle(event)) return;
  sounds.handleUnlockGesture();
  sounds.startSlider();
}, { capture: true, passive: true });

canvas.addEventListener('pointermove', () => sounds.retryActiveSounds(), {
  capture: true,
  passive: true,
});
canvas.addEventListener('pointerup', () => sounds.stopSlider(), {
  capture: true,
  passive: true,
});
```

If the project must retain Phaser HTML5 audio (`disableWebAudio: true`), unlock and load the **cached tags Phaser created** from `scene.cache.audio` during that same native gesture. Do not create substitute tags: iOS authorization applies to the specific media element. Retain rejected cached-tag playback for move/release retry.

### React implementation

Create a `useSound` hook that owns persistent pools. Call it unconditionally in a component mounted before the first gesture. The hook should expose:

```ts
type SoundHandle = {
  handleUnlockGesture: () => void;
  play: () => void;
  retryPending: () => void;
  stop: () => void;
};
```

Bind native listeners directly to the draggable DOM element as well as any React event handlers:

```tsx
const onPointerDown = () => {
  sliderSound.handleUnlockGesture();
  sliderSound.play();
  beginDrag();
};

element.addEventListener('pointerdown', onPointerDown, { capture: true });
element.addEventListener('pointermove', sliderSound.retryPending, { capture: true });
element.addEventListener('pointerup', sliderSound.stop, { capture: true });
```

Pre-create end-card and delayed-cue pools in the same early-mounted parent. Timer-driven playback must go through the same pending/retry controller.

### Do not do this

- Do not convert a Phaser game to React solely to add SFX.
- Do not create `new Audio()` inside `pointerdown`, a timeout, scene creation after the gesture, or an end card.
- Do not rely only on a `useEffect`, timer, Phaser delayed callback, or a global page click for first-gesture authorization.
- Do not start audio automatically on page load.
- Do not call `.play()` directly from scattered gameplay code; route it through one controller/hook.
- Do not repeatedly call `load()` once an element is ready; it can reset media state.
- Do not replace a rejected media element with a newly created one.
- Do not use silent `play()` then immediate `pause()` as the only authorization strategy; it can create `AbortError` races and still miss the intended audible first cue.

### MRAID and visibility

For playable ads, keep MRAID lifecycle handling centralized:

- Pause/mute audio on `stateChange: hidden`, `exposureChange <= 0`, `viewableChange: false`, and `document.visibilitychange`.
- Seed viewability from `mraid.isViewable()` when available.
- Resume only if the user interaction is still active and the creative is viewable.
- Apply `audioVolumeChange` only when its value is a number.

### Verification checklist

- The very first player action can be tap-and-drag; no preliminary page tap is needed.
- Slider/scratch/drag SFX begins during that first gesture on a physical iPhone.
- Releasing then starting another drag restarts the SFX cleanly.
- Rapid or overlapping one-shot sounds stay audible when a pool is required.
- End-card/delayed SFX uses a pre-created element and produces no unhandled promise errors.
- The creative is tested in Safari/WebKit and the target ad-network preview/WebView, not only desktop Chrome.
- Build passes and the output remains self-contained and within its size cap.

### Reuse prompt

> Read `AGENTS_WEB` and fix iOS SFX without changing the rendering framework. Create persistent audio pools before gameplay, unlock them from the exact native draggable-element gesture, play the first interaction cue immediately, retry rejected requests during the active drag, and preserve MRAID visibility handling.

# Prompt — standalone SIP frozen inside a preview iframe

Hand this to an AI coding agent when a SIP end-card creative plays standalone but not in
Playable Workshop / PLEC, or when porting the newer SIP builder template to a new project.

**Status for Kelpie MIP-5: already applied and verified.** This document is the reusable
recipe and the reasoning, so the next project does not rediscover it the hard way.

---

## Symptom

The standalone SIP creative (`*_sip_*.html`) shows its static layout but the video never
starts — frozen on frame one, `paused=true`, `currentTime=0` — when opened in a preview
host. Open the exact same file directly in a browser and it plays fine. The MIP build,
which embeds the same end card in an iframe, also plays fine.

## Root cause

Newer SIP builder exports gate playback on a presentation flag:

```js
let presentationActive = window.parent === window;   // <-- the problem
let hostMediaAllowed = true;

window.setSipPresentationActive = function (active) { /* … */ };

function syncWindowActivityState() {
  const isActive =
    document.visibilityState === "visible" &&
    mraidViewable &&
    presentationActive &&
    hostMediaAllowed;

  if (isActive) { video.play().catch(() => {}); }
  else { detachActiveListeners(); video.pause(); }
}
```

`window.parent === window` is true **only when the document is top-level**.

- **In the MIP that is correct.** The carousel owns the iframe and calls
  `iframe.contentWindow.setSipPresentationActive(true)` when it reveals the end card
  (`EndcardOverlay` in `src/game/Carousel.ts`). The gate is how the carousel pauses the
  end card while it is still hidden behind slide 5.
- **In the standalone SIP it is fatal.** There is no parent to call the activator. Served
  top-level it plays; served inside *any* preview iframe, `presentationActive` stays
  `false` and `syncWindowActivityState()` pauses the video permanently.

Older SIP templates have **no** `presentationActive` at all, which is why an older SIP
build plays everywhere and the newer one does not. Confirm which template you have:

```bash
grep -c presentationActive <the-sip>.html   # 0 = old template, unaffected
```

## The fix

In the **standalone** branch of the end-card build step in `vite.config.ts` — the same
branch that keeps the `mraid.js` bridge and skips JS minification — seed the flag active:

```ts
html = html.replace(
  /let presentationActive\s*=\s*window\.parent === window;/,
  'let presentationActive = true;',
);
```

Constraints:

- **Only in the standalone/SIP path.** The MIP's embedded copy must keep
  `window.parent === window` so the carousel retains pause/resume control.
- **Do not remove `window.setSipPresentationActive`.** Only its initial value changes; a
  host that calls it can still pause and resume.
- **Change nothing else.** Layout, animation, typography, the orientation source swap, the
  date and custom-text overlays, and the MRAID click chain all stay exactly as authored.

A standalone creative *is* the presentation, so seeding it active is correct, not a hack.

## Verification — reproduce the failure before trusting the fix

Drive a real Chromium with `puppeteer-core`. Load the SIP twice: once top-level, once
inside a same-origin `file://` iframe written to a real host HTML file (`page.setContent`
will not work — an `about:blank` host cannot frame a `file://` child). Wait ~4s, then read
`video.paused` and `video.currentTime` from the child frame.

Expected before the fix:

```
SIP  top-level      -> PLAYING      paused=false t=4.0s
SIP  inside iframe  -> NOT PLAYING  paused=true  t=0s
```

Expected after:

```
SIP  top-level      -> PLAYING      paused=false t=4.0s
SIP  inside iframe  -> PLAYING      paused=false t=4.0s
```

Also confirm the MIP is untouched: its embedded copy should still contain the minified
`window.parent===window` seed.

## Dead ends — do not repeat these

Diagnosed and disproved on this creative:

| Theory | Why it is wrong |
|---|---|
| Video bitrate / file size too high | The **working** SIP-3 is 2.13 MB with 1.6 MB of video; the failing SIP-5 was 0.57 MB with 280 KB. The working file is 3.7× larger. |
| H.264 High vs Main profile | Both decode fine; the failing file was already re-encoded to Main and still failed. |
| `moov` after `mdat` (missing faststart) | Present in the working reference too. |
| Data URI too large for the `<video>` | Swapping to a `Blob` URL did not help and risks a black card if a host blocks `blob:` media. Reverted. |
| End card slower in the SIP than the MIP | The MIP only *looks* faster because `Carousel.ts` pre-warms the iframe a slide early. |

Re-encoding and faststart are still worthwhile for size and start latency — the Kelpie
videos went 1,202 KB → 280 KB at SSIM 0.998 — but neither fixes this bug.

The tell that separates this from every size-related theory: **the creative plays when
opened directly and freezes when framed.** Test that first.

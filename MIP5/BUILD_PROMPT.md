# Kelpie MIP-5 "Tiltflow 3" — build prompt

Hand this to an AI coding agent as-is.

All coordinates below were measured by template-matching each asset PNG against the
1080×1920 mockups in `Mock_up/`. They are the real composite positions, not estimates.

---

Build **Kelpie MIP-5 "Tiltflow 3"**, a single-file AppLovin playable ad, as a new sibling project. It is a 6-step product carousel that reuses the engine from the existing MIP-3 project and replicates five supplied mockups **1:1**.

## Sources

- **Engine to port from:** `D:\WebDev\2026.09.02 - Kelpie (No-Pull Dog Harness) - MIPs + SIPs\2026.09.02---Kelpie-No-Pull-Dog-Harness---MIPs-3`
- **Art + brief:** that repo's `MIP5\Assets\` — `Image\` (slide art), `Mock_up\1-5.png` (the 1080×1920 frames you must match), `Mock_up\…MIP 5.jpg` (flow sheet), `sfx\` (Click.mp3, end.mp3 — byte-identical to MIP-3's), `Video\` (SIP-05 MP4s, see §7)
- **Spec you must obey:** `AGENTS_WEB.md` in the MIP-3 repo. It is authoritative — AppLovin only, MRAID v2, `dist` under 5 MB, WebP images, no audio autoplay, no hardcoded pixels outside the layout constants.
- **Create the new project at:** `D:\WebDev\2026.09.02 - Kelpie (No-Pull Dog Harness) - MIPs + SIPs\2026.09.02---Kelpie-No-Pull-Dog-Harness---MIP-5` (self-contained: its own `package.json`, `vite.config.ts`, `index.html`, `src/`, `Assets/`, `scripts/`).

## 1. Port the engine verbatim

Copy these from MIP-3 unchanged in structure — they are already AppLovin-validated, do not redesign them:

- `index.html` — the MRAID bridge + readiness helper + `handleClickAction()` head block. Keep it byte-for-byte except the `<title>`.
- `src/networks.ts`, `src/analytics.ts`, `src/utils/responsive.ts`, `src/constants.ts`, `src/scenes/BootScene.ts`, `src/game/AudioController.ts`
- `vite.config.ts` — including the `inlineEndcard` virtual-module plugin, the `applovinHtml` module-strip, `trimMp3`, and the end-card minifier
- `scripts/build-all.mjs`, `scripts/finalize-build.mjs`, `tsconfig.json`, `.gitignore`

Then apply the fixes in §8 **while porting**, so MIP-3's known bugs are not carried forward.

## 2. Carousel mechanics — same as MIP-3, minus the offer header

Port `src/game/Carousel.ts` and keep: `LayoutGroup` (with `addImage` / `addBottomImage` / `addText`), `SharedChrome`, `Navigation`, `TutorialHint`, `EndcardOverlay`, `Slide`, and the `Carousel` orchestrator with its slide-transition tween.

Preserve exactly:

- 6 steps: slides 1–5 plus the end-card iframe as step 6
- `transitionMs: 330`, `Cubic.Out` counter tween sliding outgoing and incoming slides by viewport width
- Swipe (`swipeThreshold: 54`) and arrow taps; left arrow hidden on slide 1, right arrow hidden on step 6
- `idleAutoAdvanceMs: 4000` auto-advance, re-armed on every `pointerdown`
- Hand hint: fade in, pulse-down loop (`pulseDownScale 0.9`, `pulseMs 220`, `pulseGapMs 1000`), hide on interaction, reappear after `idleMs 5000`, never shown on the last step
- End card pre-parsed by `EndcardOverlay.prepare()` when slide 5 is reached, revealed on the user's action so there is no white flash
- Click SFX on arrow taps and CTA; end SFX when the end card appears; all audio silent until the first `pointerdown`

**Delete** the `OfferHeader` class, the `isOfferSlide()` helper, the fade-out branch in `move()`, and the `syncOfferHeader()` call in `show()`. **MIP-5 has no timer on slides 2 and 3** — every slide is self-contained. The only timer is on slide 5 (§5).

## 3. Shared chrome — identical on all five slides

Positions are **centre points on the 1080×1920 board**, for `setPosition(sx(x), sy(y))` + `setDisplaySize(sd(w), sd(h))`:

| Element | x | y | w×h | Depth |
|---|---:|---:|---|---|
| Logo | 540 | 152 | 556×80 | `Hud` |
| CTA button | 545.5 | 1734.5 | 551×155 | `Input` |
| Dogs footer strip | 540 | bottom-anchored, `bottomOffset: 0` | 1080×187 | `Hud` |
| Left arrow | 97.5 | 964.5 | 93×93 | `Input` |
| Right arrow | 992.5 | 964.5 | 93×93 | `Input` |
| Hand hint | 992.5 | 964.5 | 178×182 | `Input` |

The dogs strip must use MIP-3's `addBottomImage` (anchored to the physical viewport bottom, not the artboard) so it stays flush at any aspect ratio.

The CTA keeps MIP-3's breathing pulse: `addCounter` from 1 → 1.3, `duration 650`, `yoyo`, `repeat -1`, `Sine.InOut`, driving `setDisplaySize`.

The hand hint is **not present in the mockups** — place it over the right arrow as listed. Its `IMAGE_SIZE` entry and its pulse-tween size constant must both be `178×182` (see §8.5).

## 4. Slide layouts — measured from the mockups, match these exactly

All values are centre points on the 1080×1920 board. Text-image depth `Hud`, photo depth `Game`.

### Slide 1 — `Mock_up/1.png` · "This is what a calm walk actually looks like."

| Asset | x | y | w×h |
|---|---:|---:|---|
| `This is what a calm walk actually looks like.png` | 539.5 | 442 | 845×274 |
| `slide_show_image_1.png` | 540.5 | 1118 | 759×844 |

### Slide 2 — `Mock_up/2.png` · product flat-lay + feature icons (no heading)

| Asset | x | y | w×h |
|---|---:|---:|---|
| `slide_show_image_2.png` | 540.5 | 770 | 759×922 |
| `slide_show_image_2_1.png` (icon strip) | 539.5 | 1357.5 | 759×171 |
| `slide_show_image_2_text.png` (icon labels) | 541 | 1491.5 | 760×97 |

### Slide 3 — `Mock_up/3.png` · "Regular Collar vs Kelpie"

| Asset | x | y | w×h |
|---|---:|---:|---|
| `Regular Collar Kelpie.png` (heading) | 543.5 | 451 | 641×238 |
| `slide_show_image_3.png` (photo pair) | 538 | 977 | 850×612 |
| `Regular Collar.png` (left label) | 311.5 | 1361 | 331×44 |
| `Kelpie.png` (right label) | 757.5 | 1359.5 | 143×45 |
| `Pressure on the throat, pulling gets worse.png` | 320 | 1490 | 334×118 |
| `Pressure moves to the chest, pulling settles.png` | 758 | 1489 | 302×118 |

### Slide 4 — `Mock_up/4.png` · "What changes the moment it's clipped on"

| Asset | x | y | w×h |
|---|---:|---:|---|
| `What changes  the moment it's clipped on.png` | 540 | 451.5 | 714×287 |
| `slide_showimage_4.png` | 540.5 | 1118 | 759×844 |

### Slide 5 — `Mock_up/5.png` · 70% OFF + countdown

| Asset | x | y | w×h |
|---|---:|---:|---|
| `70% OFF.png` | 539.5 | 805.5 | 641×113 |
| `Discount reserved for.png` | 545 | 958.5 | 676×49 |
| `Count_Down.png` (timer plate) | 543.5 | 1144 | 729×154 |

## 5. Slide-5 countdown

A 10-minute HH:MM:SS countdown from `00:10:00`, ticking once per second, driven by Phaser text over the plate — same approach as MIP-3's `addLongTimer()`.

The three teal boxes sit at **x = 282, 542.5, 803**, all at **y = 1143**. Render hours / minutes / seconds as three centred `Bricolage Grotesque` text objects at those points, zero-padded to two digits. Match the mockup's digit size (≈59 px on the 1080-wide board, as MIP-3 uses) and colour `#000000`.

**Blocker:** `Count_Down.png` as supplied has `00:10:00` **baked into all three boxes**, so live digits would draw on top of static ones. MIP-3's equivalent plate (`Assets/Kelpie/scene5_timer.png`) bakes only the hours `00` and leaves the other two boxes empty, which is why its timer works. Request a digit-free plate. Until it arrives, either use MIP-3's `scene5_timer.png` as a stand-in or render the countdown with Phaser-drawn rounded rectangles at the coordinates above.

## 6. Asset pipeline — WebP is mandatory, not optional

`MIP5/Assets/Image/` is 4.16 MB of PNG, which inlines to **5.29 MB of base64 — over the entire 5 MB cap before Phaser or the end card are counted.** As delivered the build lands near 8.5 MB. Converting fixes it.

Convert **all** images to WebP (quality ~82 for photos, lossless or ~95 for flat text/UI art) and rename off the hostile originals — the current names contain spaces, a `%`, commas, a curly `'` (U+2019) and a double space, all of which break Vite imports. Keep MIP-3's naming convention:

| Source | New name | w×h |
|---|---|---|
| `Logo.png` | `logo.webp` | 556×80 |
| `CTA.png` | `cta.webp` | 551×155 |
| `Dogs.png` | `design.webp` | 1080×187 |
| `left_arrow.png` / `right_arrow.png` | `left_arrow.webp` / `right_arrow.webp` | 93×93 |
| `handhint.png` | `handhint.webp` | 178×182 |
| `This is what a calm walk actually looks like.png` | `slide1_text.webp` | 845×274 |
| `slide_show_image_1.png` | `slide1_main.webp` | 759×844 |
| `slide_show_image_2.png` | `slide2_main.webp` | 759×922 |
| `slide_show_image_2_1.png` | `slide2_icons.webp` | 759×171 |
| `slide_show_image_2_text.png` | `slide2_icon_text.webp` | 760×97 |
| `Regular Collar Kelpie.png` | `slide3_text.webp` | 641×238 |
| `slide_show_image_3.png` | `slide3_main.webp` | 850×612 |
| `Regular Collar.png` | `slide3_label_left.webp` | 331×44 |
| `Kelpie.png` | `slide3_label_right.webp` | 143×45 |
| `Pressure on the throat, pulling gets worse.png` | `slide3_caption_left.webp` | 334×118 |
| `Pressure moves to the chest, pulling settles.png` | `slide3_caption_right.webp` | 302×118 |
| `What changes  the moment it's clipped on.png` | `slide4_text.webp` | 714×287 |
| `slide_showimage_4.png` | `slide4_main.webp` | 759×844 |
| `70% OFF.png` | `slide5_headline.webp` | 641×113 |
| `Discount reserved for.png` | `slide5_subtext.webp` | 676×49 |
| `Count_Down.png` | `slide5_timer.webp` | 729×154 |

The four photographic sources (`slide1_main`, `slide2_main`, `slide3_main`, `slide4_main` — 3.56 MB combined) carry ~90% of the weight; they must end up around 350 KB total.

**Do not resize.** Dimensions above are native and drive the `IMAGE_SIZE` table; keep them exact so the measured coordinates stay valid.

Copy `sfx/Click.mp3` and `sfx/end.mp3` across unchanged. Ignore `MIP5/Assets/Font/` entirely — 9.9 MB of TTFs that duplicate the `@fontsource-variable/bricolage-grotesque` woff2 the project already uses.

## 7a. End-card video encoding — size and start latency

> **If the standalone SIP freezes on frame one in Playable Workshop, it is not this
> section.** That is the `presentationActive` gate — see
> [SIP_PRESENTATION_FIX_PROMPT.md](SIP_PRESENTATION_FIX_PROMPT.md). The tell: the creative
> plays when opened directly and freezes when framed in an iframe. Everything below is a
> real size win but does not fix that bug.

Measured against a known-good SIP (`D:\WebDev\2026.09.01 - Glov Beauty\SIP_6\Assets\Video\…html`), same 6s duration and same resolutions:

| | Working (Glov) | Kelpie as delivered |
|---|---|---|
| Portrait | 225 KB @ **305 kbps** | 608 KB @ **812 kbps** |
| Landscape | 153 KB @ **207 kbps** | 594 KB @ **793 kbps** |
| H.264 profile | **Main**, level 4.0 | **High**, level 3.2 |
| `moov` position | after `mdat` | after `mdat` |
| Total video | **378 KB** | **1,202 KB** |

Ours is ~2.7× the bitrate for the same seconds and pixels. Everything is base64-inlined, so a player must decode and demux 3.2× more bytes before frame one — that is the delay before the end card starts.

Three fixes, all applied:

1. **Re-encoded — done.** The videos in `Assets/Kelpie/end.html` were replaced, and the masters kept at `Assets/Video/endcard_{portrait,landscape}.mp4`:

   ```bash
   ffmpeg -i in.mp4 -c:v libx264 -profile:v main -level 4.0 -pix_fmt yuv420p \
          -b:v 300k -maxrate 400k -bufsize 800k -preset slow -an \
          -movflags +faststart out.mp4
   ```

   Result: **1,202 KB → 280 KB (-77%)** at **SSIM 0.998** against the originals — visually indistinguishable, and now lighter than the Glov reference. `-an` is safe: the end card is `muted` and the sources carry no audio track. Re-run this whenever new end-card video arrives.

2. **`faststart` is applied automatically at build time.** `vite.config.ts`'s `faststartMp4()` moves `moov` ahead of `mdat` and rewrites the `stco` chunk-offset tables. It is a pure box re-order — verified byte-identical `mdat` payload and unchanged file size — so it costs nothing and survives the videos being replaced. Keep it even after re-encoding with `+faststart`, since supplied end cards routinely arrive `moov`-last.

Do **not** try to fix start latency by dropping one orientation: the end card swaps sources on rotation and needs both.

### Why the MIP's end card looks instant and the SIP's does not

They cost the same. `Carousel.ts` calls `EndcardOverlay.prepare()` when the user reaches **slide 5** — one step early — which builds the `srcdoc` iframe and starts the video decoding seconds before anyone taps through. The MIP is *pre-warmed*; it is not faster. The standalone SIP has no earlier moment, so it pays the full cold start in view of the user.

Do not "fix" this by removing the pre-warm. Reduce the actual cost instead:

3. **Blob URL instead of a data URI.** `vite.config.ts` rewrites `const srcPortrait/srcLandscape = "data:video/mp4;base64,…"` to `__sipBlobUrl("data:…")`, which `atob`s the payload once into a `Blob` and hands the `<video>` a short `blob:` URL. The media element otherwise re-parses an ~800 KB string before it can decode. The injected helper falls back to the original data URI two ways — a `try/catch` if `URL.createObjectURL` throws, and an `error` listener on the video that re-points `<source>` at the data URI and reloads — because a slow end card is bad but a black one is worse.

## 7. End card

MIP-5's own end card is still being authored. **Use MIP-3's `Assets/Kelpie/end.html` for now**, wired through the same `virtual:kelpie-endcard` plugin, so the build is complete and testable. Leave the plugin's swap point obvious so the real end card drops in later.

One improvement to make now: `end.html` embeds two MP4s at ~801 KB and ~804 KB. `MIP5/Assets/Video/` holds newer, ~25% smaller encodes of the same SIP-05 spots (623 KB portrait, 608 KB landscape). Substitute them — it saves ≈ 0.48 MB.

## 8. Fix these MIP-3 bugs during the port — do not copy them forward

1. **`STORE_URL` is empty** in `constants.ts`, so the CTA has no destination. Ask for the store URL; leave a single clearly-marked constant.
2. **The end card's CTA can never receive a click target.** MIP-3's iframe bridge copies `window.clickTag` — a *string*, snapshotted when the iframe is built on slide 5, before anything assigns it. Instead expose one parent hook (e.g. `window.__kelpieCTA`) that calls `triggerCTA(STORE_URL)` in `networks.ts`, and have the iframe's `handleClickAction` call it. This also restores `notifyGameClose()` and `track('CTA_CLICKED')` on the end-card click, which AGENTS_WEB.md requires.
3. **`notifyGameEnd()` is never called.** Fire it, plus `track('ENDCARD_SHOWN')`, when the end card is revealed. Route it through `GameScene` via a constructor callback — AGENTS_WEB.md forbids `game/` modules calling lifecycle helpers directly.
4. **The background rectangle does not cover the canvas.** `GameScene` adds a fixed 1080×1920 white rect in raw canvas pixels and never relayouts it, but the canvas is sized `viewport × DPR`. On an iPhone 14 Pro (1179×2556) that leaves a 99 px right strip and a 636 px bottom band transparent — with the dogs strip sitting in it. Resize the rect to `getViewport()` inside `relayout()`.
5. **Hand-hint size mismatch.** MIP-3's `IMAGE_SIZE.handHint` is `178×182` but its pulse tween drives `142×145`, so the hand snaps 20% smaller when the pulse starts. Use one value for both.
6. `getAudioVolume()` is captured from MRAID `audioVolumeChange` but never applied — apply it in `AudioController`.
7. Delete the unused `waitForMraid` helper from `index.html` and add the `console.log('[Analytics]', event)` fallback to `analytics.ts`.
8. Harden the module-strip in `vite.config.ts` from an exact string match to a regex (`/<script\b[^>]*\btype="module"[^>]*>/` → `<script>`) so a Vite bump cannot silently ship an ES-module tag.

## 9. Build naming — two deliverables from one `npm run build`

The build emits both the full playable and the end scene on its own:

| File | Contents |
|---|---|
| `kelpie_acslanot_mip_20260902_05_emily_product_carousel_human_dd_none.html` | full carousel playable |
| `kelpie_acslanot_sip_20260902_05_emily_product_carousel_human_dd_none.html` | end scene only |

This is already wired up in the MIP-3 repo you are porting from — carry it across as-is:

- `scripts/finalize-build.mjs` holds the shared slug (`20260902_05_emily_product_carousel_human_dd_none`) in one constant and derives both names from it, renaming `dist/index.html` and `dist/endcard.sip.html` into place. It also prints each file's size and flags anything over 5 MB.
- `vite.config.ts` builds the end card twice from the same `buildEndcard()` helper: once with the `mraid.js` bridge **stripped** for the version embedded in the MIP's iframe (the parent page already declares it), and once with the bridge **kept** for the standalone SIP, emitted to `dist/endcard.sip.html` by the `emitSipEndcard` plugin.

Keep `name` in `package.json` matching the MIP name. Confirm the exact slug with the PM before shipping rather than guessing.

### Playable Workshop's 28px image floor — keep this, it is not optional

Playable Workshop runs a vision model over every embedded image and **rejects the upload if any is under 28px on a side** (the error reads `height(4) or width(4) must be larger than 28 for Qwen 3 VL models`). Phaser ships two such images as string literals in its own source, so they land in the bundle regardless of what the game config says — overriding `images.white` at runtime does **not** remove the literal:

| Phaser source | What it is | Fix |
|---|---|---|
| `core/Config.js` `images.white` default | 4×4 solid white, loaded as the `__WHITE` texture WebGL binds for untextured geometry | swap for the same solid white at 32×32 — it samples identically |
| `device/CanvasFeatures.js` `pngHead` | a bare PNG header the Canvas blend-mode probe concatenates with a body and footer at runtime; never rendered, but parses as a 4×1 IHDR | split the literal so `data:image/png;base64,` never appears contiguously; the runtime string is unchanged |

`scripts/finalize-build.mjs` applies both and then **fails the build** if any embedded image is still under 28px, so a Phaser upgrade that changes these literals surfaces at build time instead of at upload. Port that script across intact.

This is also a standing argument for the WebP conversion in §6: an all-WebP creative with no Phaser default textures has none of this problem.

## 10. Verification

```bash
npm run check        # tsc --noEmit, must stay clean
npm run build
npm run dev
```

Then, against `dist/`:

1. Size < 5 MB. Report the actual number.
2. `grep -c 'type="module"\|crossorigin' dist/*.html` → `0`.
3. Exactly one `<script src="mraid.js">`; the literal `mraid.getState() === "loading"` guard and all four click variables survive minification.
4. No `http://` / `https://` / `ws://` references outside comments.
5. **Screenshot each of the five slides at 1080×1920 and diff against `MIP5/Assets/Mock_up/1-5.png`.** This is the acceptance test — the brief is "1:1".
6. Walk the carousel by arrow, by swipe, and by idle auto-advance; confirm the end card appears with no white flash and no way back.
7. Resize to a non-9:16 aspect and confirm no transparent bands (temporarily set `body{background:#f0f}` to make gaps obvious).
8. Confirm no audio before the first tap, and that click/end SFX fire after it.

## Out of scope

Do not add per-network variants, `projectDefaults.json`, inline config blocks, or zipped outputs — AGENTS_WEB.md forbids them. AppLovin only.

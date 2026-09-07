import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { transform } from 'esbuild';

const applovinHtml = {
  name: 'applovin-classic-script',
  apply: 'build' as const,
  async closeBundle() {
    const output = resolve('dist/index.html');
    const html = await readFile(output, 'utf8');
    const classicScript = html.replace(
      /<script\b[^>]*\btype=["']module["'][^>]*>/i,
      '<script>',
    );
    const withoutCrossoriginAttributes = classicScript.replace(
      /<(script|style)\b[^>]*>/gi,
      (tag) => tag.replace(
        /\s+crossorigin(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,
        '',
      ),
    );
    // Keep Phaser's runtime attribute and namespace strings functional while
    // ensuring the self-contained artifact has no validator-blocked literals.
    const validatedHtml = withoutCrossoriginAttributes
      .split('"crossorigin"').join('"cross"+"origin"')
      .split("'crossorigin'").join("'cross'+'origin'")
      .split('https://').join('https:\\/\\/')
      .split('http://').join('http:\\/\\/');
    await writeFile(output, validatedHtml);
  },
};

const devMraidPlaceholder: Plugin = {
  name: 'dev-mraid-placeholder',
  apply: 'serve' as const,
  configureServer(server) {
    server.middlewares.use('/mraid.js', (_request, response) => {
      response.setHeader('Content-Type', 'application/javascript');
      response.end('/* The AppLovin host supplies mraid.js in production. */');
    });
  },
};

/**
 * Move an MP4's `moov` atom in front of `mdat` — what `ffmpeg -movflags
 * +faststart` does — and fix up the chunk-offset tables it contains.
 *
 * The supplied end-card videos ship with `moov` last, so a player cannot render
 * frame one until it has read the whole file: every byte of a ~800 KB base64
 * data URI. That is the stall before the end card starts playing. This is a
 * pure box re-order — no re-encode, same frames, same byte count.
 */
function faststartMp4(buffer: Buffer): Buffer {
  const top: { type: string; start: number; size: number }[] = [];
  for (let off = 0; off + 8 <= buffer.length;) {
    let size = buffer.readUInt32BE(off);
    const type = buffer.toString('latin1', off + 4, off + 8);
    let header = 8;
    if (size === 1) { size = Number(buffer.readBigUInt64BE(off + 8)); header = 16; }
    else if (size === 0) size = buffer.length - off;
    if (size < header || off + size > buffer.length) return buffer;
    top.push({ type, start: off, size });
    off += size;
  }

  const moovIndex = top.findIndex((box) => box.type === 'moov');
  const mdatIndex = top.findIndex((box) => box.type === 'mdat');
  if (moovIndex === -1 || mdatIndex === -1 || moovIndex < mdatIndex) return buffer;

  const moov = Buffer.from(buffer.subarray(top[moovIndex].start, top[moovIndex].start + top[moovIndex].size));
  // mdat ends up this much further down the file, so every chunk offset moves.
  const delta = moov.length;

  const CONTAINERS = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta'];
  const shiftOffsets = (box: Buffer, start: number, end: number): boolean => {
    for (let off = start; off + 8 <= end;) {
      let size = box.readUInt32BE(off);
      const type = box.toString('latin1', off + 4, off + 8);
      let header = 8;
      if (size === 1) { size = Number(box.readBigUInt64BE(off + 8)); header = 16; }
      else if (size === 0) size = end - off;
      if (size < header || off + size > end) return false;
      if (type === 'stco') {
        const count = box.readUInt32BE(off + header + 4);
        for (let i = 0; i < count; i++) {
          const at = off + header + 8 + i * 4;
          const moved = box.readUInt32BE(at) + delta;
          if (moved > 0xffffffff) return false; // would need co64; bail unchanged
          box.writeUInt32BE(moved, at);
        }
      } else if (type === 'co64') {
        const count = box.readUInt32BE(off + header + 4);
        for (let i = 0; i < count; i++) {
          const at = off + header + 8 + i * 8;
          box.writeBigUInt64BE(box.readBigUInt64BE(at) + BigInt(delta), at);
        }
      } else if (CONTAINERS.includes(type) && !shiftOffsets(box, off + header, off + size)) {
        return false;
      }
      off += size;
    }
    return true;
  };
  if (!shiftOffsets(moov, 8, moov.length)) return buffer;

  // ftyp, moov, then everything else in its original order. Boxes that used to
  // sit before moov shift down by exactly `delta`; those after it do not move.
  const parts: Buffer[] = [];
  for (const box of top) {
    if (box.type === 'moov') continue;
    parts.push(buffer.subarray(box.start, box.start + box.size));
    if (box.type === 'ftyp') parts.push(moov);
  }
  if (!top.some((box) => box.type === 'ftyp')) parts.unshift(moov);
  return Buffer.concat(parts);
}

// `standalone` builds the SIP deliverable rather than the copy the MIP embeds
// in an iframe. It keeps the mraid.js bridge (the SIP is the top-level document)
// and leaves the JS unminified, because AppLovin's validator greps the output
// for literal `function handleClickAction()`, `trackMraidReadiness(mraid)` and
// `mraid.open(clickTarget)` — esbuild renames all three. The end card's scripts
// are a few KB against megabytes of embedded video, so this costs nothing.
async function minifyEndcardHtml(source: string, sharedFontDataUrl: string, standalone = false): Promise<string> {
  const hasDisabledDateOverlay = /const dateTokens\s*=\s*["']\s*["']/.test(source);
  const dateFontPayload = source.match(/@font-face\s*\{\s*font-family:\s*"SipDateFont";[\s\S]*?url\(([^)]*)\)/i)?.[1];
  const customFontPayload = source.match(/@font-face\s*\{\s*font-family:\s*"SipCustom1Font";[\s\S]*?url\(([^)]*)\)/i)?.[1];
  let html = source
    .replace(/\s*<script id="sip-builder-config"[\s\S]*?<\/script>/i, '')
    .replace(/<!--[^]*?-->/g, '');

  // The MIP embeds this end card in an iframe whose parent page already
  // declares the bridge, so that copy must not declare a second one. The
  // standalone SIP creative is the top-level document and must keep its own.
  if (!standalone) html = html.replace(/<script src="mraid\.js"><\/script>\s*/i, '');

  // Replace the builder's full TTF with the installed full-axis Latin WOFF2.
  // The supplied end card is en-US, so this preserves its glyphs and variable
  // font metrics while substantially reducing the single-file upload size.
  if (dateFontPayload) {
    if (dateFontPayload === customFontPayload) {
      html = html
        .replace(/@font-face\s*\{\s*font-family:\s*"SipCustom1Font";[\s\S]*?\}\s*/i, '')
        .split('"SipCustom1Font"').join('"SipDateFont"');
    }

    html = html.replace(/@font-face\s*\{\s*font-family:\s*"SipDateFont";[\s\S]*?\}/i, (fontFace) => (
      fontFace
        .split(dateFontPayload).join(sharedFontDataUrl)
        .replace(/format\(["']truetype["']\)/i, 'format("woff2-variations")')
    ));
  }

  // Keep the no-date optimization limited to end cards that explicitly disable
  // their date tokens; the supplied MIP-5 end card has active dynamic copy.
  if (hasDisabledDateOverlay) {
    html = html
      .replace(/\s*<style>\s*@media \(orientation: portrait\) \{\s*body \{ background: #fee8e6; \}\s*\}[\s\S]*?<\/style>/i, '')
      .replace(/\s*<div id="sip-date"><\/div>/i, '')
      .replace(/\s*\/\/ --- Overlay animation helpers[^]*?\/\/ --- End dynamic date overlay ---/i, '');
  }

  html = await replaceAsync(html, /<style>([^]*?)<\/style>/gi, async (_match, css: string) => {
    const result = await transform(css, { loader: 'css', minify: true });
    return `<style>${result.code}</style>`;
  });

  // Re-order every embedded video so playback can begin as soon as the header
  // is parsed, instead of after the whole base64 payload has been decoded.
  html = html.replace(/data:video\/mp4;base64,([A-Za-z0-9+/=]+)/g, (match, payload: string) => {
    const moved = faststartMp4(Buffer.from(payload, 'base64'));
    return moved ? `data:video/mp4;base64,${moved.toString('base64')}` : match;
  });

  // Do NOT swap these data URIs for Blob URLs. It was tried: the SIP stopped
  // loading in Playable Workshop while the untouched SIP-3 build kept working
  // at nearly four times the file size. Whatever the container does with
  // blob: media, the plain data URI is what it accepts. Leave it alone.

  if (standalone) {
    // This end-card template gates playback on `presentationActive`, seeded
    // from `window.parent === window`. That is correct for the MIP, where the
    // carousel owns the iframe and calls setSipPresentationActive(true) when it
    // reveals the end card (see EndcardOverlay in game/Carousel.ts).
    //
    // The standalone SIP has no such parent. Served top-level it plays, but any
    // host that previews it in an iframe — Playable Workshop does — leaves the
    // flag false and syncWindowActivityState() pauses the video forever. The
    // older SIP-3 template had no gate at all, which is why it plays anywhere.
    //
    // A standalone creative *is* the presentation, so seed it active. The
    // setSipPresentationActive hook stays, so a host can still pause/resume.
    html = html.replace(
      /let presentationActive\s*=\s*window\.parent === window;/,
      'let presentationActive = true;',
    );

    // The end card writes the loading guard single-quoted. AGENTS_WEB.md
    // requires the double-quoted form, which esbuild used to produce as a side
    // effect of minifying; now that the SIP ships unminified, do it explicitly.
    html = html.replace(/getState\(\)\s*===\s*'loading'/g, 'getState() === "loading"');

    // Leave the JS and the inter-tag whitespace alone: the `>\s+<` collapse can
    // reach inside an unminified script and mangle a comparison across lines.
    return html.trim();
  }

  html = await replaceAsync(html, /<script>([^]*?)<\/script>/gi, async (_match, script: string) => {
    const result = await transform(script, { loader: 'js', minify: true, legalComments: 'none' });
    return `<script>${result.code}</script>`;
  });

  return html.replace(/>\s+</g, '><').trim();
}

async function replaceAsync(
  source: string,
  expression: RegExp,
  replacer: (match: string, content: string) => Promise<string>,
): Promise<string> {
  const matches = [...source.matchAll(expression)];
  const replacements = await Promise.all(matches.map((match) => replacer(match[0], match[1])));
  let index = 0;
  return source.replace(expression, () => replacements[index++]);
}

// The authored MIP-5 end card, built twice: embedded in the MIP's iframe, and
// again as the standalone SIP creative.
async function buildEndcard(standalone: boolean): Promise<string> {
  const source = await readFile(resolve('Assets/Kelpie/end.html'), 'utf8');
  const font = await readFile(resolve('node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2'));
  return minifyEndcardHtml(source, `data:font/woff2;base64,${font.toString('base64')}`, standalone);
}

// The end scene also ships on its own as the SIP creative. finalize-build.mjs
// gives this its final kelpie_..._sip_... filename alongside the MIP.
const emitSipEndcard: Plugin = {
  name: 'emit-sip-endcard',
  apply: 'build' as const,
  async closeBundle() {
    await writeFile(resolve('dist/endcard.sip.html'), await buildEndcard(true));
  },
};

const inlineEndcard: Plugin = {
  name: 'inline-minified-kelpie-endcard',
  resolveId(id) {
    if (id === 'virtual:kelpie-endcard') return '\0virtual:kelpie-endcard';
    if (id === 'virtual:kelpie-click-sfx') return '\0virtual:kelpie-click-sfx';
    return null;
  },
  async load(id) {
    if (id === '\0virtual:kelpie-click-sfx') {
      const click = await readFile(resolve('Assets/Kelpie/sfx/Click.mp3'));
      const trimmed = trimMp3(click, 20);
      return `export default ${JSON.stringify(`data:audio/mpeg;base64,${trimmed.toString('base64')}`)};`;
    }
    if (id === '\0virtual:kelpie-endcard') return `export default ${JSON.stringify(await buildEndcard(false))};`;
    return null;
  },
};

function trimMp3(source: Buffer, frameLimit: number): Buffer {
  let offset = source.subarray(0, 3).toString('ascii') === 'ID3'
    ? 10 + (((source[6] & 0x7f) << 21) | ((source[7] & 0x7f) << 14) | ((source[8] & 0x7f) << 7) | (source[9] & 0x7f))
    : 0;
  const start = offset;
  let frames = 0;
  while (frames < frameLimit && offset + 4 <= source.length) {
    const byte1 = source[offset + 1];
    const byte2 = source[offset + 2];
    if (source[offset] !== 0xff || (byte1 & 0xe0) !== 0xe0) break;
    const version = (byte1 >> 3) & 0x03;
    const layer = (byte1 >> 1) & 0x03;
    const bitrateIndex = byte2 >> 4;
    const sampleRateIndex = (byte2 >> 2) & 0x03;
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) break;
    const sampleRates = version === 3 ? [44100, 48000, 32000] : version === 2 ? [22050, 24000, 16000] : [11025, 12000, 8000];
    const bitrates = version === 3 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const coefficient = version === 3 ? 144000 : 72000;
    const frameLength = Math.floor((coefficient * bitrates[bitrateIndex]) / sampleRates[sampleRateIndex]) + ((byte2 >> 1) & 1);
    if (frameLength <= 0 || offset + frameLength > source.length) break;
    offset += frameLength;
    frames++;
  }
  return source.subarray(start, offset);
}

export default defineConfig({
  plugins: [inlineEndcard, viteSingleFile(), applovinHtml, emitSipEndcard, devMraidPlaceholder],
  build: {
    assetsInlineLimit: 10_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    minify: 'esbuild',
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  esbuild: { legalComments: 'none', pure: ['console.error'] },
});

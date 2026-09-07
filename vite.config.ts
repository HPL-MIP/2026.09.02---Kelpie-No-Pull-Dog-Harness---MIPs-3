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
    await writeFile(output, html.replace('<script type="module" crossorigin>', '<script>'));
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

// `standalone` builds the SIP deliverable rather than the copy the MIP embeds
// in an iframe. It keeps the mraid.js bridge (the SIP is the top-level document)
// and leaves the JS unminified, because AppLovin's validator greps the output
// for literal `function handleClickAction()`, `trackMraidReadiness(mraid)` and
// `mraid.open(clickTarget)` — esbuild renames all three. The end card's scripts
// are a few KB against ~2.1 MB of embedded video, so this costs nothing.
async function minifyEndcardHtml(source: string, sharedFontDataUrl: string, standalone = false): Promise<string> {
  const keepMraidBridge = standalone;
  const hasDisabledDateOverlay = /const dateTokens\s*=\s*["']\s*["']/.test(source);
  const dateFontPayload = source.match(/@font-face\s*\{\s*font-family:\s*"SipDateFont";[\s\S]*?url\(([^)]*)\)/i)?.[1];
  const customFontPayload = source.match(/@font-face\s*\{\s*font-family:\s*"SipCustom1Font";[\s\S]*?url\(([^)]*)\)/i)?.[1];
  let html = source
    .replace(/\s*<script id="sip-builder-config"[\s\S]*?<\/script>/i, '')
    .replace(/<!--[^]*?-->/g, '');

  // The MIP embeds this end card in an iframe whose parent page already
  // declares the bridge, so that copy must not declare a second one. The
  // standalone SIP creative is the top-level document and must keep its own.
  if (!keepMraidBridge) html = html.replace(/<script src="mraid\.js"><\/script>\s*/i, '');

  // end.html embeds this exact Bricolage font twice. Both overlays can share
  // SipDateFont, saving the duplicate base64 payload without changing glyphs.
  if (dateFontPayload && dateFontPayload === customFontPayload) {
    html = html
      .replace(/@font-face\s*\{\s*font-family:\s*"SipCustom1Font";[\s\S]*?\}\s*/i, '')
      .split('"SipCustom1Font"').join('"SipDateFont"');
    html = html.replace(/@font-face\s*\{\s*font-family:\s*"SipDateFont";[\s\S]*?\}/i, (fontFace) => (
      fontFace
        .split(dateFontPayload).join(sharedFontDataUrl)
        .replace(/format\(["']truetype["']\)/i, 'format("woff2-variations")')
    ));
  }

  // The previous supplied end card had no date. Keep this optimization only
  // for that shape; end.html has an active dynamic date and custom copy.
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

  if (standalone) {
    // end.html writes the loading guard single-quoted. AGENTS_WEB.md requires
    // the double-quoted form, which esbuild used to produce as a side effect of
    // minifying; now that the SIP ships unminified, normalise it explicitly.
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

async function buildEndcard(keepMraidBridge: boolean): Promise<string> {
  const source = await readFile(resolve('Assets/Kelpie/end.html'), 'utf8');
  const font = await readFile(resolve('node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2'));
  return minifyEndcardHtml(source, `data:font/woff2;base64,${font.toString('base64')}`, keepMraidBridge);
}

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

// The end scene also ships on its own as the SIP creative. finalize-build.mjs
// gives this its final kelpie_..._sip_... filename alongside the MIP.
const emitSipEndcard: Plugin = {
  name: 'emit-sip-endcard',
  apply: 'build' as const,
  async closeBundle() {
    await writeFile(resolve('dist/endcard.sip.html'), await buildEndcard(true));
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

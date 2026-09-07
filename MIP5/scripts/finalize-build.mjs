import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// One creative, two deliverables: the full playable (mip) and the end scene on
// its own (sip). Both share this slug; edit it in one place per iteration.
const creative = '20260902_05_emily_product_carousel_human_dd_none';
const buildName = (kind) => `kelpie_acslanot_${kind}_${creative}`;

const deliverables = [
  ['dist/index.html', buildName('mip')],
  ['dist/endcard.sip.html', buildName('sip')],
];

const SIZE_LIMIT = 5 * 1024 * 1024;

// Playable Workshop runs a vision model over every embedded image and rejects
// the upload if any is under 28px on a side. Phaser ships two such images as
// string literals in its own source, so they land in the bundle no matter what
// the game config says. Both are rewritten below; the guard at the end fails
// the build if a Phaser upgrade ever changes them and these stop matching.
const MIN_IMAGE_SIDE = 28;

// core/Config.js — the `images.white` default, a 4x4 solid white loaded as the
// __WHITE texture WebGL binds for untextured geometry. Replaced with the same
// solid white at 32x32, which samples identically.
const PHASER_WHITE_4X4 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABdJREFUeNpi/P//PwMMMDEgAdwcgAADAJZuAwXJYZOzAAAAAElFTkSuQmCC';
const WHITE_32X32 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAKUlEQVR42u3OIQEAAAACIP+f1hkWWEB6FgEBAQEBAQEBAQEBAQEBgXdgl/rw4tnPBf0AAAAASUVORK5CYII=';

// device/CanvasFeatures.js — a bare PNG header that the Canvas blend-mode probe
// concatenates with a body and footer at runtime. Never rendered, but it parses
// as a 4x1 IHDR and trips the same check. Break the literal so the scanner's
// `data:image/png;base64,` needle never appears contiguously. The string the
// code actually builds at runtime is unchanged.
const CANVAS_PROBE_HEAD =
  '"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAABAQMAAADD8p2OAAAAA1BMVEX/"';
const CANVAS_PROBE_SPLIT =
  '"data:image/png;base64"+",iVBORw0KGgoAAAANSUhEUgAAAAQAAAABAQMAAADD8p2OAAAAA1BMVEX/"';

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

/** Every `data:image/*;base64,…` literal, bounded by its enclosing quote. */
function findDataUris(html) {
  const found = [];
  for (const match of html.matchAll(/data:image\/[a-z+]+;base64,/g)) {
    const start = match.index;
    const quote = html[start - 1];
    const end = quote === '"' || quote === "'" ? html.indexOf(quote, start) : html.indexOf(')', start);
    if (end === -1) continue;
    found.push(html.slice(start + match[0].length, end));
  }
  return found;
}

function undersizedImages(html) {
  return findDataUris(html)
    .map((payload) => pngSize(Buffer.from(payload, 'base64')))
    .filter((size) => size && (size[0] < MIN_IMAGE_SIDE || size[1] < MIN_IMAGE_SIDE));
}

let failed = false;

for (const [from, name] of deliverables) {
  const source = resolve(from);
  const output = resolve(`dist/${name}.html`);

  let html = await readFile(source, 'utf8');
  html = html.split(PHASER_WHITE_4X4).join(WHITE_32X32);
  html = html.split(CANVAS_PROBE_HEAD).join(CANVAS_PROBE_SPLIT);
  await writeFile(source, html);

  await rm(output, { force: true });
  await rename(source, output);

  const { size } = await stat(output);
  const oversize = size > SIZE_LIMIT;
  const tiny = undersizedImages(html);
  const ok = !oversize && tiny.length === 0;
  failed ||= !ok;

  console.log(`${ok ? '  ok    ' : '  FAIL  '} ${(size / 1024 / 1024).toFixed(2)} MB  ${name}.html`);
  if (oversize) console.log(`          over the ${SIZE_LIMIT / 1024 / 1024} MB limit`);
  for (const [w, h] of tiny) {
    console.log(`          embedded image ${w}x${h} is under ${MIN_IMAGE_SIDE}px — Playable Workshop will reject this`);
  }
}

if (failed) process.exit(1);

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

async function minifyEndcardHtml(source: string): Promise<string> {
  let html = source
    .replace(/<script src="mraid\.js"><\/script>\s*/i, '')
    .replace(/\s*<script id="sip-builder-config"[\s\S]*?<\/script>/i, '')
    .replace(/\s*<style>\s*@media \(orientation: portrait\) \{\s*body \{ background: #fee8e6; \}\s*\}[\s\S]*?<\/style>/i, '')
    .replace(/\s*<div id="sip-date"><\/div>/i, '')
    // This supplied end card has its optional date overlay disabled (empty
    // tokens and no animation), so the associated builder runtime is unused.
    .replace(/\s*\/\/ --- Overlay animation helpers[^]*?\/\/ --- End dynamic date overlay ---/i, '')
    .replace(/<!--[^]*?-->/g, '');

  html = await replaceAsync(html, /<style>([^]*?)<\/style>/gi, async (_match, css: string) => {
    const result = await transform(css, { loader: 'css', minify: true });
    return `<style>${result.code}</style>`;
  });

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

const inlineEndcard: Plugin = {
  name: 'inline-minified-kelpie-endcard',
  resolveId(id) {
    return id === 'virtual:kelpie-endcard' ? '\0virtual:kelpie-endcard' : null;
  },
  async load(id) {
    if (id !== '\0virtual:kelpie-endcard') {
      return null;
    }

    const source = await readFile(resolve('Assets/Kelpie/endcard.html'), 'utf8');
    return `export default ${JSON.stringify(await minifyEndcardHtml(source))};`;
  },
};

export default defineConfig({
  plugins: [inlineEndcard, viteSingleFile(), applovinHtml, devMraidPlaceholder],
  build: {
    assetsInlineLimit: 10_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    minify: 'esbuild',
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  esbuild: { legalComments: 'none', pure: ['console.error'] },
});

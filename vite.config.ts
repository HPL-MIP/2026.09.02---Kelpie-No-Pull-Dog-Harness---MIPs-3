import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const applovinHtml = {
  name: 'applovin-classic-script',
  apply: 'build' as const,
  async closeBundle() {
    const output = resolve('dist/index.html');
    const html = await readFile(output, 'utf8');
    await writeFile(output, html.replace('<script type="module" crossorigin>', '<script>'));
  },
};

export default defineConfig({
  plugins: [viteSingleFile(), applovinHtml],
  build: {
    assetsInlineLimit: 10_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    minify: 'esbuild',
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  esbuild: { legalComments: 'none', pure: ['console.error'] },
});

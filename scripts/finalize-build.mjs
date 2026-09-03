import { rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const buildName = 'kelpie_acslanot_sip_20260902_03_ecomm_product_carousel_human_dd_none';
const source = resolve('dist/index.html');
const output = resolve(`dist/${buildName}.html`);

await rm(output, { force: true });
await rename(source, output);

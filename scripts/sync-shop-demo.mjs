#!/usr/bin/env node
// Copies the shared web card renderer + card style into assets/shop-demo/ so the public Demo page
// runs the exact same code as config-core. `--check` fails if the copies drifted (used by tests/CI).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SHOP_DEMO_COPIES = [
  ['config-core/web/widget-blocks.js', 'assets/shop-demo/widget-blocks.js'],
  ['config-core/web/widget-theme.css', 'assets/shop-demo/widget-theme.css'],
  ['config-core/lib/card-style.mjs', 'assets/shop-demo/card-style.mjs'],
];
const check = process.argv.includes('--check');
let drift = 0;
for (const [src, dst] of SHOP_DEMO_COPIES) {
  const want = readFileSync(join(root, src), 'utf8');
  let have = null; try { have = readFileSync(join(root, dst), 'utf8'); } catch {}
  if (have === want) continue;
  if (check) { console.error('out of sync: ' + dst + ' (run node scripts/sync-shop-demo.mjs)'); drift++; }
  else { writeFileSync(join(root, dst), want); console.log('copied ' + dst); }
}
if (drift) process.exit(1);

// Regenerates the template seed block inside db/config-core/10_config_core.sql from
// config-core/lib/templates.mjs, so SQL and JS templates cannot drift. Run: node config-core/build-seed.mjs
// With --check it only verifies the block is up to date (exit 1 otherwise).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TEMPLATES, TEMPLATE_VERSION } from './lib/templates.mjs';

const sqlPath = fileURLToPath(new URL('../db/config-core/10_config_core.sql', import.meta.url));
const BEGIN = '-- BEGIN GENERATED TEMPLATE SEED (node config-core/build-seed.mjs)';
const END = '-- END GENERATED TEMPLATE SEED';
const q = (s) => "'" + String(s).replaceAll("'", "''") + "'";
const rows = Object.entries(TEMPLATES).map(([key, t]) =>
  ` (${q(key)},${TEMPLATE_VERSION},${q(t.name)},${q(t.industry)},${q(JSON.stringify(t.config))}::jsonb)`);
const block = BEGIN + '\nINSERT INTO public.industry_templates(template_key,version,name,industry,config) VALUES\n' + rows.join(',\n') + ';\n' + END;
const sql = readFileSync(sqlPath, 'utf8');
const a = sql.indexOf(BEGIN); const b = sql.indexOf(END);
if (a < 0 || b < a) { console.error('markers missing'); process.exit(2); }
const next = sql.slice(0, a) + block + sql.slice(b + END.length);
if (process.argv.includes('--check')) {
  if (next !== sql) { console.error('SEED_OUT_OF_DATE'); process.exit(1); }
  console.log('SEED_UP_TO_DATE');
} else { writeFileSync(sqlPath, next); console.log('SEED_WRITTEN ' + rows.length); }

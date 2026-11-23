// Prints the shared validator fixtures as JSON lines (name, mode, cfg, codes) for the SQL parity check.
import { FIXTURES } from '../../config-core/test/fixtures.mjs';
for (const f of FIXTURES) console.log(JSON.stringify({ name: f.name, mode: f.mode, cfg: f.cfg, codes: [...f.codes].sort() }));

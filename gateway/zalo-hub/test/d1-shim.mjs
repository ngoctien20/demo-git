// Minimal Cloudflare D1 shim over node:sqlite, so tests run the real SQL of every migrations/*.sql in order.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

export function makeD1() {
  const sqlite = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(f, dir), 'utf8'));
  const norm = (a) => a.map((v) => (v === undefined ? null : v));
  return {
    sqlite,
    prepare(sql) {
      const st = sqlite.prepare(sql);
      return {
        bind(...args) {
          const a = norm(args);
          return {
            first: async () => st.get(...a) ?? null,
            run: async () => { const r = st.run(...a); return { meta: { changes: Number(r.changes) } }; },
            all: async () => ({ results: st.all(...a) }),
          };
        },
      };
    },
  };
}

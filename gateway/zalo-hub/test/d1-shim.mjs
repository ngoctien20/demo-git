// Minimal Cloudflare D1 shim over node:sqlite, so tests run the real SQL of migrations/0001_init.sql.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function makeD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
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

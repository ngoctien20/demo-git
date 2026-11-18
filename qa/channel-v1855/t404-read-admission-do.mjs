/**
 * SOURCE ONLY: Requires a *new* approved SQLite-backed Durable Object namespace.
 * This module is not imported by the deployed V18.5.4 Worker.
 */
import { DurableObject } from 'cloudflare:workers';
import { evaluateReadAdmission } from './read-admission-policy.mjs';

export class T404ReadAdmission extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      'CREATE TABLE IF NOT EXISTS read_admission_state (id INTEGER PRIMARY KEY CHECK(id = 1), json TEXT NOT NULL)'
    );
  }

  // Invoked only through an internal Durable Object binding; no public route.
  async authorizeRead(input) {
    return this.ctx.storage.transactionSync(() => {
      const row = this.sql.exec('SELECT json FROM read_admission_state WHERE id = 1').toArray()[0];
      let state = null;
      if (row) {
        try {
          state = JSON.parse(row.json);
        } catch {
          return { allowed: false, code: 'ADMISSION_STATE_CORRUPTED', status: 503 };
        }
      }
      const verdict = evaluateReadAdmission(state, input, Date.now());
      if (!verdict.allowed) return { allowed: false, code: verdict.code, status: verdict.status };
      this.sql.exec(
        'INSERT INTO read_admission_state (id, json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
        JSON.stringify(verdict.nextState)
      );
      return { allowed: true, code: verdict.code, status: verdict.status, remaining: verdict.remaining };
    });
  }
}

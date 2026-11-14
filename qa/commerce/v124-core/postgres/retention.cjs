'use strict';
// V12.4R customer-core housekeeping port. No scheduled job, no public route.
// Inspect works only with an explicitly supplied read-only DB pool.
// Destructive dry-run validation is confined to a disposable local PostgreSQL QA DB.
const SCHEMA = 'tien404_customer_core_qa';
const MIN_SESSION_RETENTION_MS = 3600000 + 120000;
const MAX_RETENTION_MS = 30 * 24 * 3600000;
const MAX_BATCH = 250;

function createQaRetentionMaintenance({pool, sessionRetentionMs = 86400000,
  receiptGraceMs = 300000, batchSize = 50} = {}) {
  if(typeof pool?.connect !== 'function')throw Error('RETENTION_POOL_REQUIRED');
  if(!Number.isSafeInteger(sessionRetentionMs) || sessionRetentionMs < MIN_SESSION_RETENTION_MS ||
      sessionRetentionMs > MAX_RETENTION_MS ||
      !Number.isSafeInteger(receiptGraceMs) || receiptGraceMs < 120000 || receiptGraceMs > 86400000 ||
      !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH)
    throw Error('RETENTION_POLICY_INVALID');

  const sessionCutoff = `clock_timestamp() - ($1::bigint * interval '1 millisecond')`;
  const receiptCutoff = `clock_timestamp() - ($2::bigint * interval '1 millisecond')`;
  const receiptBatchCutoff = `clock_timestamp() - ($1::bigint * interval '1 millisecond')`;
  async function inspect() {
    const client = await pool.connect();
    try {
      // Read-only transaction; no role, RLS or schema changes.
      await client.query('BEGIN READ ONLY');
      await client.query("SET LOCAL statement_timeout = '2s'");
      const q = await client.query(`SELECT current_database() AS database_name,
       (SELECT count(*)::int FROM ${SCHEMA}.sessions WHERE expires_at < ${sessionCutoff}) AS stale_sessions,
       (SELECT count(*)::int FROM ${SCHEMA}.receipts WHERE expires_at < ${receiptCutoff}) AS stale_receipts`,
        [sessionRetentionMs, receiptGraceMs]);
      await client.query('COMMIT');
      return Object.freeze({mode:'READ_ONLY_RETENTION_INSPECTION',
        staleSessions:q.rows[0].stale_sessions, staleReceipts:q.rows[0].stale_receipts,
        databaseName:q.rows[0].database_name, batchSize,
        sessionRetentionMs, receiptGraceMs});
    } catch (error) {
      await client.query('ROLLBACK').catch(()=>{});
      throw error;
    } finally {client.release();}
  }

  async function sweepDisposableQaOnly() {
    // Triple-fail-closed. Do not remove this guard without a separate reviewed release.
    if(process.env.TIEN404_EPHEMERAL_PG !== 'yes' ||
       process.env.PGHOST !== '127.0.0.1' ||
       process.env.PGDATABASE !== 'tien404_core_ephemeral')
      throw Error('RETENTION_LIVE_DELETE_FORBIDDEN');
    const client = await pool.connect();
    let broken=false;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await client.query("SET LOCAL statement_timeout = '3s'");
      const database = await client.query('SELECT current_database() AS db');
      if(database.rows[0]?.db !== 'tien404_core_ephemeral')throw Error('RETENTION_WRONG_DATABASE');
      const oldSessions = await client.query(`
        WITH candidates AS (
          SELECT tenant_key,store_key,channel,bot_key,actor_hash
            FROM ${SCHEMA}.sessions
           WHERE expires_at < ${sessionCutoff}
           ORDER BY expires_at
           LIMIT $2 FOR UPDATE SKIP LOCKED
        )
        DELETE FROM ${SCHEMA}.sessions s USING candidates c
         WHERE (s.tenant_key,s.store_key,s.channel,s.bot_key,s.actor_hash)=
               (c.tenant_key,c.store_key,c.channel,c.bot_key,c.actor_hash)
         RETURNING 1`,[sessionRetentionMs,batchSize]);
      const oldReceipts = await client.query(`
        WITH candidates AS (
          SELECT tenant_key,store_key,channel,bot_key,actor_hash,receipt_hash
            FROM ${SCHEMA}.receipts
           WHERE expires_at < ${receiptBatchCutoff}
           ORDER BY expires_at
           LIMIT $2 FOR UPDATE SKIP LOCKED
        )
        DELETE FROM ${SCHEMA}.receipts r USING candidates c
         WHERE (r.tenant_key,r.store_key,r.channel,r.bot_key,r.actor_hash,r.receipt_hash)=
               (c.tenant_key,c.store_key,c.channel,c.bot_key,c.actor_hash,c.receipt_hash)
         RETURNING 1`,[receiptGraceMs,batchSize]);
      await client.query('COMMIT');
      return Object.freeze({mode:'DISPOSABLE_PG_QA_ONLY',deletedSessions:oldSessions.rowCount,
        deletedReceipts:oldReceipts.rowCount,batchSize,
        // Do not return scope, actor hashes, or any customer fields.
        didCallModel:false,didSendChannel:false});
    } catch (error) {
      try {await client.query('ROLLBACK');}catch{broken=true;}
      throw error;
    } finally {client.release(broken);}
  }
  return Object.freeze({inspect,sweepDisposableQaOnly,mode:'NOT_SCHEDULED_QA_CANDIDATE'});
}
module.exports={createQaRetentionMaintenance};

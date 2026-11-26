/**
 * TIEN404 V17.21 — SOURCE-ONLY SQLite Durable Object replay claim v2.
 * Separate V2 schema/class; DO NOT alter the deployed V17.5E.2 ReplayBucket.
 * No network, provider send, orders, Store authority, secrets or webhook reads.
 * Call only after an authenticated, server-resolved Zalo Bot installation.
 *
 * SQLite-backed Durable Object sql.exec is synchronous. This function has no
 * await between clean/insert/read. UNIQUE(event_key) serializes claims in one
 * namespace; separate installations must route to deterministic distinct DOs.
 */
export const ZALO_REPLAY_V2_SCHEMA='zalo_bot_replay_claims_v2';
export const MAX_REPLAY_TTL_MS=86_400_000;
export const BOUNDED_GC_PER_CALL=32;
const HEX64=/^[0-9a-f]{64}$/;
const TABLE=ZALO_REPLAY_V2_SCHEMA;
const CREATE_TABLE='CREATE TABLE IF NOT EXISTS '+TABLE+' (event_key TEXT NOT NULL PRIMARY KEY,payload_digest TEXT NOT NULL,expires_at_ms INTEGER NOT NULL,created_at_ms INTEGER NOT NULL)';
const CREATE_EXPIRY_INDEX='CREATE INDEX IF NOT EXISTS zalo_bot_replay_v2_exp ON '+TABLE+'(expires_at_ms)';
const REMOVE_EXPIRED_KEY='DELETE FROM '+TABLE+' WHERE event_key=? AND expires_at_ms<=?';
const GC_BOUNDED='DELETE FROM '+TABLE+' WHERE event_key IN (SELECT event_key FROM '+TABLE+' WHERE expires_at_ms<=? ORDER BY expires_at_ms ASC LIMIT 32)';
const INSERT_ATOMIC='INSERT INTO '+TABLE+' (event_key,payload_digest,expires_at_ms,created_at_ms) VALUES (?,?,?,?) ON CONFLICT(event_key) DO NOTHING RETURNING event_key';
const GET_EXISTING='SELECT payload_digest,expires_at_ms FROM '+TABLE+' WHERE event_key=? LIMIT 1';
function requireSql(sql){
 if(typeof sql?.exec!=='function')throw Error('SQLITE_BACKEND_UNAVAILABLE');
}
export function initReplayV2Schema(sql){
 requireSql(sql);
 sql.exec(CREATE_TABLE);
 sql.exec(CREATE_EXPIRY_INDEX);
}
/**
 * Returns exactly one of CLAIMED / DUPLICATE / CONFLICT.
 * Throws on bad input or backend failure; upstream V17.20 fail-closes.
 * Input event_key and payload_digest are HMAC-SHA256 hex; no PII is persisted.
 * expiresAtMs must be in (now, now + 24h] based on SERVER time.
 */
export function claimReplayV2(sql,{key,digest,expiresAtMs},nowMs){
 requireSql(sql);
 if(typeof key!=='string'||!HEX64.test(key)||typeof digest!=='string'||!HEX64.test(digest))
  throw Error('HASHED_REPLAY_KEYS_REQUIRED');
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(expiresAtMs)||
    expiresAtMs<=nowMs||expiresAtMs>nowMs+MAX_REPLAY_TTL_MS)
  throw Error('INVALID_REPLAY_TTL');
 // Bounded expired housekeeping. The same event's expired row may be reclaimed.
 // All calls are synchronous; never await network or other storage here.
 sql.exec(REMOVE_EXPIRED_KEY,key,nowMs);
 sql.exec(GC_BOUNDED,nowMs);
 const inserted=sql.exec(INSERT_ATOMIC,key,digest,expiresAtMs,nowMs).toArray();
 if(inserted.length===1)return 'CLAIMED';
 if(inserted.length!==0)throw Error('SQLITE_INSERT_CARDINALITY');
 const rows=sql.exec(GET_EXISTING,key).toArray();
 if(rows.length!==1)throw Error('SQLITE_READ_AFTER_CONFLICT_FAILED');
 if(rows[0].expires_at_ms<=nowMs)throw Error('SQLITE_EXPIRED_CONFLICT');
 return rows[0].payload_digest===digest?'DUPLICATE':'CONFLICT';
}

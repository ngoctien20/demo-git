/* TIEN404 Zalo Hub — D1 data access. All SQL lives here. `db` is a Cloudflare D1 binding (env.ZH_DB). */
const COLS = 'id, store_id, status, bot_id, bot_name, token_sealed, token_last4, key_version, path_id, wh_secret_hash, forward_url, forward_key_sealed, inbound_key_sealed, flow_mode, pairing_code_hash, pairing_expires_at, pairing_attempts, owner_chat_id, owner_user_id, owner_epoch, sent_month, sent_count, connected_at, revoked_at, last_ok_at, updated_at';

export const byPath = (db, pathId) => db.prepare(`SELECT ${COLS} FROM zh_connections WHERE path_id = ?`).bind(pathId).first();
export const byId = (db, id) => db.prepare(`SELECT ${COLS} FROM zh_connections WHERE id = ?`).bind(id).first();
export const liveByBot = (db, botId) => db.prepare(`SELECT ${COLS} FROM zh_connections WHERE bot_id = ? AND status <> 'revoked'`).bind(botId).first();
export const liveByStore = (db, storeId) => db.prepare(`SELECT ${COLS} FROM zh_connections WHERE store_id = ? AND status <> 'revoked'`).bind(storeId).first();
export async function listByStore(db, storeId) {
  const r = await db.prepare(`SELECT ${COLS} FROM zh_connections WHERE store_id = ? ORDER BY connected_at DESC`).bind(storeId).all();
  return (r && r.results) || [];
}

export function insert(db, c) {
  return db.prepare(`INSERT INTO zh_connections (id, store_id, status, bot_id, bot_name, token_sealed, token_last4, key_version, path_id, wh_secret_hash, forward_url, forward_key_sealed, inbound_key_sealed, flow_mode, pairing_code_hash, pairing_expires_at, pairing_attempts, owner_chat_id, sent_month, sent_count, connected_at, revoked_at, last_ok_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, 0, ?, NULL, NULL, ?)`)
    .bind(c.id, c.store_id, c.status, c.bot_id, c.bot_name, c.token_sealed, c.token_last4, c.key_version, c.path_id, c.wh_secret_hash, c.forward_url, c.forward_key_sealed, c.inbound_key_sealed, c.flow_mode || 'own', c.pairing_code_hash, c.pairing_expires_at, c.connected_at, c.connected_at)
    .run();
}
export const hardDelete = (db, id) => db.prepare('DELETE FROM zh_connections WHERE id = ?').bind(id).run();

export const setStatus = (db, id, status, now) =>
  db.prepare('UPDATE zh_connections SET status = ?, updated_at = ? WHERE id = ? AND status <> \'revoked\'').bind(status, now, id).run();

export const activateOwner = (db, id, ownerChatId, ownerUserId, codeHash, now) =>
  db.prepare("UPDATE zh_connections SET status = 'active', owner_chat_id = ?, owner_user_id = ?, pairing_code_hash = NULL, pairing_expires_at = NULL, pairing_attempts = 0, last_ok_at = ?, updated_at = ? WHERE id = ? AND status = 'pending_owner' AND pairing_code_hash = ? AND pairing_expires_at >= ? AND pairing_attempts < 5")
    .bind(ownerChatId, ownerUserId, now, now, id, codeHash, now).run();

export const bumpPairingAttempts = (db, id, codeHash, now) =>
  db.prepare("UPDATE zh_connections SET pairing_attempts = pairing_attempts + 1, updated_at = ? WHERE id = ? AND status = 'pending_owner' AND pairing_code_hash = ? AND pairing_attempts < 5").bind(now, id, codeHash).run();

export const setPairing = (db, id, codeHash, expiresAt, now) =>
  db.prepare("UPDATE zh_connections SET pairing_code_hash = ?, pairing_expires_at = ?, pairing_attempts = 0, status = 'pending_owner', owner_chat_id = NULL, owner_user_id = NULL, owner_epoch = owner_epoch + 1, updated_at = ? WHERE id = ? AND status <> 'revoked'")
    .bind(codeHash, expiresAt, now, id).run();

/** Revoke wipes every secret; the row stays for audit. */
export const revoke = (db, id, now) =>
  db.prepare("UPDATE zh_connections SET status = 'revoked', token_sealed = NULL, forward_key_sealed = NULL, inbound_key_sealed = NULL, pairing_code_hash = NULL, pairing_expires_at = NULL, revoked_at = ?, updated_at = ? WHERE id = ?")
    .bind(now, now, id).run();

/** Replace both per-shop keys (old ones stop working at once). */
export const setKeys = (db, id, forwardSealed, inboundSealed, now) =>
  db.prepare("UPDATE zh_connections SET forward_key_sealed = ?, inbound_key_sealed = ?, updated_at = ? WHERE id = ? AND status <> 'revoked'")
    .bind(forwardSealed, inboundSealed, now, id).run();

/** Atomically count one outbound message in the current month; returns the new count. */
export async function countSend(db, id, month, now) {
  await db.prepare('UPDATE zh_connections SET sent_count = CASE WHEN sent_month = ? THEN sent_count + 1 ELSE 1 END, sent_month = ?, last_ok_at = ?, updated_at = ? WHERE id = ?')
    .bind(month, month, now, now, id).run();
  const r = await db.prepare('SELECT sent_count FROM zh_connections WHERE id = ?').bind(id).first();
  return r ? Number(r.sent_count) : 0;
}

/** Reserve a send before the provider call: concurrent replies cannot exceed the cap.
 * The slot stays reserved on an uncertain network result (no automatic retry).
 * Customer replies also require the same catalog revision seen during generation.
 */
export async function reserveLiteSend(db, c, month, cap, now, revision = null) {
  const customerGate = revision === null ? '' : ` AND COALESCE((SELECT revision FROM zh_lite_catalog WHERE connection_id = ? AND store_id = ? AND owner_epoch = ?), 0) = ?`;
  const args = [month, month, now, c.id, c.store_id, c.owner_chat_id, c.owner_user_id ?? null, c.owner_epoch, month, cap];
  if (revision !== null) args.push(c.id, c.store_id, c.owner_epoch, revision);
  const res = await db.prepare(`UPDATE zh_connections SET sent_count = CASE WHEN sent_month = ? THEN sent_count + 1 ELSE 1 END, sent_month = ?, updated_at = ?
    WHERE id = ? AND store_id = ? AND status = 'active' AND owner_chat_id = ? AND owner_user_id IS ? AND owner_epoch = ?
    AND (sent_month IS NULL OR sent_month <> ? OR sent_count < ?)${customerGate}`).bind(...args).run();
  return res?.meta?.changes === 1;
}

export const liteCatalogRevision = (db, c) => db.prepare('SELECT revision FROM zh_lite_catalog WHERE connection_id = ? AND store_id = ? AND owner_epoch = ?').bind(c.id, c.store_id, c.owner_epoch).first().then(r => Number(r?.revision || 0));
export const recordLiteDelivery = (db, id, messageId, outcome, now) => db.prepare('INSERT INTO zh_lite_delivery(connection_id,message_id,outcome,observed_at) VALUES(?,?,?,?) ON CONFLICT(connection_id,message_id) DO UPDATE SET outcome=excluded.outcome,observed_at=excluded.observed_at').bind(id,messageId,outcome,now).run();
export const lastLiteDelivery = (db, id) => db.prepare('SELECT outcome,observed_at FROM zh_lite_delivery WHERE connection_id = ? ORDER BY observed_at DESC LIMIT 1').bind(id).first();

/** true when this is the first time we see (connection, message_id). */
export async function claimInbound(db, connectionId, messageId, now) {
  const r = await db.prepare('INSERT OR IGNORE INTO zh_inbound_seen (connection_id, message_id, seen_at) VALUES (?, ?, ?)').bind(connectionId, messageId, now).run();
  return !!(r && r.meta && r.meta.changes === 1);
}
export const pruneInbound = (db, before) => db.prepare('DELETE FROM zh_inbound_seen WHERE seen_at < ?').bind(before).run();

export const rememberUser = (db, connectionId, userId, now) =>
  db.prepare('INSERT OR IGNORE INTO zh_seen_users (connection_id, user_id, first_seen_at) VALUES (?, ?, ?)').bind(connectionId, userId, now).run();
export const rememberChat = (db, connectionId, chatId, now) =>
  db.prepare('INSERT OR IGNORE INTO zh_seen_chats (connection_id, chat_id, first_seen_at) VALUES (?, ?, ?)').bind(connectionId, chatId, now).run();
export async function isKnownChat(db, connectionId, chatId) {
  return !!(await db.prepare('SELECT 1 AS ok FROM zh_seen_chats WHERE connection_id = ? AND chat_id = ?').bind(connectionId,chatId).first());
}
export async function isKnownUser(db, connectionId, userId) {
  return !!(await db.prepare('SELECT 1 AS ok FROM zh_seen_users WHERE connection_id = ? AND user_id = ?').bind(connectionId, userId).first());
}
export async function countUsers(db, connectionId) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM zh_seen_users WHERE connection_id = ?').bind(connectionId).first();
  return r ? Number(r.n) : 0;
}

/** Count one Lite reply for (day, user); returns the new count. */
export async function bumpLiteReply(db, day, userId) {
  await db.prepare('INSERT INTO zh_lite_replies (day, zalo_user_id, n) VALUES (?, ?, 1) ON CONFLICT(day, zalo_user_id) DO UPDATE SET n = n + 1').bind(day, userId).run();
  const r = await db.prepare('SELECT n FROM zh_lite_replies WHERE day = ? AND zalo_user_id = ?').bind(day, userId).first();
  return r ? Number(r.n) : 0;
}

'use strict';
const {isVerifiedCustomer} = require('./ingress.cjs');

const sessions = 'tien404_customer_core_qa.sessions';
const receipts = 'tien404_customer_core_qa.receipts';
const fields = 'tenant_key,store_key,channel,bot_key,actor_hash';
const placeholders = '$1,$2,$3,$4,$5';
const where = '('+fields+')=('+placeholders+')';

function createPostgresCustomerSessions({poolForContext, ttlMs=1800000, windowMs=60000, maxTurns=8}={}) {
  if (typeof poolForContext !== 'function' || !Number.isSafeInteger(ttlMs) || ttlMs<1 || ttlMs>1800000 ||
      !Number.isSafeInteger(windowMs) || windowMs<1 || windowMs>3600000 ||
      !Number.isSafeInteger(maxTurns) || maxTurns<1 || maxTurns>100) throw Error('SESSION_POLICY_INVALID');

  return Object.freeze({async process(context, plan) {
    if (!isVerifiedCustomer(context)) throw Error('SESSION_SCOPE_DENIED');
    const key=[context.tenantId,context.storeId,context.channel,context.botRef,context.actorHash];
    const db = await poolForContext(context).connect();
    let broken = false;
    try {
      await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await db.query("SET LOCAL statement_timeout = '3s'");
      await db.query("SET LOCAL idle_in_transaction_session_timeout = '6s'");
      await db.query(`INSERT INTO ${sessions} (${fields}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,key);
      const locked = await db.query(`SELECT phase,sku,quantity,revision,expires_at,rate_until,turn_count,last_event_at
        FROM ${sessions} WHERE ${where} FOR UPDATE`,key);
      if (locked.rowCount!==1) throw Error('SESSION_SCOPE_DENIED');
      const {rows:[{now}]} = await db.query('SELECT clock_timestamp() AS now');
      const row = locked.rows[0], receiptKey = [...key,context.receiptHash];
      // Every worker holds the same row lock before inspecting receipt, checking quota, or applying a turn.
      await db.query(`DELETE FROM ${receipts} WHERE ${where} AND expires_at <= $6`,[...key,now]);
      const seen = await db.query(`SELECT 1 FROM ${receipts} WHERE ${where} AND receipt_hash=$6`,receiptKey);
      if (seen.rowCount) {await db.query('COMMIT'); return {status:'DUPLICATE_BLOCKED'};}
      const newWindow = !(row.rate_until > now);
      if (!newWindow && row.turn_count >= maxTurns) {await db.query('COMMIT'); return {status:'RATE_LIMITED'};}
      await db.query(`INSERT INTO ${receipts} (${fields},receipt_hash,expires_at)
        VALUES (${placeholders},$6,$7)`,[...receiptKey,new Date(now.getTime()+3600000)]);
      const rateUntil = newWindow ? new Date(now.getTime()+windowMs) : row.rate_until;
      const used = newWindow ? 1 : row.turn_count+1;
      if (row.last_event_at && context.issuedAt < row.last_event_at.getTime()) {
        // A late unique event consumes quota too, without extending the session or reviving a cancelled quote.
        await db.query(`UPDATE ${sessions} SET rate_until=$6,turn_count=$7 WHERE ${where}`,[...key,rateUntil,used]);
        await db.query('COMMIT'); return {status:'OLDER_EVENT_IGNORED'};
      }
      let prior = {phase:row.phase,sku:row.sku,quantity:row.quantity};
      if (!(row.expires_at > now)) prior = {phase:Number(row.revision) ? 'EXPIRED' : 'NEW',sku:null,quantity:null};
      const {reply,next} = await plan(prior,db);
      const changed = await db.query(`UPDATE ${sessions} SET phase=$6,sku=$7,quantity=$8,
        revision=revision+1,expires_at=$9,rate_until=$10,turn_count=$11,last_event_at=$12 WHERE ${where}`,
        [...key,next.phase,next.sku,next.quantity,new Date(now.getTime()+ttlMs),
         rateUntil,used,new Date(context.issuedAt)]);
      if (changed.rowCount!==1) throw Error('SESSION_SCOPE_DENIED');
      await db.query('COMMIT');
      return {reply};
    } catch (error) {
      try {await db.query('ROLLBACK');} catch {broken=true;}
      throw error;
    } finally {db.release(broken);}
  }});
}
module.exports = {createPostgresCustomerSessions};

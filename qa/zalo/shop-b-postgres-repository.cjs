'use strict';
// TIEN404 V12.2 Postgres adapter candidate for private QA session service.
// NOT DEPLOYED. Requires reviewed migration V12_2_SHOP_B_PRIVATE_SESSIONS_REVIEW_ONLY.sql.
// Instantiate server-side ONLY with trusted Owner binding supplied by authenticated resolver.
const crypto=require('node:crypto');
const PREFIX='tien404_dialogue_private';
const bad=(reason)=>{const e=new Error(reason);e.code=reason;throw e;};
const asMillis=(date)=>date instanceof Date?date.getTime():Date.parse(date);
const int=(x)=>Number.isSafeInteger(x)||typeof x==='string'&&/^\d+$/.test(x);
const sql=Object.freeze({
  binding: \`SELECT b.status,b.expires_at,b.confirmed_challenge_id,b.recipient_ref,c.status AS claim_status,
    c.recipient_ref AS claim_recipient_ref,s.enabled_mode,s.identity_status
    FROM tien404_r1_qa.owner_bindings b
    JOIN tien404_r1_qa.owner_pairing_claims_v3 c ON
      (b.tenant_key,b.store_key,b.bot_key,b.confirmed_challenge_id)=
      (c.tenant_key,c.store_key,c.bot_key,c.challenge_id)
    JOIN tien404_r1_qa.shop_bots s ON
      (s.tenant_key,s.store_key,s.bot_key)=(b.tenant_key,b.store_key,b.bot_key)
    WHERE (b.tenant_key,b.store_key,b.bot_key)=($1,$2,$3) FOR SHARE OF b,c,s\`,
  insertSession: \`INSERT INTO \${PREFIX}.shop_b_sessions
    (scope_key,tenant_key,store_key,bot_key,binding_fingerprint,expires_at)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT(scope_key) DO NOTHING\`,
  getSession: \`SELECT * FROM \${PREFIX}.shop_b_sessions
    WHERE scope_key=$1 FOR UPDATE\`,
  catalog: \`SELECT tenant_key,store_key,bot_key,sku,product_name,price_vnd,stock
    FROM tien404_r1_qa.catalog
    WHERE (tenant_key,store_key,bot_key,sku)=($1,$2,$3,$4) FOR SHARE\`,
  receiptExists: \`SELECT 1 FROM \${PREFIX}.shop_b_receipts
    WHERE scope_key=$1 AND event_hash=$2 LIMIT 1\`,
  updateSession: \`UPDATE \${PREFIX}.shop_b_sessions SET phase=$2,sku=$3,quantity=$4,
    expected_total_vnd=$5,confirmation_hash=$6,quote_expires_at=$7,
    order_key=$8,idempotency_key=$9,session_ref=$10,expires_at=$11,
    revision=revision+1,updated_at=now()
    WHERE scope_key=$1 AND revision=$12 RETURNING revision\`,
  writeReceipt: \`INSERT INTO \${PREFIX}.shop_b_receipts(scope_key,event_hash)
    VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING event_hash\`
});
function makePostgresQARepository({pool,owner,clock=Date.now}){
  if(!pool||typeof pool.connect!=='function')bad('PG_POOL_REQUIRED');
  if(!owner||owner.source!=='VERIFIED_BACKEND_BINDING'||owner.server_verified!==true||
    owner.tenant_key!=='qa-tenant-b'||owner.store_key!=='qa-store-b'||
    owner.bot_key!=='qa-bot-b'||owner.binding_status!=='paired'||
    owner.owner_claim_status!=='CONFIRMED'||owner.owner_recipient_matches!==true||
    !owner.binding_challenge_id||!owner.recipient_fingerprint||
    !owner.binding_fingerprint||!owner.expires_at)bad('TRUSTED_OWNER_REQUIRED');
  return {
    transact:async(scope,handler)=>{
      if(!/^[a-f0-9]{64}$/.test(scope||'')||typeof handler!=='function')
        bad('SCOPE_OR_HANDLER_INVALID');
      const client=await pool.connect();let begun=false;
      try{
        await client.query('BEGIN');begun=true;
        const verified=await client.query(sql.binding,
          [owner.tenant_key,owner.store_key,owner.bot_key]);
        const b=verified.rows?.[0];
        if(verified.rows?.length!==1||!b||b.status!=='paired'||b.claim_status!=='CONFIRMED'||
           b.recipient_ref!==b.claim_recipient_ref||
           b.recipient_ref!==owner.recipient_fingerprint||
           String(b.confirmed_challenge_id)!==String(owner.binding_challenge_id)||
           b.enabled_mode!=='dry_run'||b.identity_status!=='synthetic_qa'||
           !Number.isFinite(asMillis(b.expires_at))||asMillis(b.expires_at)<=clock())
           bad('BINDING_DB_REVALIDATION_FAILED');
        const safeExpiry=Math.min(asMillis(b.expires_at),asMillis(owner.expires_at));
        if(!Number.isFinite(safeExpiry)||safeExpiry<=clock())bad('OWNER_EXPIRED');
        await client.query(sql.insertSession,[
          scope,owner.tenant_key,owner.store_key,owner.bot_key,
          owner.binding_fingerprint,new Date(safeExpiry)]);
        const old=await client.query(sql.getSession,[scope]);
        if(old.rows?.length!==1)bad('SESSION_LOCK_NOT_OBTAINED');
        const row=old.rows[0];let revision=Number(row.revision);
        if(!Number.isSafeInteger(revision)||revision<0||
           row.tenant_key!==owner.tenant_key||row.store_key!==owner.store_key||
           row.bot_key!==owner.bot_key||row.binding_fingerprint!==owner.binding_fingerprint)
           bad('SESSION_SCOPE_OR_REVISION_INVALID');
        const tx={
          getState:async()=>({
            version:2,binding_fingerprint:row.binding_fingerprint,
            phase:row.phase,sku:row.sku||null,
            quantity:row.quantity===null?null:Number(row.quantity),
            expected_total_vnd:row.expected_total_vnd===null?null:Number(row.expected_total_vnd),
            confirmation_hash:row.confirmation_hash||null,
            quote_expires_at:row.quote_expires_at===null?null:asMillis(row.quote_expires_at),
            order_key:row.order_key||null,idempotency_key:row.idempotency_key||null,
            session_ref:row.session_ref||null,expires_at:asMillis(row.expires_at)
          }),
          getCatalog:async(keys)=>{
            if(keys.tenant_key!==owner.tenant_key||keys.store_key!==owner.store_key||
               keys.bot_key!==owner.bot_key||keys.sku!=='F01')
              bad('CATALOG_SCOPE_DENIED');
            const r=await client.query(sql.catalog,[
              owner.tenant_key,owner.store_key,owner.bot_key,'F01']);
            if(r.rows?.length!==1)bad('CATALOG_READBACK_MISSING');
            const p=r.rows[0];
            return {...p,price_vnd:Number(p.price_vnd),stock:Number(p.stock),
              source:'VERIFIED_DB_READBACK'};
          },
          hasReceipt:async(eventHash)=>{
            if(!/^[a-f0-9]{64}$/.test(eventHash||''))bad('EVENT_HASH_INVALID');
            const r=await client.query(sql.receiptExists,[scope,eventHash]);
            return !!r.rows?.length;
          },
          saveState:async(state)=>{
            if(state.binding_fingerprint!==owner.binding_fingerprint||
               !Number.isFinite(state.expires_at))bad('STATE_OWNER_SCOPE_INVALID');
            const r=await client.query(sql.updateSession,[
              scope,state.phase,state.sku,state.quantity,state.expected_total_vnd,
              state.confirmation_hash,state.quote_expires_at?new Date(state.quote_expires_at):null,
              state.order_key,state.idempotency_key,state.session_ref,
              new Date(state.expires_at),revision
            ]);
            if(r.rows?.length!==1)bad('SESSION_CAS_CONFLICT');
            revision=Number(r.rows[0].revision);
          },
          markReceipt:async(eventHash)=>{
            const r=await client.query(sql.writeReceipt,[scope,eventHash]);
            if(r.rows?.length!==1)bad('EVENT_REPLAY_CONFLICT');
          }
        };
        const result=await handler(tx);
        await client.query('COMMIT');begun=false;
        return result;
      } catch(err){
        if(begun)try{await client.query('ROLLBACK');}catch(_){}
        throw err;
      } finally {client.release();}
    }
  };
}
module.exports={makePostgresQARepository,sql};

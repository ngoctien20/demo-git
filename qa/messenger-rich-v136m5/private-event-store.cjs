'use strict';
/**
 * TIEN404 V13.6M.5 — private Messenger event store TRANSACTION CONTRACT.
 *
 * SOURCE-ONLY. This is a model of future PostgreSQL atomic claims, not a DB
 * connection or a production worker. Mode is default BLOCKED; ONLY a caller-
 * supplied OFFLINE synthetic transactional driver is accepted. The table
 * does not exist in Supabase staging. No Meta Send, outbox or order writes.
 *
 * Trust order: exact webhook HMAC -> canonical private Page/Store resolver ->
 * active entitlement -> derive scoped event key -> atomic unique claim.
 * This module does not independently verify Meta signatures or authorizations.
 */
const {createHmac,randomUUID} = require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE=/^[0-9]{5,30}$/;
const HASH=/^[a-f0-9]{64}$/;
const fail=code=>{const e=new Error(code);e.code=code;throw e};
const TABLE='app_private.messenger_event_claims';
const CLAIM_SQL=[
 'INSERT INTO app_private.messenger_event_claims',
 '(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash,',
 ' status,lease_id,claimed_at,expires_at)',
 "VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,'CLAIMED',$7::uuid,$8::timestamptz,$9::timestamptz)",
 'ON CONFLICT (tenant_id,store_id,page_id,sender_hash,binding_version,event_hash)',
 'DO NOTHING',
 'RETURNING lease_id::text AS lease_id,status'
].join(' ');
const FINALIZE_SQL=[
 'UPDATE app_private.messenger_event_claims',
 'SET status=$8,completed_at=$9::timestamptz',
 'WHERE tenant_id=$1::uuid AND store_id=$2::uuid',
 ' AND page_id=$3 AND sender_hash=$4 AND binding_version=$5 AND event_hash=$6',
 " AND lease_id=$7::uuid AND status='CLAIMED'",
 'RETURNING lease_id::text AS lease_id,status'
].join(' ');
const SQL=Object.freeze({claim:CLAIM_SQL,finalize:FINALIZE_SQL});
function assertProof(p){
 if(!p||p.source!=='SERVER_VERIFIED_MESSENGER_BINDING'||
   p.serverDerived!==true||p.verified!==true||
   !UUID.test(p.tenantId||'')||!UUID.test(p.storeId||'')||
   !PAGE.test(p.pageId||'')||!PAGE.test(p.recipientPsid||'')||
   !Number.isSafeInteger(p.bindingVersion)||p.bindingVersion<1)
  fail('PRIVATE_EVENT_SCOPE_UNVERIFIED');
 return p;
}
function assertKey(s){
 if(typeof s!=='string'||Buffer.byteLength(s,'utf8')<32)
  fail('PRIVATE_EVENT_HMAC_KEY_REQUIRED');
}
function deriveIdentity({trusted,replayKey,secret}={}){
 const p=assertProof(trusted);
 if(!HASH.test(replayKey||''))fail('PRIVATE_EVENT_REPLAY_KEY_INVALID');
 assertKey(secret);
 // Domain separation prevents use of sender hash as a token and prevents a
 // plain SHA256 PSID rainbow lookup. NEVER store raw PSID / webhook body.
 const digest=(domain,input)=>createHmac('sha256',secret)
  .update(domain+'\0'+input).digest('hex');
 const senderHash=digest('tien404/messenger/sender/v1',
   [p.tenantId,p.storeId,p.pageId,p.recipientPsid].join('|'));
 const eventHash=digest('tien404/messenger/event/v1',replayKey);
 return Object.freeze({
  tenantId:p.tenantId,storeId:p.storeId,pageId:p.pageId,
  bindingVersion:p.bindingVersion,senderHash,eventHash,
  hashVersion:1
 });
}
function assertDriver(driver){
 if(!driver||driver.synthetic!==true||driver.externalWrites!==false||
  driver.profile!=='SYNTHETIC_PRIVATE_PG_TRANSACTION_MODEL'||
  typeof driver.transaction!=='function')
  fail('PRIVATE_EVENT_DRIVER_NOT_APPROVED');
}
function rowCount(r){
 if(!r||!Array.isArray(r.rows)||r.rows.length>1)
   fail('PRIVATE_EVENT_DB_RESPONSE_UNVERIFIED');
 return r.rows.length;
}
/** Test-only SQL contract. Critical: PostgreSQL readiness needs a real
 * non-BYPASSRLS DB role, UNIQUE constraint and hosted transaction tests.
 */
function createPrivateEventStoreCandidate({
 mode='BLOCKED',driver,secret,now=Date.now,retentionMs=7*86400000
}={}){
 if(mode!=='SYNTHETIC_SQL_QA_ONLY')fail('PRIVATE_EVENT_HOSTED_NOT_APPROVED');
 assertDriver(driver);assertKey(secret);
 if(typeof now!=='function'||!Number.isSafeInteger(retentionMs)||
    retentionMs<86400000||retentionMs>30*86400000)
   fail('PRIVATE_EVENT_RETENTION_INVALID');
 const pending=new WeakMap();
 function identityFor(input){return deriveIdentity({trusted:input.trusted,replayKey:input.replayKey,secret})}
 async function claim(input){
  const i=identityFor(input),time=now();
  if(!Number.isSafeInteger(time)||time<1||!Number.isSafeInteger(time+retentionMs))
   fail('PRIVATE_EVENT_CLOCK_INVALID');
  const lease=randomUUID();
  const values=[i.tenantId,i.storeId,i.pageId,i.senderHash,i.bindingVersion,
    i.eventHash,lease,new Date(time).toISOString(),new Date(time+retentionMs).toISOString()];
  const response=await driver.transaction(async tx=>{
   if(!tx||typeof tx.query!=='function')fail('PRIVATE_EVENT_TRANSACTION_REQUIRED');
   return tx.query(SQL.claim,values);
  });
  const count=rowCount(response);
  if(count===0)return Object.freeze({status:'DUPLICATE_SUPPRESSED',
    firstSeen:false,previewOnly:true,providerSendEnabled:false,
    durable:false,hostedReady:false});
  if(response.rows[0].lease_id!==lease||response.rows[0].status!=='CLAIMED')
   fail('PRIVATE_EVENT_CLAIM_RESPONSE_INVALID');
  // Keep lease token private on server. Never return PSID or raw payload.
  const receipt={identity:i,lease};
  const result=Object.freeze({status:'CLAIMED',firstSeen:true,
    previewOnly:true,providerSendEnabled:false,durable:false,hostedReady:false});
  pending.set(result,receipt);
  return result;
 }
 async function finalize(receipt,{status='PREVIEW_READY'}={}){
  if(status!=='PREVIEW_READY'&&status!=='REJECTED')
   fail('PRIVATE_EVENT_FINAL_STATUS_DENIED');
  const state=receipt&&pending.get(receipt);
  if(!state)fail('PRIVATE_EVENT_LEASE_NOT_ISSUED');
  const i=state.identity,time=now();
  if(!Number.isSafeInteger(time)||time<1)fail('PRIVATE_EVENT_CLOCK_INVALID');
  const values=[i.tenantId,i.storeId,i.pageId,i.senderHash,i.bindingVersion,
    i.eventHash,state.lease,status,new Date(time).toISOString()];
  const response=await driver.transaction(async tx=>{
   if(!tx||typeof tx.query!=='function')fail('PRIVATE_EVENT_TRANSACTION_REQUIRED');
   return tx.query(SQL.finalize,values);
  });
  if(rowCount(response)!==1||
    response.rows[0].lease_id!==state.lease||
    response.rows[0].status!==status)fail('PRIVATE_EVENT_FINALIZE_CONFLICT');
  pending.delete(receipt);
  return Object.freeze({status,previewOnly:true,
   sendEnabled:false,orderWritesEnabled:false,durable:false});
 }
 // Bridge into V13.6M.4 source-only "DRY_RUN" replay port.
 async function replayCheck(scope){
  if(!scope||scope.mode!=='DRY_RUN')fail('PRIVATE_EVENT_DRY_RUN_REQUIRED');
  const trusted={
   source:'SERVER_VERIFIED_MESSENGER_BINDING',serverDerived:true,verified:true,
   tenantId:scope.tenantId,storeId:scope.storeId,
   pageId:scope.pageId,recipientPsid:scope.senderPsid,
   bindingVersion:scope.bindingVersion
  };
  const claimed=await claim({trusted,replayKey:scope.replayKey});
  return Object.freeze({mode:'DRY_RUN',firstSeen:claimed.firstSeen,
    externalWriteOccurred:false,providerSendEnabled:false,
    durableReplayReady:false});
 }
 return Object.freeze({
  claim,finalize,replayCheck,
  readiness:Object.freeze({mode:'SYNTHETIC_SQL_QA_ONLY',
    backedByPostgres:false,privateSchemaApproved:false,
    hostedRlsVerified:false,atomicPgVerified:false,
    durableReplayReady:false,outboxEnabled:false,
    allowOrderWrites:false,providerSendEnabled:false})
 });
}
module.exports={deriveIdentity,createPrivateEventStoreCandidate,SQL,TABLE};

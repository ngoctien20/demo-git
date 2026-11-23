'use strict';
/**
 * TIEN404 V21 — private opaque reference + signed operator session bridge.
 * SOURCE ONLY. NO LIVE AUTH, META SEND, hosted DB or customer writes.
 *
 * Browser request: signed ephemeral session token + opaque 32-char ref + an
 * allowlisted REVIEW decision and idempotency UUID (for review writes only).
 * No tenant, store, Page, actor role, raw plan id or lease from the browser.
 *
 * The signing authority is external to this module. HMAC validity is necessary
 * but NEVER sufficient: every SQL read and journal append also re-checks the
 * private current session, SUBJECT, CURRENT_USER DB role, active Page/store
 * grant, expiry/revocation, and reference-to-plan mapping in a single statement.
 * The mapping is created privately at plan creation by a trusted future
 * backend. It is NOT a bearer access token or an authorization grant.
 *
 * This bridge uses only an injected synthetic transaction driver. It does not
 * issue sessions, create mappings, connect to a DB or send/provider-retry.
 */
const {createHmac,timingSafeEqual,randomUUID}=require('node:crypto');
const {SQL:baseSQL,classify}=require('./message-reconciliation-inspector.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF=/^[a-f0-9]{32}$/;
const MAC=/^[a-f0-9]{64}$/;
const SESSION_MAX_MS=15*60*1000;
const DECISIONS=Object.freeze(['REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER','ACKNOWLEDGE_NO_SEND']);
const fail=code=>{const error=new Error(code);error.code=code;throw error;};
const where='WHERE p.tenant_id=$1::uuid AND p.store_id=$2::uuid AND p.page_id=$3';
if(!baseSQL.snapshot.includes(where)||typeof classify!=='function')
 fail('OPAQUE_SESSION_INSPECTOR_CONTRACT_DRIFT');
// The SQL binds scope ONLY by private session registry and CURRENT_USER. It
// does not use a caller-supplied tenant/store/Page or a client-supplied role.
const scopeFromSession=[
 'JOIN app_private.messenger_operator_sessions os',
 'ON os.id=$2::uuid AND os.db_role=CURRENT_USER::name',
 'AND os.active AND os.expires_at>transaction_timestamp()',
 'JOIN app_private.messenger_operator_grants g',
 'ON g.db_role=os.db_role AND g.subject_user_id=os.subject_user_id',
 'AND g.tenant_id=os.tenant_id AND g.store_id=os.store_id',
 'AND g.page_id=os.page_id AND g.active',
 'AND g.valid_until>transaction_timestamp()',
 'WHERE rr.reference=$1 AND rr.tenant_id=p.tenant_id',
 'AND rr.store_id=p.store_id AND rr.page_id=p.page_id',
 'AND rr.plan_id=p.id AND os.tenant_id=p.tenant_id',
 'AND os.store_id=p.store_id AND os.page_id=p.page_id'
].join(' ');
const VIEW_SQL=baseSQL.snapshot.replace(where,[
 'WHERE EXISTS (SELECT 1 FROM app_private.messenger_reconciliation_refs rr',
 scopeFromSession,')'
].join(' ')).replace('COUNT(sp.part_no)', 'COUNT(sp.part_no)');
// Parameters $1/$2 are now opaque reference + session UUID, not scope/clock.
// The server clock cutoff is $3. A scope is resolved from the private session.
const VIEW_SQL_FINAL=VIEW_SQL.replace(
 'AND (sp.attempted_at IS NULL OR sp.attempted_at <= $4::timestamptz)',
 'AND (sp.attempted_at IS NULL OR sp.attempted_at <= $3::timestamptz)'
);
const APPEND_SQL=[
 'INSERT INTO app_private.messenger_review_events',
 '(id,plan_id,tenant_id,store_id,page_id,operator_session_id,actor_db_role,access_role,decision_code,request_digest,created_at)',
 'SELECT $3::uuid,p.id,p.tenant_id,p.store_id,p.page_id,os.id,CURRENT_USER::name,g.access_role,$4,$5,transaction_timestamp()',
 'FROM app_private.messenger_reconciliation_refs rr',
 'JOIN app_private.messenger_send_plans p ON p.id=rr.plan_id',
 'AND p.tenant_id=rr.tenant_id AND p.store_id=rr.store_id AND p.page_id=rr.page_id',
 'JOIN app_private.messenger_operator_sessions os',
 'ON os.id=$2::uuid AND os.db_role=CURRENT_USER::name',
 'AND os.active AND os.expires_at>transaction_timestamp()',
 'JOIN app_private.messenger_operator_grants g ON g.db_role=os.db_role',
 'AND g.subject_user_id=os.subject_user_id',
 'AND g.tenant_id=os.tenant_id AND g.store_id=os.store_id',
 'AND g.page_id=os.page_id AND g.active',
 'AND g.valid_until>transaction_timestamp()',
 'WHERE rr.reference=$1 AND rr.tenant_id=os.tenant_id',
 'AND rr.store_id=os.store_id AND rr.page_id=os.page_id',
 "AND ((g.access_role='OWNER' AND $4 IN ('REQUEST_PROVIDER_REVIEW',",
 "'ESCALATE_TO_OWNER','ACKNOWLEDGE_NO_SEND'))",
 "OR (g.access_role='MANAGER' AND $4 IN ('REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER')))",
 'ON CONFLICT (plan_id,request_digest) DO NOTHING',
 'RETURNING id::text AS review_id,decision_code'
].join(' ');
const SQL=Object.freeze({readOnly:baseSQL.readOnly,view:VIEW_SQL_FINAL,append:APPEND_SQL});
function verifyToken(token,secret,time){
 if(typeof token!=='string'||token.length>160)
  fail('OPAQUE_OPERATOR_SESSION_NOT_AUTHENTICATED');
 const items=token.split('.');
 if(items.length!==4||items[0]!=='v1'||!UUID.test(items[1])||
    !/^[1-9][0-9]{11,13}$/.test(items[2])||!MAC.test(items[3]))
  fail('OPAQUE_OPERATOR_SESSION_NOT_AUTHENTICATED');
 const expiry=Number(items[2]);
 if(!Number.isSafeInteger(expiry)||expiry<=time||expiry-time>SESSION_MAX_MS)
  fail('OPAQUE_OPERATOR_SESSION_NOT_AUTHENTICATED');
 const expected=createHmac('sha256',secret)
  .update('tien404/messenger/operator/session/v1\0'+items[1]+'|'+items[2])
  .digest();
 const given=Buffer.from(items[3],'hex');
 if(given.length!==expected.length||!timingSafeEqual(given,expected))
  fail('OPAQUE_OPERATOR_SESSION_NOT_AUTHENTICATED');
 return items[1]; // server-private ID passed only to scoped PG driver
}
function createPrivateOpaqueSessionBridgeCandidate({
 mode='BLOCKED',driver,sessionSecret,requestSecret,now=Date.now,
 staleAfterMs=300000
}={}){
 if(mode!=='SYNTHETIC_SQL_QA_ONLY')fail('OPAQUE_BRIDGE_HOSTED_NOT_APPROVED');
 if(!driver||driver.synthetic!==true||driver.externalWrites!==false||
    driver.rollbackOnThrow!==true||driver.journalOnly!==true||
    driver.profile!=='SYNTHETIC_OPAQUE_OPERATOR_SESSION_PG_TX'||
    typeof driver.transaction!=='function')
  fail('OPAQUE_BRIDGE_DRIVER_NOT_APPROVED');
 if(typeof sessionSecret!=='string'||Buffer.byteLength(sessionSecret,'utf8')<32||
    typeof requestSecret!=='string'||Buffer.byteLength(requestSecret,'utf8')<32)
  fail('OPAQUE_BRIDGE_HMAC_KEYS_REQUIRED');
 if(typeof now!=='function'||!Number.isSafeInteger(staleAfterMs)||
    staleAfterMs<60000||staleAfterMs>86400000)
  fail('OPAQUE_BRIDGE_CLOCK_INVALID');
 function validated(token,reference){
  const t=now();
  if(!Number.isSafeInteger(t)||t<staleAfterMs)fail('OPAQUE_BRIDGE_CLOCK_INVALID');
  const sessionId=verifyToken(token,sessionSecret,t);
  if(typeof reference!=='string'||!REF.test(reference))
   fail('OPAQUE_BRIDGE_REFERENCE_INVALID');
  return {sessionId,reference,cutoff:new Date(t-staleAfterMs).toISOString()};
 }
 async function view({sessionToken,reference}={}){
  const {sessionId,reference:ref,cutoff}=validated(sessionToken,reference);
  const rows=await driver.transaction(async tx=>{
   if(!tx||typeof tx.query!=='function')fail('OPAQUE_BRIDGE_SQL_PORT_REQUIRED');
   const ro=await tx.query(SQL.readOnly,[]);
   if(!ro||!Array.isArray(ro.rows))fail('OPAQUE_BRIDGE_RO_GUARD_REQUIRED');
   const out=await tx.query(SQL.view,[ref,sessionId,cutoff]);
   if(!out||!Array.isArray(out.rows)||out.rows.length>1)
    fail('OPAQUE_BRIDGE_SQL_RESULT_INVALID');
   return out.rows;
  });
  if(rows.length!==1)return Object.freeze({
   status:'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD',sendAllowed:false,retryAllowed:false
  });
  return Object.freeze({status:'PRIVATE_REVIEW_PREVIEW_ONLY',reference:ref,
   ...classify(rows[0]),sendAllowed:false,retryAllowed:false,
   realMetaAccepted:false,delivered:false,read:false,
   hostedIdentityVerified:false});
 }
 async function record({sessionToken,reference,decision,requestId}={}){
  const {sessionId,reference:ref}=validated(sessionToken,reference);
  if(!DECISIONS.includes(decision))fail('OPAQUE_BRIDGE_DECISION_NOT_ALLOWED');
  if(!UUID.test(requestId||''))fail('OPAQUE_BRIDGE_IDEMPOTENCY_REQUIRED');
  const digest=createHmac('sha256',requestSecret)
   .update('tien404/messenger/opaque-review/idempotency/v1\0'+requestId+'|'+ref)
   .digest('hex');
  const id=randomUUID();
  const result=await driver.transaction(async tx=>{
   if(!tx||typeof tx.query!=='function')fail('OPAQUE_BRIDGE_SQL_PORT_REQUIRED');
   return tx.query(SQL.append,[ref,sessionId,id,decision,digest]);
  });
  if(!result||!Array.isArray(result.rows)||result.rows.length>1)
   fail('OPAQUE_BRIDGE_APPEND_RESULT_INVALID');
  if(result.rows.length===0)return Object.freeze({
   status:'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD',
   sendAllowed:false,retryAllowed:false,ledgerMutated:false
  });
  if(result.rows[0].review_id!==id||result.rows[0].decision_code!==decision)
   fail('OPAQUE_BRIDGE_APPEND_RESULT_INVALID');
  return Object.freeze({status:'PRIVATE_REVIEW_JOURNALED_MOCK',
   reference:ref,sendAllowed:false,retryAllowed:false,ledgerMutated:false,
   providerAccepted:false});
 }
 return Object.freeze({view,record,SQL,readiness:Object.freeze({
  mode:'SYNTHETIC_SQL_QA_ONLY',hostedReady:false,
  realOperatorSessionAuthorityWired:false,privateReferenceMappingDeployed:false,
  realOwnerAppWired:false,realMetaSendEnabled:false,automaticRetryEnabled:false,
  hostedDataMutationsEnabled:false,disposableJournalWritesOnly:true
 })});
}
module.exports={SQL,createPrivateOpaqueSessionBridgeCandidate};

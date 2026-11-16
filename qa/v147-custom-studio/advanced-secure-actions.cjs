'use strict';
/* V15.2 ADV.3 — DISPOSABLE-QA-ONLY HMAC signed action receipt.
 * Never deploy as a live verifier: memory ledger is NON-DURABLE, auth contexts are
 * synthetic assertions, and all production side effects are hard-disabled.
 * Real release requires server-verified JWT/Store RLS, consent & atomic DB replay.
 */
const {createHmac,randomBytes,timingSafeEqual}=require('node:crypto');
const CHANNELS=Object.freeze(['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']);
const ACTIONS=Object.freeze({
 VIEW_CATALOG:Object.freeze({roles:['CUSTOMER','OWNER','MANAGER','STAFF'],sensitive:false,write:false}),
 REQUEST_QUOTE:Object.freeze({roles:['CUSTOMER','OWNER','MANAGER','STAFF'],sensitive:false,write:false}),
 ORDER_REQUEST_DRAFT:Object.freeze({roles:['CUSTOMER','OWNER','MANAGER'],sensitive:true,write:true}),
 TRACK_ORDER:Object.freeze({roles:['CUSTOMER','OWNER','MANAGER'],sensitive:true,write:false}),
 ASK_STAFF:Object.freeze({roles:['CUSTOMER','OWNER','MANAGER','STAFF'],sensitive:false,write:false}),
 VIEW_POLICY:Object.freeze({roles:['CUSTOMER','OWNER','MANAGER','STAFF'],sensitive:false,write:false}),
 OPEN_VERIFIED_LINK:Object.freeze({roles:['CUSTOMER','OWNER','MANAGER','STAFF'],sensitive:false,write:false})
});
const MAX_TTL_MS=120000, HEADER='eyJhbGciOiJIUzI1NiIsInR5cCI6IlQ0MDQtUUEtQUNUSU9OIiwidiI6MX0';
const FIELDS=['v','aud','tenantId','storeId','channel','actorId','sessionId','role','action',
 'resourceId','issuedAt','expiresAt','nonce'];
const deny=code=>{throw Error(code)};
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_:.\-]{0,95}$/.test(v);
function assertContext(ctx){
 if(!ctx||typeof ctx!=='object'||Array.isArray(ctx))deny('QA_CONTEXT_REQUIRED');
 for(const field of ['tenantId','storeId','actorId','sessionId'])if(!id(ctx[field]))deny('QA_SCOPE_INVALID');
 if(!CHANNELS.includes(ctx.channel))deny('QA_CHANNEL_INVALID');
 if(!['CUSTOMER','OWNER','MANAGER','STAFF'].includes(ctx.role))deny('QA_ROLE_DENIED');
 for(const field of ['identityVerified','membershipActive','channelBindingVerified','consentActive',
  'entitlementActive'])
  if(ctx[field]!==true)deny('QA_AUTH_CONTEXT_NOT_CERTIFIED');
 if(ctx.role==='CUSTOMER'&&ctx.customerStoreLinkVerified!==true)deny('QA_CUSTOMER_STORE_LINK_REQUIRED');
 if(ctx.role!=='CUSTOMER'&&ctx.ownerOrStaffRoleVerified!==true)deny('QA_MERCHANT_ROLE_REQUIRED');
}
function assertAction(action,resourceId,ctx){
 if(!Object.hasOwn(ACTIONS,action))deny('ACTION_NOT_ALLOWLISTED');
 if(!ACTIONS[action].roles.includes(ctx.role))deny('ACTION_ROLE_DENIED');
 if(!id(resourceId))deny('RESOURCE_REFERENCE_INVALID'); // ID only, never URL/PII
 if(action==='TRACK_ORDER'){
  if(ctx.authorizedOrderId!==resourceId||ctx.authorizedOrderStoreId!==ctx.storeId)
   deny('ORDER_RESOURCE_SCOPE_REQUIRED');
  if(ctx.role==='CUSTOMER'&&ctx.orderOwnershipVerified!==true)
   deny('CUSTOMER_ORDER_OWNERSHIP_REQUIRED');
 }
 if(action==='ORDER_REQUEST_DRAFT'){
  if(ctx.explicitCustomerConfirmation!==true)deny('CUSTOMER_CONFIRMATION_REQUIRED');
  if(ctx.confirmedDraftId!==resourceId)deny('CONFIRMED_DRAFT_SCOPE_REQUIRED');
 }
 if(action==='OPEN_VERIFIED_LINK'){
  if(ctx.approvedLinkRegistryMatch!==true)deny('VERIFIED_LINK_REGISTRY_REQUIRED');
  if(ctx.approvedLinkRef!==resourceId)deny('APPROVED_LINK_RESOURCE_SCOPE_REQUIRED');
 }
}
function canonical(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))deny('QA_PAYLOAD_INVALID');
 const keys=Object.keys(payload).sort();
 if(keys.length!==FIELDS.length||!FIELDS.slice().sort().every((x,i)=>x===keys[i]))deny('QA_TOKEN_FIELDS_INVALID');
 return JSON.stringify(Object.fromEntries(FIELDS.map(k=>[k,payload[k]])));
}
function decodeStrict(segment){
 if(typeof segment!=='string'||!segment||!/^[A-Za-z0-9_-]+$/.test(segment))
  deny('QA_TOKEN_ENCODING_INVALID');
 const decoded=Buffer.from(segment,'base64url');
 if(decoded.toString('base64url')!==segment)deny('QA_TOKEN_NONCANONICAL_ENCODING');
 return decoded;
}
function makeQaRegistry({key,now=Date.now,maxSeen=1024}={}){
 if(!Buffer.isBuffer(key)||key.length<32)deny('QA_EPHEMERAL_KEY_REQUIRED');
 if(typeof now!=='function')deny('QA_CLOCK_REQUIRED');
 if(!Number.isSafeInteger(maxSeen)||maxSeen<1||maxSeen>100000)deny('QA_REPLAY_CAP_INVALID');
 const secret=Buffer.from(key); // caller injects random ephemeral key; never persisted/logged
 const seen=new Map();
 function time(){const t=now();if(!Number.isSafeInteger(t)||t<0)deny('QA_CLOCK_INVALID');return t}
 function mac(str){return createHmac('sha256',secret).update(str).digest()}
 function issueQa({context,action,resourceId,ttlMs=60000}={}){
  assertContext(context);assertAction(action,resourceId,context);
  if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>MAX_TTL_MS)deny('QA_TTL_DENIED');
  const issuedAt=time();
  const payload={v:1,aud:'TIEN404_ADV3_DISPOSABLE_QA_ONLY',tenantId:context.tenantId,
   storeId:context.storeId,channel:context.channel,actorId:context.actorId,
   sessionId:context.sessionId,role:context.role,action,resourceId,issuedAt,
   expiresAt:issuedAt+ttlMs,nonce:randomBytes(16).toString('hex')};
  const body=Buffer.from(canonical(payload),'utf8').toString('base64url');
  const data=HEADER+'.'+body;
  return {token:data+'.'+mac(data).toString('base64url'),
   scope:'DISPOSABLE_QA_ONLY',canExecute:false,action,expiresAt:payload.expiresAt};
 }
 function inspectAndConsumeQa({token,context}={}){
  // Every simulated click must be reauthenticated from CURRENT server-side QA state.
  assertContext(context);
  if(typeof token!=='string'||token.length>2048||token.length<30)deny('QA_TOKEN_SIZE_INVALID');
  const parts=token.split('.');
  if(parts.length!==3||parts[0]!==HEADER)deny('QA_TOKEN_HEADER_INVALID');
  const supplied=decodeStrict(parts[2]),expected=mac(parts[0]+'.'+parts[1]);
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))
   deny('QA_SIGNATURE_INVALID');
  let payload;
  try{payload=JSON.parse(decodeStrict(parts[1]).toString('utf8'))}catch{deny('QA_TOKEN_JSON_INVALID')}
  canonical(payload);
  if(payload.v!==1||payload.aud!=='TIEN404_ADV3_DISPOSABLE_QA_ONLY')deny('QA_AUDIENCE_DENIED');
  for(const field of ['tenantId','storeId','channel','actorId','sessionId','role'])
   if(payload[field]!==context[field])deny('QA_ACTOR_SCOPE_MISMATCH');
  assertAction(payload.action,payload.resourceId,context);
  if(!id(payload.nonce)||!Number.isSafeInteger(payload.issuedAt)||
   !Number.isSafeInteger(payload.expiresAt))deny('QA_TIMESTAMP_INVALID');
  const t=time();
  if(payload.issuedAt>t+5000||payload.issuedAt>payload.expiresAt||
   payload.expiresAt-payload.issuedAt>MAX_TTL_MS||t>=payload.expiresAt)
   deny('QA_TOKEN_EXPIRED_OR_FUTURE');
  for(const [nonce,until] of seen)if(until<=t)seen.delete(nonce);
  const replayKey=payload.tenantId+':'+payload.storeId+':'+payload.nonce;
  if(seen.has(replayKey))deny('QA_REPLAY_DENIED');
  if(seen.size>=maxSeen)deny('QA_REPLAY_LEDGER_FULL'); // fail closed, no silent eviction
  seen.set(replayKey,payload.expiresAt);
  return Object.freeze({validatedInDisposableQa:true,productionAuthorized:false,
   canExecute:false,channel:payload.channel,tenantId:payload.tenantId,storeId:payload.storeId,
   action:payload.action,resourceId:payload.resourceId,replayConsumed:true,
   durableReplayCertified:false});
 }
 function execute(){deny('NO_SIDE_EFFECTS_IN_QA_REGISTRY')}
 function inspect(){return Object.freeze({scope:'DISPOSABLE_QA_ONLY',ledgerSize:seen.size,
  usesPersistentReplay:false,providerSends:0,orderWrites:0,productionAuthorized:false});}
 return Object.freeze({issueQa,inspectAndConsumeQa,execute,inspect});
}
module.exports=Object.freeze({ACTIONS,CHANNELS,MAX_TTL_MS,makeQaRegistry,assertContext});
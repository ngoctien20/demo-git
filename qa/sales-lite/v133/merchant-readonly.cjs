'use strict';
// TIEN404 V13.3 — server-side read-only contract. No credentials or DB writes.
// Ports are injected by an authenticated backend, never by browser input.
const ALLOWED_STATES=new Set(['ACTIVE','EXPIRING','EXPIRED','SUSPENDED','PAYMENT_PENDING','UNKNOWN']);
const BOT_STATES=new Set(['CONNECTED','DISCONNECTED','VERIFYING','PAUSED','UNAVAILABLE','UNKNOWN']);
const PAIR_STATES=new Set(['VERIFIED','PENDING','UNKNOWN']);
const STAFF_STORE_ROLES=new Set(['owner','manager']);
const fail=(code)=>{const e=new Error(code);e.code=code;throw e;};
function safeId(v){return typeof v==='string'&&v.length>=4&&v.length<=160&&/^[a-zA-Z0-9:_-]+$/.test(v);}
function clean(v,max=120){return typeof v==='string'?v.slice(0,max).replace(/[<>]/g,''):null;}
function date(v){return typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;}
function httpsLink(v){if(typeof v!=='string'||v.length>1500)return null;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.toString():null;}catch{return null;}}
function normalizedMembership(row,userId){return row&&row.userId===userId&&row.active===true&&STAFF_STORE_ROLES.has(row.role)&&safeId(row.tenantId)&&safeId(row.storeId);}
function requirePort(x,n){if(typeof x!=='function')fail('PORT_'+n+'_NOT_CONNECTED');}
function createMerchantReadOnlyService({verifySession,listMemberships,readTenant,readSubscription,readBot,clock=Date.now}={}){
 for(const [n,port] of Object.entries({verifySession,listMemberships,readTenant,readSubscription,readBot}))requirePort(port,n);
 async function resolve(request){
  if(request?.method!=='GET')fail('METHOD_NOT_ALLOWED');
  let session;
  try{session=await verifySession(request);}catch{fail('UNAUTHENTICATED');}
  if(!session||session.serverVerified!==true||!safeId(session.userId)||!date(session.expiresAt)||Date.parse(session.expiresAt)<=clock())fail('UNAUTHENTICATED');
  let memberships;
  try{memberships=await listMemberships({userId:session.userId});}catch{fail('MEMBERSHIP_UNAVAILABLE');}
  if(!Array.isArray(memberships))fail('MEMBERSHIP_UNAVAILABLE');
  const allowed=memberships.filter(m=>normalizedMembership(m,session.userId));
  if(!allowed.length)fail('MEMBERSHIP_DENIED');
  // A multi-store selection may be provided only by server-validated session, never request query.
  const chosen=allowed.length===1?allowed[0]:
    session.selectedTenantId&&session.selectedStoreId?allowed.find(m=>m.tenantId===session.selectedTenantId&&m.storeId===session.selectedStoreId):null;
  if(!chosen)fail('SERVER_SHOP_SELECTION_REQUIRED');
  const scope=Object.freeze({tenantId:chosen.tenantId,storeId:chosen.storeId,userId:session.userId});
  let shop,subscription,bot;
  try{
   [shop,subscription,bot]=await Promise.all([readTenant(scope),readSubscription(scope),readBot(scope)]);
  }catch{fail('BACKEND_UNAVAILABLE');}
  if(!shop||shop.tenantId!==scope.tenantId||shop.storeId!==scope.storeId||shop.verified!==true)fail('SCOPE_UNVERIFIED');
  // Read ports MUST echo scope even when they return unavailable/UNKNOWN.
  for(const item of [subscription,bot])if(!item||item.verified!==true||item.tenantId!==scope.tenantId||item.storeId!==scope.storeId)fail('SCOPE_UNVERIFIED');
  const subState=ALLOWED_STATES.has(subscription.state)?subscription.state:'UNKNOWN';
  const botState=BOT_STATES.has(bot.connectionState)?bot.connectionState:'UNKNOWN';
  const ownerPair=PAIR_STATES.has(bot.ownerPairing)?bot.ownerPairing:'UNKNOWN';
  const fullyVerifiedBot=botState==='CONNECTED'&&bot.bindingVerified===true;
  const safeVerifiedLink=fullyVerifiedBot?httpsLink(bot.verifiedLink):null;
  const safeVerifiedQr=fullyVerifiedBot?httpsLink(bot.verifiedQrUrl):null;
  return Object.freeze({
   contract_version:'1.0.0',source:'SERVER_VERIFIED',
   account:Object.freeze({display_name:clean(session.displayName)||'Tài khoản TIEN404',session_expires_at:date(session.expiresAt)}),
   shop:Object.freeze({id:scope.storeId,name:clean(shop.name)||'Cửa hàng',membership_role:chosen.role.toUpperCase()}),
   subscription:Object.freeze({state:subState,plan_name:clean(subscription.planName),starts_at:date(subscription.startsAt),expires_at:date(subscription.expiresAt),
     limits:null}),
   bot:Object.freeze({connection_state:botState,verified_name:fullyVerifiedBot?clean(bot.name):null,
     owner_pairing:ownerPair,verified_link:safeVerifiedLink,verified_qr_url:safeVerifiedQr}),
   generated_at:new Date(clock()).toISOString()
  });
 }
 async function handle(request){
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'};
  try{return {status:200,headers,body:await resolve(request)};}
  catch(error){
   const code=error?.code;
   const status=code==='METHOD_NOT_ALLOWED'?405:code==='UNAUTHENTICATED'?401:code==='MEMBERSHIP_DENIED'?403:code==='SERVER_SHOP_SELECTION_REQUIRED'?409:503;
   return {status,headers,body:{error:status===401?'UNAUTHENTICATED':status===403?'FORBIDDEN':status===405?'METHOD_NOT_ALLOWED':status===409?'SHOP_SELECTION_REQUIRED':'SERVICE_UNAVAILABLE'}};
  }
 }
 return Object.freeze({resolve,handle,mode:'SERVER_PORTS_REQUIRED',writeEnabled:false,sendEnabled:false});
}
module.exports={createMerchantReadOnlyService,httpsLink};

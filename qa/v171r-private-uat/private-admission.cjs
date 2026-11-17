'use strict';
// TIEN404 V17.1Q -- source-only security admission, NOT a deployed webhook.
// Host MUST supply privately authenticated JWKs, installation records,
// managed secrets, session/owner checks, and atomic replay reservation.
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID=/^[A-Za-z0-9_:\-.]{1,128}$/;
function deny(reason){return Object.freeze({ok:false,reason});}
function isString(x,max=256){return typeof x==='string'&&x.length>0&&x.length<=max;}
function decodeB64url(s,max=8192){
 if(!isString(s,max)||!/^[A-Za-z0-9_-]+$/.test(s))throw new Error('BAD_ENCODING');
 const b=Buffer.from(s,'base64url');
 if(b.length>max||b.toString('base64url')!==s)throw new Error('BAD_ENCODING');
 return b;
}
function strictJsonBytes(buf,max=8192){
 if(!Buffer.isBuffer(buf)||buf.length===0||buf.length>max)throw new Error('BAD_BODY');
 const parsed=JSON.parse(buf.toString('utf8'));
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('BAD_OBJECT');
 return parsed;
}
function isDateNumber(x){return Number.isSafeInteger(x)&&x>0;}
function secureHexCompare(expected,header,prefix){
 if(!isString(header,90)||!header.startsWith(prefix))return false;
 const raw=header.slice(prefix.length);
 if(!/^[a-fA-F0-9]{64}$/.test(raw))return false;
 const proposed=Buffer.from(raw,'hex');
 return proposed.length===expected.length&&crypto.timingSafeEqual(proposed,expected);
}
function nativeJwtVerify(token,jwks,issuer,audience,nowSeconds){
 if(!isString(token,8192)||typeof jwks!=='object'||!jwks||
    !isString(issuer,300)||!isString(audience,150))return deny('JWT_INPUT');
 const parts=token.split('.');
 if(parts.length!==3)return deny('JWT_FORMAT');
 let header,claims,sig;
 try{
  header=JSON.parse(decodeB64url(parts[0],1024).toString('utf8'));
  claims=JSON.parse(decodeB64url(parts[1],4096).toString('utf8'));
  sig=decodeB64url(parts[2],1024);
 }catch{return deny('JWT_PARSE');}
 if(!header||typeof header!=='object'||Array.isArray(header)||
    !claims||typeof claims!=='object'||Array.isArray(claims)||
    !['RS256','ES256'].includes(header.alg)||!isString(header.kid,128)||
    header.crit!==undefined||header.jku!==undefined||header.x5u!==undefined||
    (header.typ!==undefined&&header.typ!=='JWT'))return deny('JWT_HEADER');
 const keys=Array.isArray(jwks.keys)?jwks.keys:[];
 const matchingKeys=keys.filter(k=>k&&k.kid===header.kid);
 if(matchingKeys.length!==1)return deny('JWT_KEY_AMBIGUOUS');
 const key=matchingKeys[0];
 if(!key||key.d!==undefined||key.kty!==(header.alg==='RS256'?'RSA':'EC')||
    (header.alg==='ES256'&&key.crv!=='P-256')||
    (key.alg&&key.alg!==header.alg)||(key.use&&key.use!=='sig'))
    return deny('JWT_KEY');
 let verified=false;
 try{
  const publicKey=crypto.createPublicKey({key,format:'jwk'});
  const data=Buffer.from(parts[0]+'.'+parts[1],'ascii');
  verified=crypto.verify('sha256',data,
    header.alg==='ES256'?{key:publicKey,dsaEncoding:'ieee-p1363'}:publicKey,sig);
 }catch{return deny('JWT_KEY_VERIFY');}
 if(!verified)return deny('JWT_SIGNATURE');
 if(claims.iss!==issuer||
   !(claims.aud===audience||(Array.isArray(claims.aud)&&claims.aud.includes(audience)))||
   claims.role!=='authenticated'||!UUID.test(String(claims.sub||''))||
   !UUID.test(String(claims.session_id||'')))return deny('JWT_SUBJECT');
 if(!isDateNumber(claims.iat)||!isDateNumber(claims.exp)||
   (claims.nbf!==undefined&&!isDateNumber(claims.nbf))||
   claims.exp<=nowSeconds-30||claims.iat>nowSeconds+30||
   (claims.nbf!==undefined&&claims.nbf>nowSeconds+30)||
   claims.exp<=claims.iat||claims.exp-claims.iat>3600)return deny('JWT_TIME');
 return {ok:true,subject:claims.sub,sessionId:claims.session_id};
}
function createPrivateAdmissionGate(opts){
 const {jwks,issuer,audience='authenticated',lookupSession,lookupOwnerStore,
   lookupInstallation,getProviderSecret,reserveReplayOnce,
   lookupCustomerOrderGrant,clock=()=>Date.now()}=opts||{};
 if([lookupSession,lookupOwnerStore,lookupInstallation,getProviderSecret,
     reserveReplayOnce,lookupCustomerOrderGrant,clock].some(x=>typeof x!=='function')||
   !jwks||!issuer)throw new Error('REQUIRED_PRIVATE_DEPENDENCIES');
 const ownerReceipts=new WeakMap(),providerReceipts=new WeakMap();
 const validClock=()=>{const v=clock();if(!isDateNumber(v))throw new Error('INVALID_SERVER_CLOCK');return v;};
 const RECEIPT_TTL_MS=60_000;
 function receiptState(map,receipt,missing){
  if(!map.has(receipt))return deny(missing);
  const state=map.get(receipt);
  if(state.used===true)return deny('RECEIPT_REUSED');
  const now=validClock();
  if(!Number.isSafeInteger(state.issuedAtMs)||
     now>state.issuedAtMs+RECEIPT_TTL_MS||now+5000<state.issuedAtMs)
    return deny('RECEIPT_EXPIRED');
  return {ok:true,state};
 }
 async function admitOwnerJwt({token,targetStoreId}={}){
  if(!isString(targetStoreId,128)||!SAFE_ID.test(targetStoreId))return deny('STORE_REQUEST');
  const v=nativeJwtVerify(token,jwks,issuer,audience,Math.floor(validClock()/1000));
  if(!v.ok)return v;
  let session,binding;
  try{
   session=await lookupSession({subject:v.subject,sessionId:v.sessionId});
   if(session?.active!==true||session?.subject!==v.subject||session?.sessionId!==v.sessionId)
     return deny('JWT_SESSION_NOT_ACTIVE');
   binding=await lookupOwnerStore({subject:v.subject,targetStoreId});
  }catch{return deny('JWT_BACKEND_UNAVAILABLE');}
  if(binding?.active!==true||binding?.ownerProof!=='PRIVATE_OWNER_VERIFIED'||
     binding?.ownerUserId!==v.subject||binding?.storeId!==targetStoreId||
     !isString(binding?.tenantId,128)||!SAFE_ID.test(binding.tenantId)||
     binding?.role!=='owner')return deny('OWNER_STORE_DENIED');
  const receipt=Object.freeze({kind:'PRIVATE_OWNER_AUTH',tenantId:binding.tenantId,
    storeId:binding.storeId});
  ownerReceipts.set(receipt,{subject:v.subject,sessionId:v.sessionId,issuedAtMs:validClock(),used:false});
  return {ok:true,receipt};
 }
 async function admitProviderEvent({channel,rawBody,signature}={}){
  if(!['MESSENGER','ZALO'].includes(channel))return deny('CHANNEL');
  let body;
  try{body=strictJsonBytes(rawBody,16384)}catch{return deny('BODY');}
  // Raw provider fields are lookup hints, NOT authority for Store scope.
  let destinationId,senderId,eventId,eventTime,appId;
  if(channel==='MESSENGER'){
   const entry=body.entry?.[0],evt=entry?.messaging?.[0];
   if(body.object!=='page'||!Array.isArray(body.entry)||body.entry.length!==1||
      !Array.isArray(entry?.messaging)||entry.messaging.length!==1||
      !isString(entry.id,128)||!isString(evt?.sender?.id,128)||
      evt?.recipient?.id!==entry.id||!isString(evt?.message?.mid,128)||
      evt.message.is_echo===true)return deny('META_ENVELOPE');
   destinationId=entry.id;senderId=evt.sender.id;eventId=evt.message.mid;
   eventTime=evt.timestamp;
  }else{
   if(body.event_name!=='user_send_text'||!isString(body.app_id,128)||
      !isString(body.recipient?.id,128)||!isString(body.sender?.id,128)||
      !isString(body.message?.msg_id,128))return deny('ZALO_ENVELOPE');
   destinationId=body.recipient.id;senderId=body.sender.id;
   eventId=body.message.msg_id;appId=body.app_id;eventTime=Number(body.timestamp);
  }
  if(!SAFE_ID.test(destinationId)||!SAFE_ID.test(senderId)||!SAFE_ID.test(eventId)||
      !isDateNumber(eventTime)||Math.abs(validClock()-eventTime)>300000)
      return deny('EVENT_TIME_OR_ID');
  let inst,secret;
  try{
   inst=await lookupInstallation({channel,destinationId,appId});
   if(inst?.active!==true||inst?.ownerProof!=='PRIVATE_OWNER_VERIFIED'||
      inst?.channel!==channel||inst?.destinationId!==destinationId||
      !isString(inst?.tenantId,128)||!isString(inst?.storeId,128)||
      !isString(inst?.installationId,128)||
      (channel==='ZALO'&&inst?.appId!==appId))
      return deny('INSTALLATION_OWNER_NOT_VERIFIED');
   secret=await getProviderSecret({installationId:inst.installationId,channel});
  }catch{return deny('PROVIDER_BACKEND_UNAVAILABLE');}
  if(!isString(secret,512)||Buffer.byteLength(secret,'utf8')<24)
    return deny('PROVIDER_SECRET_UNAVAILABLE');
  const expected=channel==='MESSENGER'
     ?crypto.createHmac('sha256',secret).update(rawBody).digest()
     :crypto.createHash('sha256').update(Buffer.concat([
        Buffer.from(appId,'utf8'),rawBody,
        Buffer.from(String(body.timestamp),'utf8'),Buffer.from(secret,'utf8')
      ])).digest();
  const valid=secureHexCompare(expected,signature,channel==='MESSENGER'?'sha256=':'mac=');
  if(!valid)return deny('PROVIDER_SIGNATURE');
  const key=crypto.createHash('sha256').update(JSON.stringify([
    channel,inst.tenantId,inst.storeId,inst.installationId,eventId
  ])).digest('hex');
  let reserved;
  try{reserved=await reserveReplayOnce({
    key,tenantId:inst.tenantId,storeId:inst.storeId,ttlMs:600000
  });}catch{return deny('REPLAY_SERVICE_UNAVAILABLE');}
  if(reserved!==true)return deny('REPLAY_OR_RATE_GATE');
  const receipt=Object.freeze({kind:'SIGNED_PROVIDER_EVENT',channel,
    tenantId:inst.tenantId,storeId:inst.storeId,
    installationId:inst.installationId,issuedForNoSendOnly:true});
  providerReceipts.set(receipt,{senderId,eventId,issuedAtMs:validClock(),used:false});
  return {ok:true,receipt};
 }
 function planCatalogRead({receipt,sku}={}){
  const auth=receiptState(providerReceipts,receipt,'NO_NATIVE_SIGNED_RECEIPT');
  if(!auth.ok)return auth;
  if(!isString(sku,60)||!/^[A-Za-z0-9_-]{1,60}$/.test(sku))return deny('SKU');
  auth.state.used=true;
  return {ok:true,plan:Object.freeze({
    kind:'READ_CATALOG_ONLY',tenantId:receipt.tenantId,
    storeId:receipt.storeId,sku,dbExecuted:false,sendEnabled:false
  })};
 }
 async function planOwnOrderRead({receipt,orderId}={}){
  const auth=receiptState(providerReceipts,receipt,'NO_NATIVE_SIGNED_RECEIPT');
  if(!auth.ok)return auth;
  if(!isString(orderId,80)||!/^[A-Za-z0-9_-]{1,80}$/.test(orderId))
    return deny('ORDER_ID');
  // Consume BEFORE awaiting a private grant to avoid concurrent double use.
  auth.state.used=true;
  const privateSender=auth.state.senderId;
  let grant;
  try{grant=await lookupCustomerOrderGrant({
    tenantId:receipt.tenantId,storeId:receipt.storeId,channel:receipt.channel,
    senderId:privateSender,orderId
  });}catch{return deny('ORDER_GRANT_SERVICE_UNAVAILABLE');}
  if(grant?.valid!==true||grant?.tenantId!==receipt.tenantId||
     grant?.storeId!==receipt.storeId||grant?.orderId!==orderId||
     grant?.senderId!==privateSender||grant?.channel!==receipt.channel||
     grant?.challengeStatus!=='INDEPENDENT_HUMAN_VERIFIED')
     return deny('ORDER_GRANT_DENIED');
  return {ok:true,plan:Object.freeze({
    kind:'READ_OWN_ORDER_STATUS_ONLY',tenantId:receipt.tenantId,
    storeId:receipt.storeId,orderId,dbExecuted:false,sendEnabled:false
  })};
 }
 function planPrivateCanaryBinding({ownerReceipt,providerReceipt}={}){
  const ownerAuth=receiptState(ownerReceipts,ownerReceipt,'UNVERIFIED_PRIVATE_CANARY_RECEIPT');
  if(!ownerAuth.ok)return ownerAuth;
  const providerAuth=receiptState(providerReceipts,providerReceipt,'UNVERIFIED_PRIVATE_CANARY_RECEIPT');
  if(!providerAuth.ok)return providerAuth;
  ownerAuth.state.used=true;providerAuth.state.used=true;
  if(ownerReceipt.tenantId!==providerReceipt.tenantId||
     ownerReceipt.storeId!==providerReceipt.storeId)
    return deny('OWNER_PROVIDER_DIFFERENT_STORE');
  return {ok:true,plan:Object.freeze({
    kind:'PRIVATE_OWNER_PROVIDER_NO_SEND_CANARY_PLAN',
    tenantId:ownerReceipt.tenantId,storeId:ownerReceipt.storeId,
    channel:providerReceipt.channel,installationId:providerReceipt.installationId,
    providerSendEnabled:false,commerceReadsEnabled:false,mutationsEnabled:false
  })};
 }
 return Object.freeze({admitOwnerJwt,admitProviderEvent,planCatalogRead,
    planOwnOrderRead,planPrivateCanaryBinding});
}
module.exports={createPrivateAdmissionGate,nativeJwtVerify};

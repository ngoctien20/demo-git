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
 if(matchingKeys.length===0)return deny('JWT_KEY');
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
   lookupCustomerOrderGrant,clock=()=>Date.now(),
   lookupPrivateApproverKey,reservePrivateApprovalNonceOnce}=opts||{};
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
  providerReceipts.set(receipt,{senderId,eventId,destinationId,appId,issuedAtMs:validClock(),used:false});
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

 // Future PRIVATE UAT source protocol: four separately signed event receipts
 // (Meta + Zalo for each Store), two independent signed owner/session receipts.
 // This returns a NO-SEND, NO-DB plan. It NEVER authorizes production release.
 async function planDualStoreNativeNoSendUat({owners,events}={}){
  if(!Array.isArray(owners)||owners.length!==2||
      !Array.isArray(events)||events.length!==4)
    return deny('UAT_EVIDENCE_SHAPE');
  if(new Set(owners).size!==2||new Set(events).size!==4)
    return deny('UAT_EVIDENCE_DUPLICATE');
  const ownerState=[],providerState=[];
  for(const receipt of owners){
   const r=receiptState(ownerReceipts,receipt,'UAT_OWNER_JWT_RECEIPT_MISSING');
   if(!r.ok)return r;
   ownerState.push(r.state);
  }
  for(const receipt of events){
   const r=receiptState(providerReceipts,receipt,'UAT_NATIVE_EVENT_RECEIPT_MISSING');
   if(!r.ok)return r;
   providerState.push(r.state);
  }
  // Minting requires different JWT subjects AND sessions. This is server-side
  // proof from previously verified signed claims, not a client owner flag.
  if(ownerState[0].subject===ownerState[1].subject||
     ownerState[0].sessionId===ownerState[1].sessionId||
     owners[0].storeId===owners[1].storeId||
     owners[0].tenantId!==owners[1].tenantId)
    return deny('UAT_TWO_DISTINCT_OWNERS_SAME_TENANT_REQUIRED');
  const tenant=owners[0].tenantId;
  for(let i=0;i<2;i++){
   const store=owners[i].storeId;
   const matching=events.filter(p=>p.tenantId===tenant&&p.storeId===store);
   if(matching.length!==2||
     new Set(matching.map(p=>p.channel)).size!==2||
     !matching.some(p=>p.channel==='MESSENGER')||
     !matching.some(p=>p.channel==='ZALO'))
    return deny('UAT_BOTH_NATIVE_CHANNELS_PER_STORE_REQUIRED');
  }
  if(new Set(events.map(p=>p.installationId)).size!==4)
    return deny('UAT_DUPLICATE_INSTALLATION');
  // Consume every private receipt BEFORE any asynchronous callback so even
  // simultaneous UAT admission requests cannot reuse one authenticated event.
  for(const state of [...ownerState,...providerState])state.used=true;
  try{
   for(let i=0;i<2;i++){
    const state=ownerState[i],claimed=owners[i];
    const [session,owner]=await Promise.all([
      lookupSession({subject:state.subject,sessionId:state.sessionId}),
      lookupOwnerStore({subject:state.subject,targetStoreId:claimed.storeId})
    ]);
    if(session?.active!==true||session.subject!==state.subject||
       session.sessionId!==state.sessionId)
       return deny('UAT_SESSION_REVOKED_AT_COMMIT');
    if(owner?.active!==true||owner?.ownerProof!=='PRIVATE_OWNER_VERIFIED'||
       owner?.role!=='owner'||owner?.ownerUserId!==state.subject||
       owner?.tenantId!==tenant||owner?.storeId!==claimed.storeId)
       return deny('UAT_OWNER_REVOKED_AT_COMMIT');
   }
   for(let i=0;i<events.length;i++){
    const ev=events[i],meta=providerState[i];
    const current=await lookupInstallation({
      channel:ev.channel,destinationId:meta.destinationId,appId:meta.appId
    });
    if(current?.active!==true||current?.ownerProof!=='PRIVATE_OWNER_VERIFIED'||
       current?.tenantId!==tenant||current?.storeId!==ev.storeId||
       current?.channel!==ev.channel||
       current?.destinationId!==meta.destinationId||
       current?.installationId!==ev.installationId||
       (ev.channel==='ZALO'&&current?.appId!==meta.appId))
      return deny('UAT_PROVIDER_INSTALLATION_REVOKED_AT_COMMIT');
   }
  }catch{return deny('UAT_PRIVATE_AUTHORITY_BACKEND_UNAVAILABLE');}
  const committedAt=validClock();
  if([...ownerState,...providerState].some(m=>
    committedAt>m.issuedAtMs+RECEIPT_TTL_MS||
    committedAt+5000<m.issuedAtMs))
     return deny('UAT_RECEIPT_EXPIRED_DURING_REVALIDATION');
  // No real reader is attached here. Store isolation and order access must be
  // proven separately with real JWT, RLS, and an independent QA reviewer.
  const stores=Object.freeze(owners.map(o=>o.storeId));
  return {ok:true,plan:Object.freeze({
    kind:'DUAL_STORE_META_ZALO_PRIVATE_NO_SEND_UAT_SOURCE_PLAN',
    tenantId:tenant,stores,
    requiredChannels:Object.freeze(['MESSENGER','ZALO']),
    signedOwnerReceipts:2,signedProviderReceipts:4,
    privateAuthorityFreshlyRechecked:true,
    realCommerceQueriesExecuted:false,providerMessagesSent:0,
    productionReleaseApproved:false,hostedJwtAttested:false,
    nativeProviderOwnerCanaryIndependentlyAttested:false
  })};
 }

 // V17.1T -- cryptographically signed FOUR-PARTY PRIVATE setup approval.
 // This grants neither an Auth membership nor database or provider access.
 // The approver JWK registry MUST be private server-controlled and independent
 // from the client-provided approval envelope or user_metadata.
 async function planOperatorAuthorizedTwoStoreAuth({intent,approvals,owners}={}){
  if(typeof lookupPrivateApproverKey!=='function'||
     typeof reservePrivateApprovalNonceOnce!=='function')
    return deny('OPERATOR_APPROVAL_SERVICE_NOT_CONFIGURED');
  if(!intent||typeof intent!=='object'||Array.isArray(intent)||
     !Array.isArray(owners)||owners.length!==2||owners[0]===owners[1]||
     !Array.isArray(approvals)||approvals.length!==4)
    return deny('OPERATOR_APPROVAL_SHAPE');
  const exact=['schema','scope','projectRef','tenantId','stores','commitSha',
   'nonce','issuedAtMs','expiresAtMs','noSend','noWrite','noBilling','noCredentialChange'];
  if(Object.keys(intent).sort().join('|')!==exact.slice().sort().join('|')||
     intent.schema!=='TIEN404_V171T_OPERATOR_AUTH_V1'||
     intent.scope!=='PRIVATE_TWO_STORE_NO_SEND_AUTH_ADMISSION'||
     intent.projectRef!=='ifxlvrhyjhbzbrkdsida'||
     !isString(intent.tenantId,128)||!SAFE_ID.test(intent.tenantId)||
     !Array.isArray(intent.stores)||intent.stores.length!==2||
     intent.stores.some(x=>!isString(x,128)||!SAFE_ID.test(x))||
     intent.stores[0]===intent.stores[1]||
     !/^[a-f0-9]{40}$/.test(String(intent.commitSha||''))||
     !/^[A-Za-z0-9_-]{16,120}$/.test(String(intent.nonce||''))||
     intent.noSend!==true||intent.noWrite!==true||
     intent.noBilling!==true||intent.noCredentialChange!==true||
     !isDateNumber(intent.issuedAtMs)||!isDateNumber(intent.expiresAtMs)||
     intent.expiresAtMs<=intent.issuedAtMs||
     intent.expiresAtMs-intent.issuedAtMs>600000)
    return deny('OPERATOR_APPROVAL_SCOPE');
  const now=validClock();
  if(intent.issuedAtMs>now+30000||intent.expiresAtMs<=now)
    return deny('OPERATOR_APPROVAL_EXPIRED');
  const roleOrder=['OPERATOR','SECURITY_REVIEWER','OWNER_STORE_A','OWNER_STORE_B'];
  const roleSeen=new Set(),kidSeen=new Set(),signerSeen=new Set();
  const actorRecords=[];
  const ownerStates=[];
  for(const rec of owners){
   const x=receiptState(ownerReceipts,rec,'OPERATOR_OWNER_JWT_NOT_VERIFIED');
   if(!x.ok)return x;
   ownerStates.push(x.state);
  }
  if(ownerStates[0].subject===ownerStates[1].subject||
     ownerStates[0].sessionId===ownerStates[1].sessionId||
     owners[0].tenantId!==intent.tenantId||
     owners[1].tenantId!==intent.tenantId||
     owners[0].storeId!==intent.stores[0]||
     owners[1].storeId!==intent.stores[1])
    return deny('OPERATOR_TWO_STORE_IDENTITY_MISMATCH');
  // Atomically consume verified JWT capabilities BEFORE the first awaited signer
  // registry lookup. Concurrent requests may not enter the approval phase twice.
  for(const state of ownerStates)state.used=true;
  for(const role of roleOrder){
   const a=approvals.find(x=>x?.role===role);
   if(!a||roleSeen.has(role)||!isString(a.kid,100)||
      !/^[A-Za-z0-9_.:-]{1,100}$/.test(a.kid)||
      !isString(a.signature,150)||!isString(a.role,40))
    return deny('OPERATOR_APPROVAL_SIGNERS');
   if(Object.keys(a).sort().join('|')!=='kid|role|signature'||
      kidSeen.has(a.kid))return deny('OPERATOR_APPROVAL_DUPLICATE_KEY');
   roleSeen.add(role);kidSeen.add(a.kid);
   let record;
   try{record=await lookupPrivateApproverKey({role,kid:a.kid});}
   catch{return deny('OPERATOR_KEY_REGISTRY_UNAVAILABLE');}
   if(record?.active!==true||record?.role!==role||
      record?.kid!==a.kid||!isString(record?.signerRef,128)||
      record?.ownerProof!=='PRIVATELY_ENROLLED_SIGNER'||
      signerSeen.has(record.signerRef))
    return deny('OPERATOR_APPROVER_NOT_ENROLLED');
   signerSeen.add(record.signerRef);
   const pub=record.publicJwk;
   if(!pub||pub.kty!=='OKP'||pub.crv!=='Ed25519'||
      !isString(pub.x,90)||pub.d!==undefined||
      (pub.use!==undefined&&pub.use!=='sig'))
    return deny('OPERATOR_PUBLIC_KEY_UNTRUSTED');
   if(role==='OWNER_STORE_A'||role==='OWNER_STORE_B'){
    const index=role==='OWNER_STORE_A'?0:1;
    if(record.ownerUserId!==ownerStates[index].subject||
       record.tenantId!==intent.tenantId||
       record.storeId!==intent.stores[index])
      return deny('OPERATOR_OWNER_CONSENT_IDENTITY_MISMATCH');
   }
   const msg=Buffer.from('TIEN404_V171T_PRIVATE_OPERATOR_SIGNED_APPROVAL_V1\0'+
      JSON.stringify({intent,role,kid:a.kid}),'utf8');
   let valid=false;
   try{
    const raw=decodeB64url(a.signature,128);
    if(raw.length===64){
     const key=crypto.createPublicKey({format:'jwk',key:pub});
     valid=crypto.verify(null,msg,key,raw);
    }
   }catch{valid=false;}
   if(!valid)return deny('OPERATOR_APPROVAL_SIGNATURE_INVALID');
   actorRecords.push({role,kid:a.kid,signerRef:record.signerRef,pubX:pub.x});
  }
  if(roleSeen.size!==4||signerSeen.size!==4||
     approvals.some(a=>!roleOrder.includes(a?.role))||
     new Set(approvals.map(a=>a?.role)).size!==4)
    return deny('OPERATOR_APPROVAL_ROLE_SET');
  // JWT receipts were consumed before asynchronous signature lookup above.
  const digest=crypto.createHash('sha256').update(JSON.stringify(intent)).digest('hex');
  let reserved;
  try{
   reserved=await reservePrivateApprovalNonceOnce({
     digest,nonce:intent.nonce,tenantId:intent.tenantId,
     storeIds:[...intent.stores],ttlMs:600000
   });
  }catch{return deny('OPERATOR_NONCE_SERVICE_UNAVAILABLE');}
  if(reserved!==true)return deny('OPERATOR_APPROVAL_REPLAY_OR_NON_ATOMIC');
  // Re-read both live sessions, owner bindings and approver enrollments after
  // nonce reservation. Do not trust stale signers or stale Auth JWT receipts.
  try{
   for(let i=0;i<2;i++){
    const state=ownerStates[i],storeId=intent.stores[i];
    const [sess,binding]=await Promise.all([
     lookupSession({subject:state.subject,sessionId:state.sessionId}),
     lookupOwnerStore({subject:state.subject,targetStoreId:storeId})
    ]);
    if(sess?.active!==true||sess.subject!==state.subject||
       sess.sessionId!==state.sessionId)
      return deny('OPERATOR_AUTH_SESSION_REVOKED');
    if(binding?.active!==true||binding?.ownerProof!=='PRIVATE_OWNER_VERIFIED'||
       binding.ownerUserId!==state.subject||binding.role!=='owner'||
       binding.tenantId!==intent.tenantId||binding.storeId!==storeId)
      return deny('OPERATOR_STORE_OWNERSHIP_REVOKED');
   }
   for(const actor of actorRecords){
    const fresh=await lookupPrivateApproverKey({role:actor.role,kid:actor.kid});
    if(fresh?.active!==true||fresh?.ownerProof!=='PRIVATELY_ENROLLED_SIGNER'||
       fresh?.role!==actor.role||fresh?.kid!==actor.kid||
       fresh?.signerRef!==actor.signerRef||
       fresh?.publicJwk?.x!==actor.pubX||fresh?.publicJwk?.d!==undefined)
      return deny('OPERATOR_APPROVER_REVOKED');
   }
  }catch{return deny('OPERATOR_AUTHORITY_RECHECK_UNAVAILABLE');}
  if(validClock()>intent.expiresAtMs||
     ownerStates.some(st=>validClock()>st.issuedAtMs+RECEIPT_TTL_MS))
     return deny('OPERATOR_AUTHORIZATION_EXPIRED_AT_COMMIT');
  return {ok:true,plan:Object.freeze({
    kind:'PRIVATE_OPERATOR_TWO_OWNER_AUTH_SETUP_ONLY',
    approvalDigest:digest,projectRef:intent.projectRef,
    tenantId:intent.tenantId,stores:Object.freeze([...intent.stores]),
    approvalRoles:Object.freeze([...roleOrder]),approvalCount:4,
    independentOwnerJwtReceipts:2,
    nativeMetaAndZaloAttested:false,
    independentHostedOwnerUatAttested:false,
    allowAuthWrites:false,allowRoleChanges:false,allowCredentialChanges:false,
    allowProviderSends:false,allowCommerceReads:false,allowBilling:false,
    productionReleaseApproved:false,release:'HOSTED_NO_GO'
  })};
 }
 return Object.freeze({admitOwnerJwt,admitProviderEvent,planCatalogRead,
    planOwnOrderRead,planPrivateCanaryBinding,planDualStoreNativeNoSendUat,
    planOperatorAuthorizedTwoStoreAuth});
}
module.exports={createPrivateAdmissionGate,nativeJwtVerify};

'use strict';
/**
 * TIEN404 V18.5.3 — Cloudflare Access JWT signature verification candidate.
 *
 * OFFLINE_SYNTHETIC_QA ONLY. Requires server-pinned public RSA JWKS keys,
 * server-pinned issuer+audience, and an independently authorized operator
 * sub allowlist. Never fetches JWK URLs from a token or request.
 *
 * Returns the V18.5.1 *synthetic* receipt shape solely for offline tests.
 * It is not a hosted Worker verifier, production identity, Store/RLS grant,
 * permission to execute n8n, or an approval to add an Access application.
 */
const {createPublicKey,verify:cryptoVerify,constants}=require('node:crypto');
const SOURCE='MOCK_TRUSTED_CRYPTOGRAPHICALLY_VERIFIED_QA_ACCESS';
const SCOPE='V1851_PRIVATE_STAGING';
const KID=/^[A-Za-z0-9._-]{8,128}$/;
const TOKEN=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_TOKEN=8192;
function refuse(){const e=new Error('ACCESS_JWT_NOT_VERIFIED');e.code='ACCESS_JWT_NOT_VERIFIED';throw e;}
function plain(x){return x&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);}
function exactAccessIssuer(raw){
  if(typeof raw!=='string'||raw.length>210)refuse();
  let u;try{u=new URL(raw)}catch{refuse()}
  if(u.protocol!=='https:'||!u.hostname.endsWith('.cloudflareaccess.com')||
     u.hostname.split('.').length!==3||u.username||u.password||
     u.pathname!=='/'||u.search||u.hash||u.port)
    refuse();
  return u.origin;
}
function parsePart(raw){
  if(typeof raw!=='string'||raw.length<2||raw.length>4096||
    !/^[A-Za-z0-9_-]+$/.test(raw))refuse();
  let bytes;
  try {bytes=Buffer.from(raw,'base64url');}
  catch {refuse()}
  // Reject noncanonical encodings, invalid UTF8 and ambiguous envelopes.
  if(bytes.toString('base64url')!==raw)refuse();
  let str;
  try{str=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
  catch{refuse()}
  let x;try{x=JSON.parse(str)}catch{refuse()}
  if(!plain(x))refuse();
  return x;
}
function buildTrustedKeySet(pinnedKeys){
  if(!Array.isArray(pinnedKeys)||pinnedKeys.length<1||pinnedKeys.length>8)
    refuse();
  const map=new Map();
  for(const jwk of pinnedKeys){
    if(!plain(jwk)||!KID.test(jwk.kid||'')||map.has(jwk.kid)||
      jwk.kty!=='RSA'||jwk.alg!=='RS256'||jwk.use!=='sig'||
      jwk.e!=='AQAB'||typeof jwk.n!=='string'||jwk.n.length<320||
      /[^A-Za-z0-9_-]/.test(jwk.n)||
      ['d','p','q','dp','dq','qi','oth','k','x5u','jku'].some(k=>k in jwk))
      refuse();
    let key;
    try{key=createPublicKey({key:jwk,format:'jwk'})}catch{refuse()}
    const bits=key.asymmetricKeyDetails?.modulusLength;
    if(key.asymmetricKeyType!=='rsa'||!Number.isInteger(bits)||bits<2048)
      refuse();
    map.set(jwk.kid,key);
  }
  return map;
}
function createOfflineAccessJwtVerifier({
  qaMode='DISABLED',issuer,audience,pinnedKeys,approvedOperatorSubjects,
  now=()=>Date.now(),maxAgeSeconds=1800,clockSkewSeconds=10
}={}){
  if(qaMode!=='OFFLINE_SYNTHETIC_QA'||typeof audience!=='string'||
    audience.length<8||audience.length>160||
    typeof now!=='function'||!Number.isSafeInteger(maxAgeSeconds)||
    maxAgeSeconds<60||maxAgeSeconds>1800||
    !Number.isSafeInteger(clockSkewSeconds)||clockSkewSeconds<0||
    clockSkewSeconds>15||!Array.isArray(approvedOperatorSubjects)||
    approvedOperatorSubjects.length<1||approvedOperatorSubjects.length>10)
    refuse();
  const expectedIssuer=exactAccessIssuer(issuer);
  const operatorIds=new Set();
  for(const sub of approvedOperatorSubjects){
    if(typeof sub!=='string'||sub.length<5||sub.length>200||
      /[\u0000-\u0020\u007f]/.test(sub)||operatorIds.has(sub))refuse();
    operatorIds.add(sub);
  }
  const keys=buildTrustedKeySet(pinnedKeys);
  function verifyAccessRequest(request){
    if(!(request instanceof Request))refuse();
    const raw=request.headers.get('cf-access-jwt-assertion');
    if(typeof raw!=='string'||raw.length<100||raw.length>MAX_TOKEN||
      !TOKEN.test(raw)||raw.includes(','))refuse();
    const parts=raw.split('.');
    if(parts.length!==3)refuse();
    const header=parsePart(parts[0]);
    if(header.alg!=='RS256'||!KID.test(header.kid||'')||
      header.typ&&header.typ!=='JWT'||
      ['jku','x5u','jwk','x5c','crit','zip','enc','kid_url'].some(x=>x in header))
      refuse();
    const publicKey=keys.get(header.kid);
    if(!publicKey)refuse();
    let signature;
    try{signature=Buffer.from(parts[2],'base64url')}catch{refuse()}
    if(signature.toString('base64url')!==parts[2])refuse();
    let verified=false;
    try{verified=cryptoVerify('RSA-SHA256',
      Buffer.from(parts[0]+'.'+parts[1],'utf8'),{
        key:publicKey,padding:constants.RSA_PKCS1_PADDING
      },signature)}catch{refuse()}
    if(!verified)refuse();
    const payload=parsePart(parts[1]);
    const time=Math.floor(now()/1000);
    const aud=typeof payload.aud==='string'?[payload.aud]:payload.aud;
    if(payload.iss!==expectedIssuer||!Array.isArray(aud)||
      aud.length!==1||aud[0]!==audience||
      typeof payload.sub!=='string'||!operatorIds.has(payload.sub)||
      !Number.isSafeInteger(payload.iat)||!Number.isSafeInteger(payload.exp)||
      payload.exp<=payload.iat||
      payload.exp-payload.iat>maxAgeSeconds||
      payload.iat>time+clockSkewSeconds||
      payload.exp<=time-clockSkewSeconds||
      payload.nbf!==undefined&&(!Number.isSafeInteger(payload.nbf)||
        payload.nbf>time+clockSkewSeconds)||
      payload.nbf!==undefined&&payload.nbf>payload.exp)
      refuse();
    // Avoid passing the personal identity or raw JWT outside the auth port.
    return Object.freeze({
      source:SOURCE,scope:SCOPE,verified:true,issuerVerified:true,
      audienceVerified:true,sessionUnexpired:true,permitted:true,
      cryptographicSignatureTested:true,operatorAllowlisted:true,
      authorizationClass:'SYNTHETIC_PRIVATE_OPERATOR_ONLY',
      customerAuthenticated:false,storeAuthorized:false,
      commerceWritesAllowed:false,providerSendsAllowed:false
    });
  }
  return Object.freeze({
    verifyAccessRequest,
    releaseState:Object.freeze({
      mode:'OFFLINE_SYNTHETIC_QA',
      pinnedIssuer:true,pinnedAudience:true,
      publicKeyCount:keys.size,realCloudflareJwksFetched:false,
      realOperatorConsented:false,realAccessAppCreated:false,
      hostedWorkerInstalled:false,publicWidgetAuthorized:false,
      merchantStoreReadAllowed:false,realN8nInvocations:0,
      productionReady:false
    })
  });
}
module.exports={createOfflineAccessJwtVerifier,SOURCE,SCOPE,exactAccessIssuer};

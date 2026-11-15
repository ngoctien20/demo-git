/**
 * TIEN404 AI V14.5Z-G2.1 — PRIVATE READ-ONLY PROVIDER ID ATTESTOR.
 * Standalone Worker module. Only route allowed: POST /v1/g2-provider-attest.
 * No send, no customer ID, no owner ID, no Orders/Products/DB writes.
 * Signed claim: trusted server observation of a getMe response; NOT a native
 * Zalo-signed identity assertion. Shop/Owner membership remains unverified.
 */
const enc=new TextEncoder();
const isHex64=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const isBotId=s=>typeof s==='string'&&/^[0-9]{8,32}$/.test(s);
const hex=b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
const b64url=b=>btoa(String.fromCharCode(...new Uint8Array(b)))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function result(code,body){
 return new Response(JSON.stringify({
   ...body,can_send:false,owner_verified:false,
   bot_shop_binding_verified:false,provider_sends:0,orders_written:0
 }),{status:code,headers:{
   'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store, private','x-content-type-options':'nosniff',
   'referrer-policy':'no-referrer','cross-origin-resource-policy':'same-origin'
 }});
}
function fail(code,reason){return result(code,{ok:false,error:reason})}
const context='TIEN404-G2-IDENTITY-V1\0';
const signPurpose='TIEN404_V145Z_LIVE03_CERTIFICATION_ONLY';
const providerIssuer='ZALO_BOT_PROVIDER_ATTESTOR';
export async function g2Attest(request,env,authorized,fetchImpl=fetch,nowFn=Date.now){
 if(request.method!=='POST')return fail(405,'METHOD_NOT_ALLOWED');
 if(env?.ZALO_SEND_ENABLED!=='false')return fail(423,'SEND_SWITCH_NOT_OFF');
 if(typeof authorized!=='function'||!(await authorized(request,env)))return fail(401,'UNAUTHORIZED');
 if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')
  return fail(415,'JSON_REQUIRED');
 if(Number(request.headers.get('content-length')||0)>200)return fail(413,'REQUEST_TOO_LARGE');
 let raw;try{raw=await request.text();}catch{return fail(400,'BAD_REQUEST')}
 if(!raw||raw.length>200)return fail(413,'BODY_LIMIT');
 let req;try{req=JSON.parse(raw);}catch{return fail(400,'BAD_JSON')}
 if(!req||Array.isArray(req)||typeof req!=='object'||
   Object.keys(req).length!==1||!isHex64(req.challenge))return fail(422,'INVALID_CHALLENGE');
 if(!env.ZALO_BOT_TOKEN||!isBotId(env.ZALO_BOT_TOKEN.split(':')[0])||
    env.G2_PROVIDER_SIGN_KEY?.type!=='private'||
    env.G2_PROVIDER_SIGN_KEY?.algorithm?.name!=='ECDSA'||
    env.G2_PROVIDER_SIGN_KEY?.algorithm?.namedCurve!=='P-256'||
    !env.G2_PROVIDER_SIGN_KEY.usages?.includes('sign')||
    env.G2_PROVIDER_HASH_KEY?.type!=='secret'||
    env.G2_PROVIDER_HASH_KEY?.algorithm?.name!=='HMAC'||
    env.G2_PROVIDER_HASH_KEY?.algorithm?.hash?.name!=='SHA-256'||
    !env.G2_PROVIDER_HASH_KEY.usages?.includes('sign'))
  return fail(503,'PRIVATE_ATTESTOR_NOT_CONFIGURED');
 if(typeof fetchImpl!=='function'||typeof nowFn!=='function')return fail(503,'TRUST_TRANSPORT_UNAVAILABLE');
 const now=nowFn();
 if(!Number.isSafeInteger(now)||now<1700000000000)return fail(503,'TRUSTED_CLOCK_UNAVAILABLE');
 try{
   const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),6500);
   let upstream;
   try{
      upstream=await fetchImpl(
       'https://bot-api.zaloplatforms.com/bot'+env.ZALO_BOT_TOKEN+'/getMe',
       {method:'POST',headers:{'content-type':'application/json'},
         body:'{}',redirect:'manual',signal:ctl.signal});
   }finally{clearTimeout(timer)}
   if(upstream.status!==200||!upstream.ok)return fail(502,'PROVIDER_RESPONSE_NOT_OK');
   const data=await upstream.json().catch(()=>null);
   const botId=data?.result?.id;
   if(data?.ok!==true||!isBotId(botId))return fail(502,'OFFICIAL_BOT_ID_NOT_VERIFIABLE');
   const botDigest=hex(await crypto.subtle.sign({name:'HMAC'},env.G2_PROVIDER_HASH_KEY,
       enc.encode(context+req.challenge+'\0'+botId)));
   const payload=JSON.stringify({
     issuer:providerIssuer,purpose:signPurpose,
     evidence_id:'G2PROV_'+req.challenge.slice(0,24),
     issued_ms:now,expires_ms:now+120000,
     claims:{
       bot_digest:botDigest,
       challenge_nonce:req.challenge,
       provider:'zalo_bot_creator',
       source:'SERVER_HTTPS_ZALO_GETME',
       api_method:'POST',
       getme_http_status:200,
       getme_result_id_string:true,
       id_is_official_provider_result:true,
       actual_api_call_readonly:true
     }
   });
   const signature=b64url(await crypto.subtle.sign(
     {name:'ECDSA',hash:'SHA-256'},env.G2_PROVIDER_SIGN_KEY,enc.encode(payload)));
   return result(200,{
     ok:true,status:'G2_PROVIDER_ID_SERVER_OBSERVED_ONLY',
     proof:{payload,signature},
     raw_provider_id_exposed:false,
     can_promote_registry:false,real_owner_binding_certified:false,
     challenge_replay_prevented:false,
     evidence_expires_ms:now+120000
   });
 }catch{return fail(502,'READONLY_PROVIDER_ATTESTATION_FAILED')}
}
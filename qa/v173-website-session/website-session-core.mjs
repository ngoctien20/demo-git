/**
 * TIEN404 V17.3 — website session → store-bound Custom Bot core.
 * Source-only reference implementation. No HTTP listener, no secrets, network or send.
 * Host MUST supply its server-side registry, keyring, atomic message claim and a
 * Store-scoped catalog reader. Anonymous widget sessions are NOT customer identity.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const CONTRACT = 'T404_V173_WEBSITE_SESSION_QA_V1';
const FAIL = (reason, code=403) => Object.freeze({status:'DENY',reason,http_status:code,provider_sends:0,model_calls:0,commerce_writes:0});
const REGEX_ID=/^QA_[A-Z0-9_]{3,80}$/;
const regexpWord=/^[A-Za-z0-9_-]{2,28}$/;
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const secureEq=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
function encoded(s){return Buffer.from(s,'utf8').toString('base64url');}
function decode(s){if(typeof s!=='string'||s.length<2||s.length>2000||!/^[A-Za-z0-9_-]+$/.test(s))throw Error('TOKEN_SEGMENT_INVALID');return Buffer.from(s,'base64url').toString('utf8');}
function cleanOrigin(origin){
 if(typeof origin!=='string'||origin.length>200)return null;
 try{const x=new URL(origin);if(x.protocol!=='https:'||x.username||x.password||x.pathname!=='/'||x.search||x.hash||x.origin!==origin)return null;return x.origin;}catch{return null;}
}
function cfgOk(cfg){return cfg&&typeof cfg==='object'&&typeof cfg.issuer==='string'&&/^t404-[a-z0-9-]{3,48}$/.test(cfg.issuer)&&
 typeof cfg.audience==='string'&&/^t404-[a-z0-9-]{3,48}$/.test(cfg.audience)&&
 typeof cfg.activeKid==='string'&&regexpWord.test(cfg.activeKid)&&cfg.keyring&&typeof cfg.keyring==='object'&&
 typeof cfg.keyring[cfg.activeKid]==='string'&&Buffer.byteLength(cfg.keyring[cfg.activeKid])>=32&&
 (cfg.qaMode===true||cfg.qaMode===false);}
function eligible(binding,origin,cfg){
 if(!binding||typeof binding!=='object'||binding.channel!=='website'||binding.status!=='QA_APPROVED'||
 binding.origin!==origin||!REGEX_ID.test(binding.installation_ref)||!REGEX_ID.test(binding.tenant_ref)||
 !REGEX_ID.test(binding.store_ref)||!REGEX_ID.test(binding.bot_ref)||
 binding.bot_version!==binding.bot_ref+'_V1'||typeof binding.prompt_version!=='string'||
 typeof binding.knowledge_version!=='string'||typeof binding.policy_version!=='string'||
 binding.tool_allowlist!=='catalog_read'||binding.subscription_active!==true||binding.store_paused!==false)return false;
 if(cfg.qaMode===true)return binding.approval_scope==='SYNTHETIC_ONLY'&&binding.owner_authority_verified===false;
 return binding.approval_scope==='OWNER_APPROVED'&&binding.owner_authority_verified===true&&binding.read_only===true;
}
function signingInput(kid,payload){return 't404s1.'+kid+'.'+payload;}
function mac(key,message){return createHmac('sha256',key).update(message,'utf8').digest('base64url');}
function sign(cfg,payload){
 const body=encoded(JSON.stringify(payload));
 const partial=signingInput(cfg.activeKid,body);
 return partial+'.'+mac(cfg.keyring[cfg.activeKid],partial);
}
function jsonSafe(raw){const obj=JSON.parse(raw);if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('INVALID_PAYLOAD');return obj;}
const claimsKeys=['v','iss','aud','iat','nbf','exp','sid','channel','installation_ref','origin','tenant_ref','store_ref','bot_ref','bot_version','prompt_version','knowledge_version','policy_version','scope'];
export async function issueWebsiteSession({installationRef,origin,resolveBinding,config,now=Date.now(),random=randomBytes}={}){
 if(!cfgOk(config)||typeof resolveBinding!=='function'||!Number.isSafeInteger(now))return FAIL('ISSUER_NOT_CONFIGURED',503);
 const websiteOrigin=cleanOrigin(origin);
 if(!websiteOrigin||!REGEX_ID.test(installationRef||''))return FAIL('UNTRUSTED_INSTALLATION_OR_ORIGIN');
 let b;try{b=await resolveBinding({channel:'website',installation_ref:installationRef});}catch{return FAIL('REGISTRY_UNAVAILABLE',503);}
 if(!eligible(b,websiteOrigin,config)||b.installation_ref!==installationRef)return FAIL('WEBSITE_INSTALLATION_NOT_AUTHORIZED');
 let sid;try{const bytes=random(24);if(!Buffer.isBuffer(bytes)||bytes.length!==24)throw Error('RAND');sid=bytes.toString('base64url');}catch{return FAIL('SECURE_SESSION_ID_NOT_AVAILABLE',503);}
 const time=Math.floor(now/1000);
 const claims={v:1,iss:config.issuer,aud:config.audience,iat:time,nbf:time,exp:time+300,sid,
  channel:'website',installation_ref:b.installation_ref,origin:websiteOrigin,
  tenant_ref:b.tenant_ref,store_ref:b.store_ref,bot_ref:b.bot_ref,bot_version:b.bot_version,
  prompt_version:b.prompt_version,knowledge_version:b.knowledge_version,policy_version:b.policy_version,
  scope:config.qaMode===true?'QA_CATALOG_ONLY':'APPROVED_CATALOG_ONLY'};
 return Object.freeze({status:'SESSION_ISSUED',token:sign(config,claims),expires_in_sec:300,
  source_scope:config.qaMode?'SYNTHETIC_QA_ONLY':'APPROVED_WEBSITE_ONLY',
  customer_identity_verified:false,hosted_rls_verified:false,provider_sends:0,model_calls:0,commerce_writes:0});
}
export async function verifyWebsiteSession({token,origin,installationRef,resolveBinding,config,now=Date.now()}={}){
 if(!cfgOk(config)||typeof resolveBinding!=='function'||!Number.isSafeInteger(now))return FAIL('VERIFIER_NOT_CONFIGURED',503);
 const websiteOrigin=cleanOrigin(origin);
 if(!websiteOrigin||!REGEX_ID.test(installationRef||''))return FAIL('WEBSITE_ORIGIN_OR_INSTALLATION_DENIED');
 if(typeof token!=='string'||token.length>2300||token.length<150)return FAIL('SESSION_TOKEN_FORMAT_INVALID');
 const parts=token.split('.');
 if(parts.length!==4||parts[0]!=='t404s1'||!regexpWord.test(parts[1])||!/^[A-Za-z0-9_-]+$/.test(parts[3]))return FAIL('SESSION_TOKEN_FORMAT_INVALID');
 const secret=config.keyring[parts[1]];
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32)return FAIL('UNKNOWN_SESSION_KEY');
 const inp=signingInput(parts[1],parts[2]);
 if(!secureEq(mac(secret,inp),parts[3]))return FAIL('INVALID_SESSION_SIGNATURE');
 let c;
 try{c=jsonSafe(decode(parts[2]));}catch{return FAIL('INVALID_SESSION_PAYLOAD');}
 if(Object.keys(c).length!==claimsKeys.length||claimsKeys.some(k=>!own(c,k)))return FAIL('SESSION_CLAIMS_NOT_CANONICAL');
 const secs=Math.floor(now/1000);
 if(c.v!==1||c.iss!==config.issuer||c.aud!==config.audience||c.channel!=='website'||
 c.origin!==websiteOrigin||c.installation_ref!==installationRef||!REGEX_ID.test(c.tenant_ref||'')||
 !REGEX_ID.test(c.store_ref||'')||!REGEX_ID.test(c.bot_ref||'')||
 typeof c.sid!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(c.sid)||
 !Number.isSafeInteger(c.iat)||!Number.isSafeInteger(c.nbf)||!Number.isSafeInteger(c.exp)||
 c.exp-c.iat!==300||c.nbf!==c.iat||c.iat>secs+30||secs<c.nbf||secs>=c.exp)
 return FAIL('SESSION_SCOPE_OR_EXPIRY_DENIED');
 if(c.scope!==(config.qaMode?'QA_CATALOG_ONLY':'APPROVED_CATALOG_ONLY'))return FAIL('SESSION_MODE_DENIED');
 let b;
 try{b=await resolveBinding({channel:'website',installation_ref:installationRef});}catch{return FAIL('REGISTRY_UNAVAILABLE',503);}
 if(!eligible(b,websiteOrigin,config)||b.installation_ref!==installationRef)return FAIL('SESSION_INSTALLATION_REVOKED');
 for(const [field,claim] of [['tenant_ref','tenant_ref'],['store_ref','store_ref'],['bot_ref','bot_ref'],
 ['bot_version','bot_version'],['prompt_version','prompt_version'],['knowledge_version','knowledge_version'],
 ['policy_version','policy_version']]){
  if(b[field]!==c[claim])return FAIL('BOT_PROFILE_OR_STORE_VERSION_CHANGED');
 }
 return Object.freeze({status:'SESSION_VERIFIED',context:Object.freeze({
  channel:'website',installation_ref:b.installation_ref,tenant_ref:b.tenant_ref,store_ref:b.store_ref,
  bot_ref:b.bot_ref,bot_version:b.bot_version,prompt_version:b.prompt_version,
  knowledge_version:b.knowledge_version,policy_version:b.policy_version,
  sid:c.sid,origin:websiteOrigin,scope:c.scope
 }),customer_identity_verified:false,hosted_rls_verified:false});
}
export async function processWebsiteMessage({request,resolveBinding,config,claimMessage,readQaCatalog,now=Date.now()}={}){
 if(!request||typeof request!=='object'||Array.isArray(request))return FAIL('BAD_MESSAGE_REQUEST');
 const expected=['token','origin','installationRef','eventId','text','requestedTool'];
 if(Object.keys(request).some(k=>!expected.includes(k)))return FAIL('CLIENT_TENANT_STORE_BOT_CLAIM_DENIED');
 const v=await verifyWebsiteSession({token:request.token,origin:request.origin,installationRef:request.installationRef,
  resolveBinding,config,now});
 if(v.status!=='SESSION_VERIFIED')return v;
 if(request.requestedTool!=='catalog_read')return FAIL('ORDER_OR_WRITE_TOOL_NOT_AUTHORIZED');
 if(typeof request.eventId!=='string'||!/^QA_MSG_[A-Z0-9_]{2,80}$/.test(request.eventId)||
 typeof request.text!=='string'||request.text.length===0||request.text.length>500)
 return FAIL('INVALID_TEXT_OR_MESSAGE_ID');
 // QA Core intentionally does not call a real model or Commerce database.
 if(config.qaMode!==true||typeof readQaCatalog!=='function'||typeof claimMessage!=='function')
 return FAIL('HOSTED_STORE_AND_DURABLE_CLAIM_NOT_CERTIFIED');
 const key=mac(config.keyring[config.activeKid],v.context.sid+'|'+request.eventId);
 let claimed;
 try{claimed=await claimMessage(key);}catch{return FAIL('ATOMIC_MESSAGE_CLAIM_UNAVAILABLE',503);}
 if(claimed==='duplicate')return Object.freeze({status:'DUPLICATE_IGNORED',http_status:200,provider_sends:0,model_calls:0,commerce_writes:0});
 if(claimed!=='claimed')return FAIL('ATOMIC_MESSAGE_CLAIM_NOT_CONFIRMED',503);
 let item;
 try{item=await readQaCatalog({tenant_ref:v.context.tenant_ref,store_ref:v.context.store_ref,sku:'QA_SKU_001'});}
 catch{return FAIL('QA_CATALOG_UNAVAILABLE',503);}
 if(!item||item.store_ref!==v.context.store_ref||item.tenant_ref!==v.context.tenant_ref||
 !Number.isSafeInteger(item.price_vnd)||item.price_vnd<=0||!Number.isSafeInteger(item.stock)||item.stock<0)
 return FAIL('CROSS_STORE_CATALOG_RESPONSE_DENIED');
 return Object.freeze({status:'QA_CATALOG_REPLY_PREPARED',channel:'website',
  store_ref:v.context.store_ref,bot_ref:v.context.bot_ref,bot_version:v.context.bot_version,
  prompt_version:v.context.prompt_version,knowledge_version:v.context.knowledge_version,
  price_vnd:item.price_vnd,stock:item.stock,reply:'Ví dụ QA: sản phẩm '+item.sku+' giá '+item.price_vnd+' VND, tồn '+item.stock+'.',
  customer_identity_verified:false,hosted_rls_verified:false,outbound:'MOCK_ONLY_NOT_SENT',
  provider_sends:0,model_calls:0,commerce_writes:0});
}

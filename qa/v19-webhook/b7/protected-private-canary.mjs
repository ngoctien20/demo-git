// TIEN404 V19.0-B7 — SOURCE-ONLY / LOCAL WORKER D1 PRIVATE CANARY.
 // No hosted Worker deployment, real Access JWT verification, external webhook,
 // real operator identity, provider credential, customer data or Commerce writes.
 // This simulates a signed private service caller permit with QA-only HMAC keys.
 // Default Worker module fetch is permanently 423 LOCKED.
const SHA=/^[0-9a-f]{64}$/;
const NAME=/^[a-z0-9_-]{8,64}$/;
const NONCE=/^[a-zA-Z0-9_-]{16,64}$/;
const FIXTURE="SYNTHETIC_PROTECTED_D1_ONLY";
const enc=new TextEncoder();
const deny=reason=>Object.freeze({
 decision:"DENY",reason,hostedBindingVerified:false,accessJwtVerified:false,
 providerIdentityVerified:false,storeAuthorityVerified:false,
 commerceReadAllowed:false,commerceWriteAllowed:false,
 providerSendAllowed:false,webhookPublished:false
});
export const NONCE_SQL=[
 "INSERT INTO v19_b7_qa_caller_nonces",
 "(caller_scope,nonce_hash,approved_fixture,claimed_at_ms)",
 "VALUES (?1,?2,'SYNTHETIC_PROTECTED_D1_ONLY',?3)",
 "ON CONFLICT(caller_scope,nonce_hash) DO NOTHING",
 "RETURNING claimed_at_ms"
].join(" ");
function canonical(p){
 return [p.issuer,p.audience,p.operator,p.bindingRef,p.issuedAtMs,
  p.expiresAtMs,p.nonce,p.fixture].join("|");
}
async function qaHmac(keyHex,message){
 if(!SHA.test(keyHex||""))throw Error("QA_KEY_INVALID");
 const bytes=Uint8Array.from(keyHex.match(/../g),s=>parseInt(s,16));
 const key=await crypto.subtle.importKey("raw",bytes,
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(message)));
}
function hex(bytes){
 return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
function constantEqual(a,b){
 if(a.length!==b.length)return false;
 let v=0;for(let i=0;i<a.length;i++)v|=a[i]^b[i];return v===0;
}
/** TEST-ONLY. Sign synthetic fixture permits, never real Access JWTs. */
export async function signQaPermit(permit,qaKeyHex){
 if(!permit||!SHA.test(qaKeyHex||""))throw Error("INVALID_SYNTHETIC_SIGN_INPUT");
 return hex(await qaHmac(qaKeyHex,canonical(permit)));
}
/** QA candidate. Do not treat any of this as a production Access validator.
 * Config must come from trusted local test bindings, not request headers.
 */
export async function inspectPrivateCanary({
 db,mode,permit,signatureHex,qaKeyHex,
 expectedIssuer,expectedAudience,expectedOperator,expectedBindingRef,
 nowMs
}={}){
 if(mode!=="B7_LOCAL_ONLY_HARD_LOCK" ||
   typeof db?.prepare!=="function"||!SHA.test(qaKeyHex||"")||
   !Number.isSafeInteger(nowMs)||nowMs<=0)return deny("LOCAL_MODE_OR_BINDING_NOT_AUTHORIZED");
 if(!permit||typeof permit!=="object"||Array.isArray(permit)||
   Object.keys(permit).length!==8 ||
   typeof permit.issuer!=="string"||!NAME.test(permit.issuer)||
   typeof permit.audience!=="string"||!NAME.test(permit.audience)||
   typeof permit.operator!=="string"||!NAME.test(permit.operator)||
   typeof permit.bindingRef!=="string"||!NAME.test(permit.bindingRef)||
   permit.issuer!==expectedIssuer||permit.audience!==expectedAudience||
   permit.operator!==expectedOperator||permit.bindingRef!==expectedBindingRef||
   permit.fixture!==FIXTURE||!NONCE.test(permit.nonce)||
   !Number.isSafeInteger(permit.issuedAtMs)||
   !Number.isSafeInteger(permit.expiresAtMs)||
   permit.issuedAtMs>nowMs||permit.issuedAtMs<nowMs-30_000||
   permit.expiresAtMs<=nowMs||permit.expiresAtMs>permit.issuedAtMs+60_000||
   !SHA.test(signatureHex||"")){
  return deny("INVALID_SYNTHETIC_PRIVATE_CALLER_PERMIT");
 }
 let good=false,scope,nonceHash;
 try{
  const expected=await qaHmac(qaKeyHex,canonical(permit));
  const actual=Uint8Array.from(signatureHex.match(/../g),s=>parseInt(s,16));
  good=constantEqual(expected,actual);
  if(good){
   scope=hex(await qaHmac(qaKeyHex,"scope:"+permit.operator+":"+permit.bindingRef));
   nonceHash=hex(await qaHmac(qaKeyHex,"nonce:"+permit.nonce));
  }
 }catch{return deny("SYNTHETIC_SIGNATURE_ERROR");}
 if(!good)return deny("SYNTHETIC_SIGNATURE_MISMATCH");
 let row;
 try{
  row=await db.prepare(NONCE_SQL).bind(scope,nonceHash,nowMs).first();
 }catch{return deny("D1_BINDING_OPERATION_FAILED");}
 if(!row)return deny("REPLAYED_SYNTHETIC_CALL");
 if(row.claimed_at_ms!==nowMs)return deny("D1_UNEXPECTED_RETURN");
 return Object.freeze({
  decision:"QA_LOCAL_D1_NONCE_CLAIMED_NO_SEND",
  hostedBindingVerified:false,
  accessJwtVerified:false,
  providerIdentityVerified:false,
  storeAuthorityVerified:false,
  commerceReadAllowed:false,
  commerceWriteAllowed:false,
  providerSendAllowed:false,
  webhookPublished:false
 });
}
export default {fetch(){return new Response(null,{status:423});}};

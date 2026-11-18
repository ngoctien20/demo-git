// TIEN404 AI V19.0-B6 — encrypted RECOVERABLE SYNTHETIC QA inbox.
// NO PRODUCTION; no actual Zalo webhook, customer data, secrets, Commerce access,
// n8n writes, external network, provider sends, or hosted D1 table migration.
// Default module Worker fetch hard-locks all requests (423).
// Crypto and D1 API are exercised only in isolated LOCAL workerd/Miniflare.

const RE_HEX64=/^[0-9a-f]{64}$/;
const RE_FIXTURE=/^QA_FIXTURE_[A-Z0-9_]{1,40}$/;
const RE_SYNTH=/^SYNTHETIC_[A-Z0-9_]{1,80}$/;
const KEY_VERSIONS=new Set(["QA_K1","QA_K2"]);
const MAX_TTL_MS=60*60*1000;
const encoder=new TextEncoder();
const decoder=new TextDecoder("utf-8",{fatal:true});

const deny=reason=>Object.freeze({
 decision:"DENY",reason,
 providerIdentityVerified:false,storeAuthorityVerified:false,
 ownerMembershipVerified:false,commerceReadAllowed:false,
 commerceWriteAllowed:false,providerSendAllowed:false,
 externalWebhookEnabled:false
});
const safe=(decision,fields={})=>Object.freeze({
 decision,...fields,
 providerIdentityVerified:false,storeAuthorityVerified:false,
 ownerMembershipVerified:false,commerceReadAllowed:false,
 commerceWriteAllowed:false,providerSendAllowed:false,
 externalWebhookEnabled:false
});
const isDb=db=>typeof db?.prepare==="function";
const correctInput=(db,scopeKey,eventKey,nowMs)=>isDb(db)&&
 RE_HEX64.test(scopeKey||"")&&RE_HEX64.test(eventKey||"")&&
 Number.isSafeInteger(nowMs)&&nowMs>0;
const leaseValid=s=>typeof s==="string"&&/^[0-9a-f-]{36}$/.test(s);
const aad=(scope,event,keyVersion)=>encoder.encode(
 "TIEN404_B6_AES256_GCM_V1|"+scope+"|"+event+"|"+keyVersion
);
const encodeHex=arr=>Array.from(arr).map(x=>x.toString(16).padStart(2,"0")).join("");
function decodeHex(s){
 if(!RE_HEX64.test(s||""))throw Error("KEY_INVALID");
 return Uint8Array.from(s.match(/.{2}/g),x=>parseInt(x,16));
}
async function aesKey(keyHex,usage){
 return crypto.subtle.importKey("raw",decodeHex(keyHex),{name:"AES-GCM"},
  false,[usage]);
}
async function digestWithPepper(pepper,message){
 if(typeof pepper!=="string"||pepper.length<32||pepper.length>256)
  throw Error("HASH_PEPPER_INVALID");
 const key=await crypto.subtle.importKey("raw",encoder.encode(pepper),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return encodeHex(new Uint8Array(await crypto.subtle.sign(
  "HMAC",key,encoder.encode(message)
 )));
}
async function runFirst(db,sql,params){
 try{return{ok:true,row:await db.prepare(sql).bind(...params).first()};}
 catch{return{ok:false,row:null};}
}

export const SQL=Object.freeze({
 admit:[
  "INSERT INTO v19_b6_qa_encrypted_inbox",
  "(scope_key,event_key,payload_digest,key_version,iv,encrypted_blob,fixture_ref,status,created_ms,updated_ms,expires_at_ms)",
  "VALUES (?1,?2,?3,?4,?5,?6,?7,'QA_READY_NO_SEND',?8,?8,?9)",
  "ON CONFLICT(scope_key,event_key) DO UPDATE SET",
  "observations=v19_b6_qa_encrypted_inbox.observations+1,",
  "updated_ms=excluded.updated_ms",
  "WHERE v19_b6_qa_encrypted_inbox.payload_digest=excluded.payload_digest",
  "AND v19_b6_qa_encrypted_inbox.fixture_ref=excluded.fixture_ref",
  "AND v19_b6_qa_encrypted_inbox.expires_at_ms>?8",
  "RETURNING status,observations,key_version"
 ].join(" "),
 claim:[
  "UPDATE v19_b6_qa_encrypted_inbox SET",
  "status='QA_LEASED_NO_SEND',attempts=attempts+1,",
  "lease_token=?4,lease_until_ms=?5,updated_ms=?3",
  "WHERE scope_key=?1 AND event_key=?2",
  "AND attempts<3 AND expires_at_ms>?5",
  "AND ((status IN ('QA_READY_NO_SEND','QA_RETRY_NO_SEND') AND next_attempt_ms<=?3)",
  "OR (status='QA_LEASED_NO_SEND' AND lease_until_ms<=?3))",
  "RETURNING status,attempts,lease_token"
 ].join(" "),
 replay:[
  "SELECT encrypted_blob,iv,key_version,payload_digest,fixture_ref",
  "FROM v19_b6_qa_encrypted_inbox WHERE scope_key=?1 AND event_key=?2",
  "AND status='QA_LEASED_NO_SEND' AND lease_token=?3",
  "AND lease_until_ms>?4 AND expires_at_ms>?4"
 ].join(" "),
 ack:[
  "UPDATE v19_b6_qa_encrypted_inbox SET",
  "status='QA_DONE_NO_SEND',lease_token=NULL,lease_until_ms=NULL,updated_ms=?4",
  "WHERE scope_key=?1 AND event_key=?2 AND lease_token=?3",
  "AND status='QA_LEASED_NO_SEND' AND lease_until_ms>?4 AND expires_at_ms>?4",
  "RETURNING status,attempts"
 ].join(" "),
 fail:[
  "UPDATE v19_b6_qa_encrypted_inbox SET",
  "status=CASE WHEN attempts>=3 THEN 'QA_DLQ_NO_SEND' ELSE 'QA_RETRY_NO_SEND' END,",
  "next_attempt_ms=?5,lease_token=NULL,lease_until_ms=NULL,updated_ms=?4",
  "WHERE scope_key=?1 AND event_key=?2 AND lease_token=?3",
  "AND status='QA_LEASED_NO_SEND' AND lease_until_ms>?4",
  "AND expires_at_ms>?4",
  "RETURNING status,attempts"
 ].join(" "),
 read:[
  "SELECT status,attempts,observations,key_version,expires_at_ms",
  "FROM v19_b6_qa_encrypted_inbox WHERE scope_key=?1 AND event_key=?2"
 ].join(" ")
});

/** Restricts inputs to synthetic fixture data. Real customer text is NOT accepted. */
function fixtureJson(fixtureRef,content){
 if(!RE_FIXTURE.test(fixtureRef||"")||!RE_SYNTH.test(content||""))
  throw Error("NOT_SYNTHETIC_QA");
 return JSON.stringify({kind:"TIEN404_B6_QA_ONLY",fixtureRef,content});
}
export async function admitEncryptedSynthetic(db,{
 scopeKey,eventKey,fixtureRef,content,rawKeyHex,keyVersion="QA_K1",
 digestPepper,nowMs,expiresAtMs
}={}){
 if(!correctInput(db,scopeKey,eventKey,nowMs)||
  !KEY_VERSIONS.has(keyVersion)||!RE_HEX64.test(rawKeyHex||"")||
  !Number.isSafeInteger(expiresAtMs)||expiresAtMs<=nowMs||
  expiresAtMs-nowMs>MAX_TTL_MS)return deny("INVALID_QA_CRYPTO_OR_TTL_CONFIG");
 let iv,ciphertext,payloadDigest;
 try{
  const plaintext=fixtureJson(fixtureRef,content);
  payloadDigest=await digestWithPepper(digestPepper,plaintext);
  const key=await aesKey(rawKeyHex,"encrypt");
  iv=crypto.getRandomValues(new Uint8Array(12));
  ciphertext=new Uint8Array(await crypto.subtle.encrypt(
   {name:"AES-GCM",iv,additionalData:aad(scopeKey,eventKey,keyVersion),tagLength:128},
   key,encoder.encode(plaintext)
  ));
 }catch{return deny("CRYPTO_OR_QA_FIXTURE_FAILED");}
 const out=await runFirst(db,SQL.admit,[
  scopeKey,eventKey,payloadDigest,keyVersion,iv,ciphertext,fixtureRef,nowMs,expiresAtMs
 ]);
 if(!out.ok)return deny("D1_ADMISSION_ERROR");
 if(!out.row)return deny("CONFLICTING_OR_EXPIRED_EVENT");
 if(out.row.key_version!==keyVersion||
  !Number.isInteger(out.row.observations)||out.row.observations<1)
  return deny("D1_UNEXPECTED_RESULT");
 return safe("QA_ENCRYPTED_RECEIPT_STORED_NO_SEND",{
  status:out.row.status,observations:out.row.observations
 });
}
export async function claimEncryptedSynthetic(db,{
 scopeKey,eventKey,nowMs,leaseMs=500
}={}){
 if(!correctInput(db,scopeKey,eventKey,nowMs)||
  !Number.isInteger(leaseMs)||leaseMs<100||leaseMs>10000||
  nowMs+leaseMs>Number.MAX_SAFE_INTEGER)return deny("INVALID_QA_LEASE");
 const token=crypto.randomUUID();
 const out=await runFirst(db,SQL.claim,[
  scopeKey,eventKey,nowMs,token,nowMs+leaseMs
 ]);
 if(!out.ok)return deny("D1_CLAIM_ERROR");
 if(!out.row)return deny("NOT_DUE_OR_EXPIRED");
 if(out.row.status!=="QA_LEASED_NO_SEND"||out.row.lease_token!==token||
  !Number.isInteger(out.row.attempts)||out.row.attempts<1||
  out.row.attempts>3)return deny("D1_UNEXPECTED_RESULT");
 // Lease token must stay within a protected local Worker context; never publish it.
 return safe("QA_ENCRYPTED_LEASE_GRANTED_NO_SEND",{
  attempts:out.row.attempts,leaseToken:token
 });
}
export async function recoverSyntheticWithLease(db,{
 scopeKey,eventKey,leaseToken,nowMs,keyRing,digestPepper
}={}){
 if(!correctInput(db,scopeKey,eventKey,nowMs)||!leaseValid(leaseToken)||
  !keyRing||typeof keyRing!=="object")return deny("INVALID_QA_RECOVERY_AUTH");
 const out=await runFirst(db,SQL.replay,[
  scopeKey,eventKey,leaseToken,nowMs
 ]);
 if(!out.ok)return deny("D1_READ_ERROR");
 if(!out.row)return deny("NO_ACTIVE_LEASE_OR_EVENT_EXPIRED");
 const x=out.row;
 if(!KEY_VERSIONS.has(x.key_version)||
  !RE_FIXTURE.test(x.fixture_ref||"")||
  !RE_HEX64.test(x.payload_digest||"")||
  !RE_HEX64.test(keyRing[x.key_version]||""))
   return deny("KEY_VERSION_OR_CIPHERTEXT_INVALID");
 try{
  const key=await aesKey(keyRing[x.key_version],"decrypt");
  const iv=x.iv instanceof Uint8Array?x.iv:new Uint8Array(x.iv);
  const encrypted=x.encrypted_blob instanceof Uint8Array?
   x.encrypted_blob:new Uint8Array(x.encrypted_blob);
  if(iv.byteLength!==12||encrypted.byteLength<17||encrypted.byteLength>4096)
   return deny("CIPHERTEXT_SHAPE_INVALID");
  const decoded=decoder.decode(await crypto.subtle.decrypt(
   {name:"AES-GCM",iv,additionalData:aad(scopeKey,eventKey,x.key_version),tagLength:128},
   key,encrypted
  ));
  const fingerprint=await digestWithPepper(digestPepper,decoded);
  if(fingerprint!==x.payload_digest)return deny("PAYLOAD_INTEGRITY_MISMATCH");
  const obj=JSON.parse(decoded);
  if(!obj||obj.kind!=="TIEN404_B6_QA_ONLY"||
    obj.fixtureRef!==x.fixture_ref||
    Object.keys(obj).length!==3 ||
    !RE_FIXTURE.test(obj.fixtureRef||"")||
    !RE_SYNTH.test(obj.content||""))
    return deny("DECRYPTED_QA_FIXTURE_INVALID");
  // This function is NEVER wired to public HTTP or to a real consumer.
  return safe("QA_ENCRYPTED_FIXTURE_RECOVERED_NO_SEND",{
   fixtureRef:obj.fixtureRef,syntheticContent:obj.content
  });
 }catch{return deny("DECRYPT_AUTH_OR_INTEGRITY_FAILED");}
}
export async function ackEncryptedSynthetic(db,{
 scopeKey,eventKey,leaseToken,nowMs
}={}){
 if(!correctInput(db,scopeKey,eventKey,nowMs)||!leaseValid(leaseToken))
  return deny("INVALID_QA_ACK");
 const out=await runFirst(db,SQL.ack,[scopeKey,eventKey,leaseToken,nowMs]);
 if(!out.ok)return deny("D1_ACK_ERROR");
 if(!out.row)return deny("STALE_LEASE_OR_EXPIRED");
 return safe("QA_ENCRYPTED_DONE_NO_SEND",{attempts:out.row.attempts});
}
export async function retryEncryptedSynthetic(db,{
 scopeKey,eventKey,leaseToken,nowMs,retryMs=500
}={}){
 if(!correctInput(db,scopeKey,eventKey,nowMs)||!leaseValid(leaseToken)||
  !Number.isInteger(retryMs)||retryMs<100||retryMs>60000)
  return deny("INVALID_QA_RETRY");
 const out=await runFirst(db,SQL.fail,[
  scopeKey,eventKey,leaseToken,nowMs,nowMs+retryMs
 ]);
 if(!out.ok)return deny("D1_RETRY_ERROR");
 if(!out.row)return deny("STALE_LEASE_OR_EXPIRED");
 if(!["QA_RETRY_NO_SEND","QA_DLQ_NO_SEND"].includes(out.row.status))
  return deny("D1_UNEXPECTED_RESULT");
 return safe(out.row.status,{attempts:out.row.attempts});
}
export async function inspectEncryptedReceipt(db,{scopeKey,eventKey,nowMs}={}){
 if(!correctInput(db,scopeKey,eventKey,nowMs))return deny("INVALID_QA_READ");
 const out=await runFirst(db,SQL.read,[scopeKey,eventKey]);
 if(!out.ok)return deny("D1_READ_ERROR");
 if(!out.row)return deny("NOT_FOUND");
 return safe("QA_RECEIPT_METADATA_NO_SEND",{
  status:out.row.status,
  attempts:out.row.attempts,
  observations:out.row.observations,
  expired:nowMs>=out.row.expires_at_ms,
  keyVersion:out.row.key_version
 });
}
// No deployable public endpoint. A review-only library with an explicit hard lock.
export default {fetch(){return new Response(null,{status:423});}};

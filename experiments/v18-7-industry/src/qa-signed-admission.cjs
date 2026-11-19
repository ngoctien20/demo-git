"use strict";
// TIEN404 V18.7.6 — SYNTHETIC QA ONLY. Not Meta/Zalo/Supabase authentication.
const {createHmac,timingSafeEqual}=require("node:crypto");
const ISSUER="tien404-qa-fixture",AUDIENCE="tien404-industry-qa";
const SCOPES=Object.freeze(["catalog:read","price:read","stock:read","quote:preview"]);
const CLAIMS=Object.freeze(["mode","iss","aud","subject_ref","tenant_key","store_key","installation_key","channel","profile_id","profile_version","config_version","knowledge_version","policy_version","issued_at","expires_at","receipt_id","nonce","scopes"]);
const USERS=Object.freeze({
 a:Object.freeze({tenant:"tenant_a",stores:Object.freeze(["store_a"]),active:true}),
 c:Object.freeze({tenant:"tenant_a",stores:Object.freeze(["store_c"]),active:true}),
 b:Object.freeze({tenant:"tenant_b",stores:Object.freeze(["store_b"]),active:true}),
 disabled:Object.freeze({tenant:"tenant_a",stores:Object.freeze(["store_a"]),active:false})
});
const BINDINGS=Object.freeze({
 "tenant_a/store_a":Object.freeze({profile_id:"grocery",version:"1.0.0"}),
 "tenant_a/store_c":Object.freeze({profile_id:"grocery",version:"1.0.0"}),
 "tenant_b/store_b":Object.freeze({profile_id:"building_materials",version:"1.0.0"})
});
const SOURCES=Object.freeze({
 "fb_a":Object.freeze({tenant:"tenant_a",store:"store_a",channel:"messenger",state:"connected_mock"}),
 "fb_c":Object.freeze({tenant:"tenant_a",store:"store_c",channel:"messenger",state:"connected_mock"}),
 "fb_b":Object.freeze({tenant:"tenant_b",store:"store_b",channel:"messenger",state:"connected_mock"}),
 "zalo_a":Object.freeze({tenant:"tenant_a",store:"store_a",channel:"zalo_oa",state:"connected_mock"}),
 "zalo_c":Object.freeze({tenant:"tenant_a",store:"store_c",channel:"zalo_oa",state:"connected_mock"}),
 "zalo_b":Object.freeze({tenant:"tenant_b",store:"store_b",channel:"zalo_oa",state:"connected_mock"}),
 "web_a":Object.freeze({tenant:"tenant_a",store:"store_a",channel:"website",state:"connected_mock"}),
 "web_c":Object.freeze({tenant:"tenant_a",store:"store_c",channel:"website",state:"connected_mock"}),
 "web_b":Object.freeze({tenant:"tenant_b",store:"store_b",channel:"website",state:"connected_mock"}),
 "fb_revoked":Object.freeze({tenant:"tenant_a",store:"store_a",channel:"messenger",state:"revoked"}),
 "fb_paused":Object.freeze({tenant:"tenant_a",store:"store_a",channel:"messenger",state:"paused"})
});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=o=>o!==null&&typeof o==="object"&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>own(o,k));
const denied=code=>Object.freeze({ok:false,code,status:"DENY",origin:"SYNTHETIC_QA",realAuthVerified:false,storeRlsVerified:false,canReadRealData:false,canSend:false,canWrite:false});
function createSyntheticAdmissionVerifier({testSigningKey,nowSeconds,mode}={}){
 if(mode!=="SYNTHETIC_QA_ONLY"||!Buffer.isBuffer(testSigningKey)||testSigningKey.length<32||!Number.isSafeInteger(nowSeconds)||nowSeconds<=0)throw Error("OFFLINE_QA_CONFIGURATION_REQUIRED");
 const seenReceipts=new Set(),seenNonces=new Set();
 return Object.freeze({verify(envelope){
   if(!exact(envelope,["payload","mac"]))return denied("ENVELOPE_INVALID");
   if(typeof envelope.payload!=="string"||Buffer.byteLength(envelope.payload,"utf8")>4096||Buffer.byteLength(envelope.payload,"utf8")<20)return denied("PAYLOAD_INVALID");
   if(typeof envelope.mac!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(envelope.mac))return denied("MAC_FORMAT_INVALID");
   const actual=Buffer.from(envelope.mac,"base64url");
   if(actual.length!==32||actual.toString("base64url")!==envelope.mac)return denied("MAC_FORMAT_INVALID");
   const expected=createHmac("sha256",testSigningKey).update(envelope.payload,"utf8").digest();
   if(!timingSafeEqual(actual,expected))return denied("MAC_INVALID");
   let c;try{c=JSON.parse(envelope.payload);}catch{return denied("PAYLOAD_JSON_INVALID");}
   if(!exact(c,CLAIMS))return denied("CLAIMS_INVALID");
   if(c.mode!=="SYNTHETIC_QA_ONLY")return denied("LIVE_MODE_FORBIDDEN");
   if(c.iss!==ISSUER||c.aud!==AUDIENCE)return denied("ISSUER_AUDIENCE_INVALID");
   if(!Number.isSafeInteger(c.issued_at)||!Number.isSafeInteger(c.expires_at)||c.expires_at<=c.issued_at||c.expires_at-c.issued_at>120||c.issued_at>nowSeconds+5||nowSeconds>c.expires_at)return denied("TIME_INVALID");
   if(typeof c.receipt_id!=="string"||!/^[A-Za-z0-9_-]{16,96}$/.test(c.receipt_id)||typeof c.nonce!=="string"||!/^[A-Za-z0-9_-]{16,96}$/.test(c.nonce))return denied("REPLAY_KEY_INVALID");
   if(seenReceipts.has(c.receipt_id)||seenNonces.has(c.nonce))return denied("REPLAY_DENIED");
   if(!Array.isArray(c.scopes)||c.scopes.length<1||c.scopes.length>SCOPES.length||new Set(c.scopes).size!==c.scopes.length||!c.scopes.every(s=>SCOPES.includes(s)))return denied("SCOPE_NOT_READONLY");
   for(const k of ["subject_ref","tenant_key","store_key","installation_key","channel","profile_id","profile_version","config_version","knowledge_version","policy_version"])
     if(typeof c[k]!=="string"||c[k].length<1||c[k].length>96)return denied("CLAIM_INVALID");
   if(c.policy_version!=="readonly-qa-v1"||c.config_version!=="config-qa-v1"||c.knowledge_version!=="knowledge-qa-v1")return denied("VERSION_NOT_APPROVED");
   if(!own(USERS,c.subject_ref)||!USERS[c.subject_ref].active)return denied("PRINCIPAL_DENIED");
   const u=USERS[c.subject_ref];
   if(c.tenant_key!==u.tenant||!u.stores.includes(c.store_key))return denied("STORE_MEMBERSHIP_DENIED");
   if(!own(SOURCES,c.installation_key))return denied("INSTALLATION_UNKNOWN");
   const s=SOURCES[c.installation_key];
   if(s.state!=="connected_mock")return denied("INSTALLATION_INACTIVE");
   if(s.tenant!==c.tenant_key||s.store!==c.store_key||s.channel!==c.channel)return denied("INSTALLATION_SCOPE_DENIED");
   const k=c.tenant_key+"/"+c.store_key;
   if(!own(BINDINGS,k)||BINDINGS[k].profile_id!==c.profile_id||BINDINGS[k].version!==c.profile_version)return denied("PROFILE_BINDING_DENIED");
   seenReceipts.add(c.receipt_id);seenNonces.add(c.nonce);
   return Object.freeze({ok:true,status:"SYNTHETIC_READONLY_PREVIEW",origin:"SYNTHETIC_QA",tenant_key:c.tenant_key,
     store_key:c.store_key,channel:c.channel,installation_key:c.installation_key,profile_id:c.profile_id,
     profile_version:c.profile_version,scopes:Object.freeze(c.scopes.slice()),receipt_id:c.receipt_id,
     realAuthVerified:false,storeRlsVerified:false,providerVerified:false,
     canReadRealData:false,canSend:false,canWrite:false,canReadPrivateOrder:false,productionReady:false});
 }});
}
module.exports={createSyntheticAdmissionVerifier,SCOPES,USERS,SOURCES,BINDINGS};

"use strict";
const test=require("node:test"), assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {createSyntheticAdmissionVerifier,USERS,SOURCES}=require("../src/qa-signed-admission.cjs");
const SECRET=Buffer.alloc(32,0x71); // synthetic test key; not a live secret
const NOW=Math.floor(Date.parse("2026-11-19T09:30:00Z")/1000);
const identities={a:{subject_ref:"a",tenant_key:"tenant_a",store_key:"store_a",installation_key:"fb_a",channel:"messenger",profile_id:"grocery"},c:{subject_ref:"c",tenant_key:"tenant_a",store_key:"store_c",installation_key:"fb_c",channel:"messenger",profile_id:"grocery"},b:{subject_ref:"b",tenant_key:"tenant_b",store_key:"store_b",installation_key:"fb_b",channel:"messenger",profile_id:"building_materials"}};
let seq=0;
function claims(who="a",patch={}){
 const id=String(++seq).padStart(18,"0");
 return {mode:"SYNTHETIC_QA_ONLY",iss:"tien404-qa-fixture",aud:"tien404-industry-qa",
 ...identities[who],profile_version:"1.0.0",config_version:"config-qa-v1",knowledge_version:"knowledge-qa-v1",policy_version:"readonly-qa-v1",
 issued_at:NOW-10,expires_at:NOW+60,receipt_id:"receipt_"+id,nonce:"nonce_"+id,
 scopes:["catalog:read","price:read","stock:read","quote:preview"],...patch};
}
function sign(c,key=SECRET){const payload=JSON.stringify(c);return {payload,mac:createHmac("sha256",key).update(payload).digest("base64url")};}
const verifier=()=>createSyntheticAdmissionVerifier({testSigningKey:SECRET,nowSeconds:NOW,mode:"SYNTHETIC_QA_ONLY"});
const verify=(patch={},who="a")=>verifier().verify(sign(claims(who,patch)));
const deny=(patch,code,who="a")=>assert.equal(verify(patch,who).code,code);
test("requires explicit synthetic mode",()=>assert.throws(()=>createSyntheticAdmissionVerifier({testSigningKey:SECRET,nowSeconds:NOW,mode:"LIVE"})));
test("rejects short signature key",()=>assert.throws(()=>createSyntheticAdmissionVerifier({testSigningKey:Buffer.alloc(8),nowSeconds:NOW,mode:"SYNTHETIC_QA_ONLY"})));
test("rejects client string clock",()=>assert.throws(()=>createSyntheticAdmissionVerifier({testSigningKey:SECRET,nowSeconds:"fake",mode:"SYNTHETIC_QA_ONLY"})));
for(const who of ["a","b","c"])test("owner "+who+" is not real authorized",()=>{const x=verify({},who);assert.equal(x.ok,true);assert.equal(x.canReadRealData,false);assert.equal(x.realAuthVerified,false);assert.equal(x.storeRlsVerified,false);assert.equal(x.canSend,false);assert.equal(x.canWrite,false);assert.equal(Object.isFrozen(x),true);});
for(const [channel,key] of [["messenger","fb_a"],["zalo_oa","zalo_a"],["website","web_a"]])test(channel+" source scope accepted as QA ONLY",()=>{const x=verify({installation_key:key,channel});assert.equal(x.ok,true);assert.equal(x.providerVerified,false);});
test("cannot claim Store C from Owner A same tenant",()=>deny({store_key:"store_c",installation_key:"fb_c"},"STORE_MEMBERSHIP_DENIED"));
test("cannot claim Store A from Owner C same tenant",()=>deny({store_key:"store_a",installation_key:"fb_a"},"STORE_MEMBERSHIP_DENIED","c"));
test("cannot claim Tenant B from Owner A",()=>deny({tenant_key:"tenant_b",store_key:"store_b",installation_key:"fb_b"},"STORE_MEMBERSHIP_DENIED"));
test("wrong installation same tenant blocked",()=>deny({installation_key:"fb_c"},"INSTALLATION_SCOPE_DENIED"));
test("wrong provider channel blocked",()=>deny({channel:"website"},"INSTALLATION_SCOPE_DENIED"));
test("unknown principal blocked",()=>deny({subject_ref:"unknown"},"PRINCIPAL_DENIED"));
test("inactive QA staff blocked",()=>deny({subject_ref:"disabled"},"PRINCIPAL_DENIED"));
test("wrong issuer",()=>deny({iss:"forged"},"ISSUER_AUDIENCE_INVALID"));
test("wrong audience",()=>deny({aud:"another"},"ISSUER_AUDIENCE_INVALID"));
test("real mode forbidden",()=>deny({mode:"LIVE"},"LIVE_MODE_FORBIDDEN"));
test("create order scope denied",()=>deny({scopes:["create_order"]},"SCOPE_NOT_READONLY"));
test("provider send scope denied",()=>deny({scopes:["provider_send"]},"SCOPE_NOT_READONLY"));
test("private order read scope denied",()=>deny({scopes:["order:private"]},"SCOPE_NOT_READONLY"));
test("empty scope denied",()=>deny({scopes:[]},"SCOPE_NOT_READONLY"));
test("duplicate scope denied",()=>deny({scopes:["catalog:read","catalog:read"]},"SCOPE_NOT_READONLY"));
test("wrong profile",()=>deny({profile_id:"building_materials"},"PROFILE_BINDING_DENIED"));
test("wrong profile version",()=>deny({profile_version:"2.0.0"},"PROFILE_BINDING_DENIED"));
test("unapproved policy",()=>deny({policy_version:"live"},"VERSION_NOT_APPROVED"));
test("unapproved knowledge",()=>deny({knowledge_version:"other"},"VERSION_NOT_APPROVED"));
test("unapproved config",()=>deny({config_version:"other"},"VERSION_NOT_APPROVED"));
test("revoked provider",()=>deny({installation_key:"fb_revoked"},"INSTALLATION_INACTIVE"));
test("paused provider",()=>deny({installation_key:"fb_paused"},"INSTALLATION_INACTIVE"));
test("unknown provider",()=>deny({installation_key:"fake"},"INSTALLATION_UNKNOWN"));
test("constructor key denied",()=>deny({installation_key:"constructor"},"INSTALLATION_UNKNOWN"));
test("expired receipt",()=>deny({expires_at:NOW-1},"TIME_INVALID"));
test("future receipt",()=>deny({issued_at:NOW+30,expires_at:NOW+50},"TIME_INVALID"));
test("overlong receipt ttl",()=>deny({expires_at:NOW+300},"TIME_INVALID"));
test("string expiry",()=>deny({expires_at:"tomorrow"},"TIME_INVALID"));
test("invalid nonce",()=>deny({nonce:""},"REPLAY_KEY_INVALID"));
test("short receipt id",()=>deny({receipt_id:"abc"},"REPLAY_KEY_INVALID"));
test("invalid tenant type",()=>deny({tenant_key:null},"CLAIM_INVALID"));
test("extra verified flag rejected",()=>deny({verified:true},"CLAIMS_INVALID"));
test("extra store-id override rejected",()=>deny({store_id:"store_c"},"CLAIMS_INVALID"));
test("extra admin role rejected",()=>deny({role:"admin"},"CLAIMS_INVALID"));
test("tampered payload invalid MAC",()=>{const x=sign(claims());const c=JSON.parse(x.payload);c.store_key="store_c";x.payload=JSON.stringify(c);assert.equal(verifier().verify(x).code,"MAC_INVALID");});
test("wrong signature test key",()=>assert.equal(verifier().verify(sign(claims(),Buffer.alloc(32,0x72))).code,"MAC_INVALID"));
test("short MAC",()=>{const x=sign(claims());x.mac="fake";assert.equal(verifier().verify(x).code,"MAC_FORMAT_INVALID");});
test("noncanonical MAC",()=>{const x=sign(claims());x.mac+="=";assert.equal(verifier().verify(x).code,"MAC_FORMAT_INVALID");});
test("bad JSON with signed MAC",()=>{const p="{not a JSON but plenty of bytes";const x={payload:p,mac:createHmac("sha256",SECRET).update(p).digest("base64url")};assert.equal(verifier().verify(x).code,"PAYLOAD_JSON_INVALID");});
test("unexpected envelope key",()=>{const x=sign(claims());x.jwt="fake";assert.equal(verifier().verify(x).code,"ENVELOPE_INVALID");});
test("replay same receipt",()=>{const v=verifier(),x=sign(claims());assert.equal(v.verify(x).ok,true);assert.equal(v.verify(x).code,"REPLAY_DENIED");});
test("nonce reused even new signed receipt",()=>{const v=verifier(),c=claims();assert.equal(v.verify(sign(c)).ok,true);const n=claims();n.nonce=c.nonce;assert.equal(v.verify(sign(n)).code,"REPLAY_DENIED");});
test("registry objects are frozen",()=>{assert.equal(Object.isFrozen(USERS),true);assert.equal(Object.isFrozen(SOURCES),true);assert.equal(Object.isFrozen(USERS.a.stores),true);});
test("no tool/transport callable returned",()=>{const x=verify();assert.equal(typeof x.send,"undefined");assert.equal(typeof x.query,"undefined");assert.equal(x.productionReady,false);});

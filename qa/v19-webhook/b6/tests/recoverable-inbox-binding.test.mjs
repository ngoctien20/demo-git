import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {Miniflare} from "miniflare";
import candidate,{
 admitEncryptedSynthetic,claimEncryptedSynthetic,recoverSyntheticWithLease,
 ackEncryptedSynthetic,retryEncryptedSynthetic,inspectEncryptedReceipt
} from "../recoverable-inbox-candidate.mjs";
import {assessStoreAuthorityPreflight} from "../store-authority-preflight.mjs";

const NOW=1795000000000;
const QA_KEY_1="1".repeat(64),QA_KEY_2="2".repeat(64);
const PEPPER="SYNTHETIC_QA_ONLY_PEPPER_"+"p".repeat(40);
const SCOPE="c".repeat(64), SCOPE_B="d".repeat(64);
const ev=char=>char.repeat(64);
const payload=(eventKey,extra={})=>({
 scopeKey:SCOPE,eventKey,
 fixtureRef:"QA_FIXTURE_ALPHA",
 content:"SYNTHETIC_ENCRYPTED_PAYLOAD",
 rawKeyHex:QA_KEY_1,keyVersion:"QA_K1",
 digestPepper:PEPPER,nowMs:NOW,expiresAtMs:NOW+200000,...extra
});
const workerPath=fileURLToPath(new URL("./local-encrypted-worker.mjs",import.meta.url));
const schema=readFileSync(new URL("../sql/001_local_encrypted_inbox_only.sql",import.meta.url),"utf8");
let mf,db;
before(async()=>{
 mf=new Miniflare({
  modules:true,scriptPath:workerPath,
  compatibilityDate:"2026-11-18",
  d1Databases:{QA_D1:"b6-ephemeral-local-only"},
  bindings:{B6_LOCAL_CI_MODE:"MINIFLARE_ONLY_NEVER_DEPLOY"}
 });
 db=await mf.getD1Database("QA_D1");
 const plain=schema.split("\n").filter(s=>!s.trimStart().startsWith("--")).join("\n");
 for(const statement of plain.split(";").map(s=>s.trim()).filter(Boolean)){
  await db.prepare(statement.replace(/\s+/g," ")).run();
 }
});
after(async()=>{if(mf)await mf.dispose();});
async function claim(eventKey,nowMs=NOW+1,leaseMs=1000,scopeKey=SCOPE){
 return claimEncryptedSynthetic(db,{scopeKey,eventKey,nowMs,leaseMs});
}
async function replay(eventKey,leaseToken,extra={}){
 return recoverSyntheticWithLease(db,{
  scopeKey:SCOPE,eventKey,leaseToken,nowMs:NOW+2,
  keyRing:{QA_K1:QA_KEY_1,QA_K2:QA_KEY_2},
  digestPepper:PEPPER,...extra
 });
}
test("B6 candidate itself is hard locked at 423",async()=>{
 assert.equal((await candidate.fetch()).status,423);
});
test("local Worker harness denies root, GET and forged query",async()=>{
 const cases=[
  ["http://localhost/",{method:"POST"}],
  ["http://localhost/__b6_local_qa__/encrypted?store=qa-store-b000001",{method:"POST",headers:{"x-b6-local-fixture":"SYNTHETIC_QA_ONLY"}}],
  ["http://localhost/__b6_local_qa__/encrypted",{method:"GET",headers:{"x-b6-local-fixture":"SYNTHETIC_QA_ONLY"}}]
 ];
 for(const [url,options] of cases){
  const response=await mf.dispatchFetch(url,options);
  assert.equal(response.status,423);
 }
});
test("real LOCAL workerd D1 binding encrypts, recovers and acknowledges synthetic event",async()=>{
 const res=await mf.dispatchFetch("http://localhost/__b6_local_qa__/encrypted",{
  method:"POST",headers:{"x-b6-local-fixture":"SYNTHETIC_QA_ONLY"}
 });
 assert.equal(res.status,200);
 const body=await res.json();
 assert.equal(body.admission,"QA_ENCRYPTED_RECEIPT_STORED_NO_SEND");
 assert.equal(body.claim,"QA_ENCRYPTED_LEASE_GRANTED_NO_SEND");
 assert.equal(body.recover,"QA_ENCRYPTED_FIXTURE_RECOVERED_NO_SEND");
 assert.equal(body.ack,"QA_ENCRYPTED_DONE_NO_SEND");
 assert.equal(body.storeAuthorityVerified,false);
 assert.equal(body.providerSendAllowed,false);
 assert.equal(body.orderWriteAllowed,false);
 assert.equal(JSON.stringify(body).includes("SYNTHETIC_LOCAL_WORKER"),false);
});
test("local D1 stores ciphertext and nonce, never plaintext, customer or store identifiers",async()=>{
 const row=await db.prepare("SELECT scope_key,event_key,encrypted_blob,iv,status FROM v19_b6_qa_encrypted_inbox WHERE scope_key=?1 AND event_key=?2")
 .bind(ev("a"),ev("b")).first();
 assert.ok(row);
 assert.equal(row.status,"QA_DONE_NO_SEND");
 assert.equal(new Uint8Array(row.iv).length,12);
 assert.ok(new Uint8Array(row.encrypted_blob).length>16);
 const bytes=Array.from(new Uint8Array(row.encrypted_blob));
 assert.equal(new TextDecoder().decode(Uint8Array.from(bytes)).includes("SYNTHETIC_LOCAL_WORKER"),false);
 assert.equal(JSON.stringify(row).includes("qa-store"),false);
});
test("exact duplicate keeps one row and does not rotate ciphertext or status",async()=>{
 const e=ev("f");
 assert.equal((await admitEncryptedSynthetic(db,payload(e))).decision,"QA_ENCRYPTED_RECEIPT_STORED_NO_SEND");
 const before=await db.prepare("SELECT encrypted_blob,iv FROM v19_b6_qa_encrypted_inbox WHERE scope_key=? AND event_key=?").bind(SCOPE,e).first();
 assert.equal((await admitEncryptedSynthetic(db,payload(e))).decision,"QA_ENCRYPTED_RECEIPT_STORED_NO_SEND");
 const afterRow=await db.prepare("SELECT encrypted_blob,iv,observations FROM v19_b6_qa_encrypted_inbox WHERE scope_key=? AND event_key=?").bind(SCOPE,e).first();
 assert.equal(afterRow.observations,2);
 assert.deepEqual(Array.from(afterRow.iv),Array.from(before.iv));
 assert.deepEqual(Array.from(afterRow.encrypted_blob),Array.from(before.encrypted_blob));
});
test("same ID with changed payload or key version fails closed without row mutation",async()=>{
 const e=ev("e");
 await admitEncryptedSynthetic(db,payload(e));
 assert.equal((await admitEncryptedSynthetic(db,payload(e,{content:"SYNTHETIC_ALTERED"}))).decision,"DENY");
 assert.equal((await admitEncryptedSynthetic(db,payload(e,{keyVersion:"QA_K2",rawKeyHex:QA_KEY_2}))).decision,"DENY");
 const row=await db.prepare("SELECT observations,key_version FROM v19_b6_qa_encrypted_inbox WHERE scope_key=? AND event_key=?").bind(SCOPE,e).first();
 assert.equal(row.observations,1);
 assert.equal(row.key_version,"QA_K1");
});
test("different installation scope allows matching event hash with isolated ciphertext",async()=>{
 const e=ev("d");
 await admitEncryptedSynthetic(db,payload(e));
 await admitEncryptedSynthetic(db,payload(e,{scopeKey:SCOPE_B}));
 const rows=await db.prepare("SELECT scope_key FROM v19_b6_qa_encrypted_inbox WHERE event_key=?").bind(e).all();
 assert.equal(rows.results.length,2);
 assert.equal(new Set(rows.results.map(x=>x.scope_key)).size,2);
});
test("wrong scope or missing lease never returns decrypted payload",async()=>{
 const e=ev("c");
 await admitEncryptedSynthetic(db,payload(e));
 const wrong=await recoverSyntheticWithLease(db,{scopeKey:SCOPE_B,eventKey:e,leaseToken:crypto.randomUUID(),nowMs:NOW+5,keyRing:{QA_K1:QA_KEY_1},digestPepper:PEPPER});
 assert.equal(wrong.decision,"DENY");
 assert.equal((await replay(e,crypto.randomUUID())).decision,"DENY");
});
test("correct lease recovers synthetic event, rejects wrong decryption key and digest pepper",async()=>{
 const e=ev("9");
 await admitEncryptedSynthetic(db,payload(e,{keyVersion:"QA_K2",rawKeyHex:QA_KEY_2}));
 const lease=await claim(e);
 assert.equal(lease.decision,"QA_ENCRYPTED_LEASE_GRANTED_NO_SEND");
 const invalidKey=await replay(e,lease.leaseToken,{keyRing:{QA_K2:QA_KEY_1}});
 assert.equal(invalidKey.decision,"DENY");
 const wrongPepper=await replay(e,lease.leaseToken,{digestPepper:"SYNTHETIC_ANOTHER_PEPPER_"+"b".repeat(40)});
 assert.equal(wrongPepper.decision,"DENY");
 const ok=await replay(e,lease.leaseToken);
 assert.equal(ok.decision,"QA_ENCRYPTED_FIXTURE_RECOVERED_NO_SEND");
 assert.equal(ok.syntheticContent,"SYNTHETIC_ENCRYPTED_PAYLOAD");
 assert.equal(ok.storeAuthorityVerified,false);
});
test("wrong AAD: ciphertext moved across event key cannot be decrypted",async()=>{
 const e1=ev("8"),e2=ev("7");
 await admitEncryptedSynthetic(db,payload(e1));
 await admitEncryptedSynthetic(db,payload(e2));
 const lease=await claim(e1);
 const rec=await db.prepare("SELECT encrypted_blob,iv FROM v19_b6_qa_encrypted_inbox WHERE scope_key=? AND event_key=?").bind(SCOPE,e2).first();
 await db.prepare("UPDATE v19_b6_qa_encrypted_inbox SET encrypted_blob=?1,iv=?2 WHERE scope_key=?3 AND event_key=?4").bind(rec.encrypted_blob,rec.iv,SCOPE,e1).run();
 assert.equal((await replay(e1,lease.leaseToken)).decision,"DENY");
});
test("ciphertext tamper fails closed instead of returning plaintext",async()=>{
 const e=ev("6");
 await admitEncryptedSynthetic(db,payload(e));
 const lease=await claim(e);
 const stored=await db.prepare("SELECT encrypted_blob FROM v19_b6_qa_encrypted_inbox WHERE scope_key=? AND event_key=?").bind(SCOPE,e).first();
 const mutated=new Uint8Array(stored.encrypted_blob);
 mutated[0]^=1;
 await db.prepare("UPDATE v19_b6_qa_encrypted_inbox SET encrypted_blob=?1 WHERE scope_key=?2 AND event_key=?3").bind(mutated,SCOPE,e).run();
 const result=await replay(e,lease.leaseToken);
 assert.equal(result.decision,"DENY");
});
test("expired event refuses lease, recovery and a new duplicate admission",async()=>{
 const e=ev("5");
 await admitEncryptedSynthetic(db,payload(e,{expiresAtMs:NOW+1000}));
 assert.equal((await claim(e,NOW+1001,500)).decision,"DENY");
 assert.equal((await admitEncryptedSynthetic(db,payload(e,{nowMs:NOW+1001,expiresAtMs:NOW+1100}))).decision,"DENY");
 const status=await inspectEncryptedReceipt(db,{scopeKey:SCOPE,eventKey:e,nowMs:NOW+1001});
 assert.equal(status.expired,true);
});
test("lease recovered once; stale lease cannot ACK after timeouts",async()=>{
 const e=ev("4");
 await admitEncryptedSynthetic(db,payload(e));
 const old=await claim(e,NOW+1,100);
 assert.equal(old.decision,"QA_ENCRYPTED_LEASE_GRANTED_NO_SEND");
 const newLease=await claim(e,NOW+102,200);
 assert.equal(newLease.decision,"QA_ENCRYPTED_LEASE_GRANTED_NO_SEND");
 const stale=await ackEncryptedSynthetic(db,{scopeKey:SCOPE,eventKey:e,leaseToken:old.leaseToken,nowMs:NOW+103});
 assert.equal(stale.decision,"DENY");
 const done=await ackEncryptedSynthetic(db,{scopeKey:SCOPE,eventKey:e,leaseToken:newLease.leaseToken,nowMs:NOW+104});
 assert.equal(done.decision,"QA_ENCRYPTED_DONE_NO_SEND");
});
test("one of twelve concurrent D1 lease claims wins, no double processing",async()=>{
 const e=ev("3");await admitEncryptedSynthetic(db,payload(e));
 const decisions=await Promise.all(Array.from({length:12},()=>claim(e)));
 assert.equal(decisions.filter(x=>x.decision==="QA_ENCRYPTED_LEASE_GRANTED_NO_SEND").length,1);
 const row=await db.prepare("SELECT attempts FROM v19_b6_qa_encrypted_inbox WHERE scope_key=? AND event_key=?").bind(SCOPE,e).first();
 assert.equal(row.attempts,1);
});
test("bounded retries move to DLQ with no provider or Commerce output",async()=>{
 const e=ev("2");await admitEncryptedSynthetic(db,payload(e));
 let now=NOW+1;
 for(let i=1;i<=3;i++){
  const leased=await claim(e,now,200);
  assert.equal(leased.decision,"QA_ENCRYPTED_LEASE_GRANTED_NO_SEND");
  const result=await retryEncryptedSynthetic(db,{scopeKey:SCOPE,eventKey:e,leaseToken:leased.leaseToken,nowMs:now+1,retryMs:100});
  assert.equal(result.decision,i===3?"QA_DLQ_NO_SEND":"QA_RETRY_NO_SEND");
  now+=150;
 }
 assert.equal((await claim(e,now)).decision,"DENY");
 assert.equal((await inspectEncryptedReceipt(db,{scopeKey:SCOPE,eventKey:e,nowMs:now})).status,"QA_DLQ_NO_SEND");
});
test("missing key, excessive TTL, non-synthetic payload and invalid scope are denied",async()=>{
 const e=ev("1");
 for(const changes of [
  {rawKeyHex:"bad"},{expiresAtMs:NOW+3600001},{content:"actual customer phone:123"},
  {scopeKey:"fake"},{keyVersion:"PRODUCTION_KMS"},
  {fixtureRef:"CUSTOMER_MESSAGE"}
 ]){
  assert.equal((await admitEncryptedSynthetic(db,payload(e,changes))).decision,"DENY");
 }
});
test("Store preflight fails on actual observed staging schema gaps",()=>{
 const rows=["orders","products","customers","conversations"].map(table_name=>({
  table_name,has_tenant_id:true,has_store_id:false
 }));
 const audit=assessStoreAuthorityPreflight({schemaRows:rows});
 assert.equal(audit.decision,"BLOCKED");
 assert.ok(audit.reasons.includes("MISSING_STORE_ID_ORDERS"));
 assert.ok(audit.reasons.includes("MISSING_STORE_ID_PRODUCTS"));
 assert.equal(audit.commerceReadAllowed,false);
 assert.equal(audit.commerceWriteAllowed,false);
});
test("forged all-VERIFIED booleans are not authorization or release",()=>{
 const rows=["orders","products","customers","conversations"].map(table_name=>({
  table_name,has_tenant_id:true,has_store_id:true
 }));
 const x=assessStoreAuthorityPreflight({
  schemaRows:rows,membershipEvidence:"VERIFIED",
  ownerAOwnerBSessionEvidence:"VERIFIED",negativeRlsEvidence:"VERIFIED",
  providerBindingEvidence:"VERIFIED",gatewayAdmissionEvidence:"VERIFIED"
 });
 assert.equal(x.decision,"BLOCKED");
 assert.ok(x.reasons.includes("INDEPENDENT_SECURITY_APPROVAL_REQUIRED"));
 assert.equal(x.productionAllowed,false);
 assert.equal(x.commerceReadAllowed,false);
 assert.equal(x.webhookReleaseAllowed,false);
});

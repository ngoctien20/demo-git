// V19.0-B5: LOCAL Miniflare/workerd D1 binding test, not cloud-hosted Worker.
// All messages, Bot installations, tenants, stores and event keys are SYNTHETIC.
import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {
 admitSynthetic,claimSynthetic,finishSynthetic,retrySynthetic,
 sweepSyntheticExpiredLease,readSyntheticReceipt
} from "../durable-inbox-contract.mjs";

const NOW=1795000000000;
const SHA_A="1".repeat(64);
const INSTALL_A="qa-install-"+"a".repeat(20);
const scope="a".repeat(64);
const event1="b".repeat(64),event2="c".repeat(64),event3="d".repeat(64);
const hash="e".repeat(64);
const workerPath=fileURLToPath(new URL("./local-binding-worker.mjs",import.meta.url));
const schemaRegistry=readFileSync(new URL("../../b4/sql/001_disposable_registry_only.sql",import.meta.url),"utf8");
const schemaB5=readFileSync(new URL("../sql/001_local_worker_binding_qa.sql",import.meta.url),"utf8");
let mf,db;

before(async()=>{
 mf=new Miniflare({
  modules:true,scriptPath:workerPath,
  compatibilityDate:"2026-11-18",
  d1Databases:{QA_D1:"b5-local-only-ephemeral"},
  bindings:{B5_LOCAL_MODE:"MINIFLARE_UNDEPLOYABLE_QA"}
 });
 db=await mf.getD1Database("QA_D1");
 await db.exec(schemaRegistry);
 await db.exec(schemaB5);
 await db.prepare(
  "INSERT INTO v19_b4_installation_registry "+
  "(installation_ref,provider,environment,tenant_ref,store_ref,status,proof_kind,"+
  "binding_sha256,registry_revision,effective_from_ms,expires_at_ms) "+
  "VALUES (?1,'zalo_bot','staging','qa-tenant-shared0001','qa-store-a000001',"+
  "'QA_LOCKED','SYNTHETIC_FIXTURE_ONLY',?2,1,?3,?4)"
 ).bind(INSTALL_A,SHA_A,NOW-1000,NOW+10000).run();
});
after(async()=>{if(mf)await mf.dispose();});

async function fetchQa(path="/__b5_local_runtime__/synthetic",opts={}){
 return mf.dispatchFetch("http://localhost:8787"+path,{
  method:opts.method||"POST",
  headers:{"x-b5-fixture":opts.fixture||"LOCAL_SYNTHETIC_ONLY"}
 });
}
test("Worker stays 423 for root, wrong method, wrong fixture and client-selected Store",async()=>{
 for(const [url,opts] of [
  ["/",{}],["/__b5_local_runtime__/synthetic",{method:"GET"}],
  ["/__b5_local_runtime__/synthetic",{fixture:"REAL_ZALO_MESSAGE"}],
  ["/__b5_local_runtime__/synthetic?store_id=qa-store-b000001",{}]
 ]){
  const r=await fetchQa(url,opts);
  assert.equal(r.status,423);
 }
});
test("actual Worker binding .all() registry and .first() inbox/lease/retry execute inside workerd",async()=>{
 const r=await fetchQa();
 assert.equal(r.status,200);
 const out=await r.json();
 assert.equal(out.verdict,"QA_RECEIPT_PERSISTED_NO_SEND");
 assert.equal(out.scope,true);
 assert.equal(out.claim,"QA_LEASE_GRANTED_NO_SEND");
 assert.equal(out.retry,"QA_RETRY_NO_SEND");
 assert.equal(out.receipt,"QA_STATE_READ_ONLY");
 assert.equal(out.state,"QA_RETRY_NO_SEND");
 assert.equal(out.writesAllowed,false);
 assert.equal(out.providerSend,false);
 assert.equal(out.realStoreAuthority,false);
});
test("a duplicate synthetic Worker dispatch persists one inbox row, increments delivery count",async()=>{
 const r=await fetchQa();
 assert.equal(r.status,200);
 const count=await db.prepare("SELECT COUNT(*) AS n,MAX(delivery_observations) AS deliveries FROM v19_b5_qa_inbox").first();
 assert.equal(count.n,1);
 assert.equal(count.deliveries,2);
});
test("no real credentials, raw payload or Store IDs are persisted in inbox",async()=>{
 const result=await db.prepare("SELECT * FROM v19_b5_qa_inbox").all();
 assert.equal(result.success,true);
 assert.equal(result.results.length,1);
 const txt=JSON.stringify(result.results);
 assert.equal(txt.includes(INSTALL_A),false);
 assert.equal(txt.includes("qa-store-a000001"),false);
 assert.equal(txt.includes("SYNTHETIC_ALPHA"),false);
 assert.equal(txt.includes("qa-tenant-shared0001"),false);
 assert.match(result.results[0].scope_key,/^[0-9a-f]{64}$/);
 assert.equal(result.results[0].fixture_ref,"QA_FIXTURE_ALPHA");
});
test("local D1 binding claim after retry due can complete; old lease no longer works",async()=>{
 const rows=await db.prepare("SELECT scope_key,event_key FROM v19_b5_qa_inbox").first();
 const claim=await claimSynthetic(db,{
  scopeKey:rows.scope_key,eventKey:rows.event_key,nowMs:NOW+600,leaseMs:1000
 });
 assert.equal(claim.decision,"QA_LEASE_GRANTED_NO_SEND");
 const complete=await finishSynthetic(db,{
  scopeKey:rows.scope_key,eventKey:rows.event_key,
  leaseToken:claim.leaseToken,nowMs:NOW+620
 });
 assert.equal(complete.decision,"QA_DONE_NO_SEND");
 const oldAck=await finishSynthetic(db,{
  scopeKey:rows.scope_key,eventKey:rows.event_key,
  leaseToken:claim.leaseToken,nowMs:NOW+630
 });
 assert.equal(oldAck.decision,"DENY");
 const final=await readSyntheticReceipt(db,{
  scopeKey:rows.scope_key,eventKey:rows.event_key,nowMs:NOW+640
 });
 assert.equal(final.status,"QA_DONE_NO_SEND");
});
test("a completed event remains DONE after a duplicate synthetic admission",async()=>{
 const r=await fetchQa();
 assert.equal(r.status,200);
 const row=await db.prepare("SELECT status,delivery_observations FROM v19_b5_qa_inbox").first();
 assert.equal(row.status,"QA_DONE_NO_SEND");
 assert.equal(row.delivery_observations,3);
});
test("parallel synthetic claims permit ONE lease token only",async()=>{
 const admitted=await admitSynthetic(db,{
  scopeKey:scope,eventKey:event1,payloadHash:hash,
  fixtureRef:"QA_FIXTURE_PARALLEL",nowMs:NOW
 });
 assert.equal(admitted.decision,"QA_RECEIPT_PERSISTED_NO_SEND");
 const claims=await Promise.all(
  Array.from({length:10},()=>claimSynthetic(db,{scopeKey:scope,eventKey:event1,nowMs:NOW,leaseMs:2000}))
 );
 assert.equal(claims.filter(c=>c.decision==="QA_LEASE_GRANTED_NO_SEND").length,1);
 assert.equal(claims.filter(c=>c.decision==="DENY").length,9);
 const receipt=await readSyntheticReceipt(db,{scopeKey:scope,eventKey:event1,nowMs:NOW});
 assert.equal(receipt.attempts,1);
});
test("cannot finish an expired lease, and can re-claim it only once",async()=>{
 const first=await claimSynthetic(db,{scopeKey:scope,eventKey:event1,nowMs:NOW});
 assert.equal(first.decision,"DENY"); // lease already owned and not expired
 const before=await db.prepare("SELECT lease_token,lease_until_ms FROM v19_b5_qa_inbox WHERE scope_key=? AND event_key=?").bind(scope,event1).first();
 const expired=await finishSynthetic(db,{scopeKey:scope,eventKey:event1,leaseToken:before.lease_token,nowMs:before.lease_until_ms});
 assert.equal(expired.decision,"DENY");
 const reclaim=await claimSynthetic(db,{scopeKey:scope,eventKey:event1,nowMs:before.lease_until_ms+1,leaseMs:500});
 assert.equal(reclaim.decision,"QA_LEASE_GRANTED_NO_SEND");
 const staleAck=await finishSynthetic(db,{scopeKey:scope,eventKey:event1,leaseToken:before.lease_token,nowMs:before.lease_until_ms+2});
 assert.equal(staleAck.decision,"DENY");
});
test("changed payload replay is rejected while preserving existing inbox record",async()=>{
 const first=await admitSynthetic(db,{scopeKey:scope,eventKey:event2,payloadHash:hash,fixtureRef:"QA_FIXTURE_BETA",nowMs:NOW});
 assert.equal(first.decision,"QA_RECEIPT_PERSISTED_NO_SEND");
 const conflict=await admitSynthetic(db,{scopeKey:scope,eventKey:event2,payloadHash:"f".repeat(64),fixtureRef:"QA_FIXTURE_BETA",nowMs:NOW});
 assert.deepEqual([conflict.decision,conflict.reason],["DENY","CONFLICTING_EVENT_ID_OR_PAYLOAD"]);
 const rec=await db.prepare("SELECT payload_hash,delivery_observations FROM v19_b5_qa_inbox WHERE scope_key=? AND event_key=?").bind(scope,event2).first();
 assert.equal(rec.payload_hash,hash);
 assert.equal(rec.delivery_observations,1);
});
test("three synthetic failures transition to DLQ and never call provider",async()=>{
 assert.equal((await admitSynthetic(db,{scopeKey:scope,eventKey:event3,payloadHash:hash,fixtureRef:"QA_FIXTURE_GAMMA",nowMs:NOW})).decision,"QA_RECEIPT_PERSISTED_NO_SEND");
 let now=NOW;
 for(let i=1;i<=3;i++){
  const claim=await claimSynthetic(db,{scopeKey:scope,eventKey:event3,nowMs:now,leaseMs:500});
  assert.equal(claim.decision,"QA_LEASE_GRANTED_NO_SEND");
  const failure=await retrySynthetic(db,{
   scopeKey:scope,eventKey:event3,nowMs:now+1,leaseToken:claim.leaseToken,
   retryAfterMs:200,errorCode:"QA_SYNTHETIC_FAILURE"
  });
  assert.equal(failure.decision,i<3?"QA_RETRY_NO_SEND":"QA_DLQ_NO_SEND");
  now+=500;
 }
 assert.equal((await claimSynthetic(db,{scopeKey:scope,eventKey:event3,nowMs:now})).decision,"DENY");
 assert.equal((await readSyntheticReceipt(db,{scopeKey:scope,eventKey:event3,nowMs:now})).status,"QA_DLQ_NO_SEND");
});
test("lease exhausts without ACK: expire then sweep to DLQ",async()=>{
 const s="9".repeat(64),e="8".repeat(64);
 assert.equal((await admitSynthetic(db,{scopeKey:s,eventKey:e,payloadHash:hash,fixtureRef:"QA_FIXTURE_EXPIRY",nowMs:NOW})).decision,"QA_RECEIPT_PERSISTED_NO_SEND");
 let now=NOW;
 for(let i=1;i<=3;i++){
  const claim=await claimSynthetic(db,{scopeKey:s,eventKey:e,nowMs:now,leaseMs:100});
  assert.equal(claim.decision,"QA_LEASE_GRANTED_NO_SEND");
  now+=101;
 }
 const sweep=await sweepSyntheticExpiredLease(db,{scopeKey:s,eventKey:e,nowMs:now});
 assert.equal(sweep.decision,"QA_DLQ_NO_SEND");
});

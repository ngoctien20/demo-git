import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {Miniflare} from "miniflare";
import candidate,{signQaPermit,inspectPrivateCanary} from "../protected-private-canary.mjs";
const KEY="a".repeat(64); // synthetic only
const NOW=1795000000000;
const allow={
 expectedIssuer:"b7-qa-issuer",expectedAudience:"b7-private-d1",
 expectedOperator:"b7-qa-operator",expectedBindingRef:"b7-qa-binding"
};
const permit=(nonce="synthetic_nonce_000000001",overrides={})=>({
 issuer:allow.expectedIssuer,audience:allow.expectedAudience,
 operator:allow.expectedOperator,bindingRef:allow.expectedBindingRef,
 issuedAtMs:NOW,expiresAtMs:NOW+30000,nonce,
 fixture:"SYNTHETIC_PROTECTED_D1_ONLY",...overrides
});
const workerPath=fileURLToPath(new URL("./local-private-canary-worker.mjs",import.meta.url));
const schema=readFileSync(new URL("../sql/001_local_private_canary_only.sql",import.meta.url),"utf8");
let mf,db;
before(async()=>{
 mf=new Miniflare({
  modules:true,scriptPath:workerPath,
  compatibilityDate:"2026-11-18",
  d1Databases:{QA_D1:"b7-local-ephemeral"},
  bindings:{B7_LOCAL_TEST_ONLY:"B7_MINIFLARE_UNDEPLOYABLE"}
 });
 db=await mf.getD1Database("QA_D1");
 const ddl=schema.split("\n").filter(x=>!x.trimStart().startsWith("--")).join(" ");
 for(const statement of ddl.split(";").map(x=>x.trim()).filter(Boolean))
  await db.prepare(statement.replace(/\s+/g," ")).run();
});
after(async()=>{if(mf)await mf.dispose();});
async function inspect(p,overrides={}){
 return inspectPrivateCanary({
  db,mode:"B7_LOCAL_ONLY_HARD_LOCK",permit:p,
  signatureHex:await signQaPermit(p,KEY),qaKeyHex:KEY,...allow,nowMs:NOW+1,
  ...overrides
 });
}
test("candidate Worker default fetch permanently locked 423",async()=>{
 assert.equal((await candidate.fetch()).status,423);
});
test("Miniflare harness root and unauthenticated fixture path are locked",async()=>{
 const a=await mf.dispatchFetch("http://localhost/",{method:"POST"});
 const b=await mf.dispatchFetch("http://localhost/__b7_local__/private-binding",{method:"POST"});
 const c=await mf.dispatchFetch("http://localhost/__b7_local__/private-binding?store_id=fake",{
  method:"POST",headers:{"x-b7-synthetic-fixture":"LOCAL_TEST_ONLY"}
 });
 assert.equal(a.status,423);assert.equal(b.status,423);assert.equal(c.status,423);
});
test("exact local workerd D1 binding accepts one strictly synthetic caller fixture",async()=>{
 const r=await mf.dispatchFetch("http://localhost/__b7_local__/private-binding",{
  method:"POST",headers:{"x-b7-synthetic-fixture":"LOCAL_TEST_ONLY"}
 });
 assert.equal(r.status,200);
 const result=await r.json();
 assert.equal(result.decision,"QA_LOCAL_D1_NONCE_CLAIMED_NO_SEND");
 for(const k of ["hostedBindingVerified","accessJwtVerified","providerIdentityVerified",
  "storeAuthorityVerified","commerceReadAllowed","commerceWriteAllowed","webhookPublished"]){
  assert.equal(result[k],false);
 }
});
test("replay exact fixture through Worker yields synthetic conflict without another row",async()=>{
 const r=await mf.dispatchFetch("http://localhost/__b7_local__/private-binding",{
  method:"POST",headers:{"x-b7-synthetic-fixture":"LOCAL_TEST_ONLY"}
 });
 assert.equal(r.status,409);
 const row=await db.prepare("SELECT COUNT(*) AS n FROM v19_b7_qa_caller_nonces").first();
 assert.equal(row.n,1);
});
test("another signed synthetic nonce is accepted by the same local D1",async()=>{
 const q=await inspect(permit("synthetic_nonce_000000002"));
 assert.equal(q.decision,"QA_LOCAL_D1_NONCE_CLAIMED_NO_SEND");
});
test("20 parallel identically signed permits admit exactly once",async()=>{
 const p=permit("synthetic_nonce_parallel_0001");
 const sig=await signQaPermit(p,KEY);
 const arr=await Promise.all(Array.from({length:20},()=>inspectPrivateCanary({
  db,mode:"B7_LOCAL_ONLY_HARD_LOCK",permit:p,signatureHex:sig,
  qaKeyHex:KEY,...allow,nowMs:NOW+1
 })));
 assert.equal(arr.filter(x=>x.decision==="QA_LOCAL_D1_NONCE_CLAIMED_NO_SEND").length,1);
 assert.equal(arr.filter(x=>x.reason==="REPLAYED_SYNTHETIC_CALL").length,19);
});
test("forged signature fails before D1 insertion",async()=>{
 const p=permit("synthetic_nonce_signature_0001");
 const x=await inspect(p,{signatureHex:"f".repeat(64)});
 assert.deepEqual([x.decision,x.reason],["DENY","SYNTHETIC_SIGNATURE_MISMATCH"]);
});
for(const [label,patch] of [
 ["wrong audience",{audience:"b7-wrong-aud"}],
 ["wrong operator",{operator:"b7-wrong-actor"}],
 ["wrong issuer",{issuer:"b7-wrong-issuer"}],
 ["wrong binding",{bindingRef:"b7-wrong-binding"}],
 ["expired",{expiresAtMs:NOW}],
 ["issued in future",{issuedAtMs:NOW+5000}],
 ["too long life",{expiresAtMs:NOW+1000000}],
 ["invalid nonce",{nonce:"short"}],
 ["wrong fixture",{fixture:"REAL_COMMERCE_DATA"}],
 ["extra user-provided Store",{storeId:"store-a"}]
]){
 test("invalid caller claims DENY: "+label,async()=>{
  const p=permit("synthetic_nonce_invalid_"+label.replace(/[^a-z0-9]/gi,"_").slice(0,24),patch);
  const x=await inspect(p);
  assert.equal(x.decision,"DENY");
  assert.equal(x.storeAuthorityVerified,false);
 });
}
test("wrong local mode or no D1 binding is denied",async()=>{
 const p=permit("synthetic_nonce_missingdb_01");
 assert.equal((await inspect(p,{mode:"DISABLED"})).decision,"DENY");
 assert.equal((await inspect(p,{db:null})).decision,"DENY");
});
test("D1 SQL exception returns DENY not successful receipt",async()=>{
 const p=permit("synthetic_nonce_dberror_001");
 const fakeDb={prepare(){throw Error("SYNTHETIC_D1_FAILURE")}};
 const x=await inspect(p,{db:fakeDb});
 assert.deepEqual([x.decision,x.reason],["DENY","D1_BINDING_OPERATION_FAILED"]);
});
test("nonce DB rows contain only digests, not operator, nonce or Store",async()=>{
 const data=await db.prepare("SELECT * FROM v19_b7_qa_caller_nonces").all();
 assert.ok(data.results.length>=3);
 const raw=JSON.stringify(data.results);
 for(const sentinel of ["b7-qa-operator","synthetic_nonce_","store-a","customer","SYNTHETIC_LOCAL_WORKER"])
  assert.equal(raw.includes(sentinel),false);
 for(const r of data.results){
  assert.match(r.caller_scope,/^[0-9a-f]{64}$/);
  assert.match(r.nonce_hash,/^[0-9a-f]{64}$/);
 }
});
test("QA caller match never proves Access JWT or Commerce permission",async()=>{
 const q=await inspect(permit("synthetic_nonce_unauth_0001"));
 assert.equal(q.decision,"QA_LOCAL_D1_NONCE_CLAIMED_NO_SEND");
 assert.equal(q.accessJwtVerified,false);
 assert.equal(q.hostedBindingVerified,false);
 assert.equal(q.commerceReadAllowed,false);
 assert.equal(q.commerceWriteAllowed,false);
 assert.equal(q.providerSendAllowed,false);
});

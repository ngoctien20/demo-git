import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import gate,{reviewSyntheticInstallationBinding,REGISTRY_SQL} from "../trusted-installation-gate.mjs";

const NOW=1795000000000;
const A="qa-install-"+"a".repeat(20);
const B="qa-install-"+"b".repeat(20);
const C="qa-install-"+"c".repeat(20);
const SHA_A="1".repeat(64),SHA_B="2".repeat(64);
const sharedTenant="qa-tenant-shared001";
const row=(extra={})=>({
 installation_ref:A,provider:"zalo_bot",environment:"staging",
 tenant_ref:sharedTenant,store_ref:"qa-store-a000001",
 status:"QA_LOCKED",proof_kind:"SYNTHETIC_FIXTURE_ONLY",
 binding_sha256:SHA_A,registry_revision:1,
 effective_from_ms:NOW-10000,expires_at_ms:NOW+20000,
 ...extra
});

class FakeRegistry {
 constructor(rows=[row()]){this.rows=rows;this.calls=[];this.throwError=false;this.malformed=false;}
 prepare(sql){
  assert.equal(sql,REGISTRY_SQL);
  return{bind:(...args)=>({all:async()=>{
   this.calls.push(args);
   if(this.throwError)throw Error("FAKE_D1_TIMEOUT");
   if(this.malformed)return{success:false,results:[row()]};
   return{success:true,results:this.rows.filter(r=>r.installation_ref===args[0] && r.provider===args[1] && r.environment===args[2]).slice(0,2)};
  }})};
 }
}
const request=(db=new FakeRegistry(),overrides={})=>({
 db,trustedInstallationRef:A,trustedCredentialBindingSha256:SHA_A,
 provider:"zalo_bot",environment:"staging",nowMs:NOW,...overrides
});
const review=async(db,overrides={})=>reviewSyntheticInstallationBinding(request(db,overrides));
async function expectDeny(db,overrides={},reason){
 const r=await review(db,overrides);
 assert.equal(r.decision,"DENY");
 assert.equal(r.reason,reason);
 assert.equal(r.storeAuthorityVerified,false);
 assert.equal(r.commerceReadAllowed,false);
 assert.equal(r.commerceWriteAllowed,false);
 assert.equal(r.providerSendAllowed,false);
}

test("default module Worker fetch is permanently locked 423",async()=>{
 assert.equal((await gate.fetch(new Request("https://qa.invalid/"))).status,423);
});
test("synthetic registry exact match only; NEVER unlocks real provider, Store or Commerce",async()=>{
 const db=new FakeRegistry();
 const r=await review(db);
 assert.equal(r.decision,"QA_REGISTRY_MATCH_ONLY");
 assert.equal(r.syntheticRegistryMatched,true);
 for(const key of ["providerIdentityVerified","storeAuthorityVerified","ownerMembershipVerified","customerIdentityVerified","commerceReadAllowed","commerceWriteAllowed","providerSendAllowed","webhookPublishAllowed"]){
  assert.equal(r[key],false);
 }
 assert.deepEqual(db.calls,[[A,"zalo_bot","staging"]]);
});
test("synthetic details and credential SHA never leaked in response",async()=>{
 const r=await review(new FakeRegistry());
 const s=JSON.stringify(r);
 for(const secret of [A,SHA_A,sharedTenant,"qa-store-a000001"])assert.equal(s.includes(secret),false);
});
test("missing installation rejected without any DB read",async()=>{
 const db=new FakeRegistry();await expectDeny(db,{trustedInstallationRef:""},"UNTRUSTED_OR_MISSING_QA_INPUT");
 assert.equal(db.calls.length,0);
});
test("client-selected installation cannot be an input to this server-only gate",async()=>{
 const db=new FakeRegistry();
 const got=await review(db,{clientInstallationId:B,clientStoreId:"qa-store-b000001",clientRole:"owner"});
 assert.equal(got.decision,"QA_REGISTRY_MATCH_ONLY");
 assert.deepEqual(db.calls,[[A,"zalo_bot","staging"]]);
 assert.equal(got.storeAuthorityVerified,false);
});
test("wrong credential fingerprint fails closed",async()=>{
 await expectDeny(new FakeRegistry(),{trustedCredentialBindingSha256:SHA_B},"BINDING_FINGERPRINT_MISMATCH");
});
test("invalid credential fingerprint rejected before DB query",async()=>{
 const db=new FakeRegistry();
 await expectDeny(db,{trustedCredentialBindingSha256:"invalid"},"UNTRUSTED_OR_MISSING_QA_INPUT");
 assert.equal(db.calls.length,0);
});
test("noncanonical installation ID rejected",async()=>{
 await expectDeny(new FakeRegistry(),{trustedInstallationRef:"/qa/install/other"},"UNTRUSTED_OR_MISSING_QA_INPUT");
});
test("Zalo OA cannot use this Bot registry",async()=>{
 await expectDeny(new FakeRegistry(),{provider:"zalo_oa"},"UNTRUSTED_OR_MISSING_QA_INPUT");
});
test("production environment not allowed",async()=>{
 await expectDeny(new FakeRegistry(),{environment:"production"},"UNTRUSTED_OR_MISSING_QA_INPUT");
});
test("null D1 binding is denied",async()=>{
 await expectDeny(null,{},"UNTRUSTED_OR_MISSING_QA_INPUT");
});
test("no registered installation is denied",async()=>{
 await expectDeny(new FakeRegistry([]),{},"INSTALLATION_NOT_REGISTERED");
});
test("malformed database response is denied",async()=>{
 const db=new FakeRegistry();db.malformed=true;
 await expectDeny(db,{},"REGISTRY_QUERY_FAILED");
});
test("query failure is denied",async()=>{
 const db=new FakeRegistry();db.throwError=true;
 await expectDeny(db,{},"REGISTRY_QUERY_FAILED");
});
test("multiple records matching the same unique key fail closed",async()=>{
 // Malformed/untrusted DB mock; real SQLite PK also forbids duplicate rows.
 await expectDeny(new FakeRegistry([row(),row()]),{},"AMBIGUOUS_INSTALLATION");
});
test("wrong registry scope is denied even when FakeDB returns a corrupt result",async()=>{
 const db=new FakeRegistry([row()]);
 db.prepare=()=>({bind:()=>({all:async()=>({success:true,results:[row({provider:"zalo_oa"})]})})});
 await expectDeny(db,{},"REGISTRY_SCOPE_CONFLICT");
});
for(const [name,changes,reason] of [
 ["disabled record",{status:"DISABLED"},"REGISTRY_NOT_DISPOSABLE_QA"],
 ["real proof disallowed",{proof_kind:"OWNER_APPROVED"},"REGISTRY_NOT_DISPOSABLE_QA"],
 ["Store reference malformed",{store_ref:"other-store"},"REGISTRY_ROW_INVALID_OR_EXPIRED"],
 ["Tenant reference malformed",{tenant_ref:"other-tenant"},"REGISTRY_ROW_INVALID_OR_EXPIRED"],
 ["empty store",{store_ref:""},"REGISTRY_ROW_INVALID_OR_EXPIRED"],
 ["registry revision 0",{registry_revision:0},"REGISTRY_ROW_INVALID_OR_EXPIRED"],
 ["invalid revision string",{registry_revision:"1"},"REGISTRY_ROW_INVALID_OR_EXPIRED"],
 ["not yet effective",{effective_from_ms:NOW+1},"REGISTRY_ROW_INVALID_OR_EXPIRED"],
 ["expired",{expires_at_ms:NOW},"REGISTRY_ROW_INVALID_OR_EXPIRED"],
 ["unbounded 90 days",{expires_at_ms:NOW+90*86400_000},"REGISTRY_ROW_INVALID_OR_EXPIRED"],
 ["bad fingerprint",{binding_sha256:"bad"},"BINDING_FINGERPRINT_MISMATCH"]
]){
 test(name,async()=>await expectDeny(new FakeRegistry([row(changes)]),{},reason));
}
test("two stores under same Tenant are distinct installation entries, no cross-store fallback",async()=>{
 const db=new FakeRegistry([
  row(),row({installation_ref:B,store_ref:"qa-store-b000001",binding_sha256:SHA_B})
 ]);
 const rA=await review(db);
 const rB=await review(db,{trustedInstallationRef:B,trustedCredentialBindingSha256:SHA_B});
 const cross=await review(db,{trustedInstallationRef:B,trustedCredentialBindingSha256:SHA_A});
 assert.equal(rA.decision,"QA_REGISTRY_MATCH_ONLY");
 assert.equal(rB.decision,"QA_REGISTRY_MATCH_ONLY");
 assert.equal(cross.decision,"DENY");
 assert.equal(rA.storeAuthorityVerified,false);
 assert.equal(rB.storeAuthorityVerified,false);
});
test("different Tenants cannot be conflated by registry fallback",async()=>{
 const db=new FakeRegistry([row(),row({
  installation_ref:C,tenant_ref:"qa-tenant-other0001",store_ref:"qa-store-c000001",binding_sha256:SHA_B
 })]);
 assert.equal((await review(db)).decision,"QA_REGISTRY_MATCH_ONLY");
 assert.equal((await review(db,{trustedInstallationRef:C,trustedCredentialBindingSha256:SHA_B})).decision,"QA_REGISTRY_MATCH_ONLY");
 assert.equal((await review(db,{trustedInstallationRef:C,trustedCredentialBindingSha256:SHA_A})).decision,"DENY");
});
test("source has no mutable request-level global and no outbound networking",()=>{
 const s=readFileSync(new URL("../trusted-installation-gate.mjs",import.meta.url),"utf8");
 assert.equal(/\bfetch\s*\(\s*["']https?:/i.test(s),false);
 assert.equal(/console\.(log|error|warn)/.test(s),false);
 assert.equal(/waitUntil\(/.test(s),false);
 assert.match(s,/fetch\(\)\s*\{\s*return new Response\(null,\{status:423\}\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 inspectCompatibility,inspectPrivateOwnerPairing,noSendUatCases,inspectUatReceipts
} from './store-auth-compat-preflight.mjs';
const original=JSON.parse(readFileSync(new URL('./canonical-store-compatibility-metadata.json',import.meta.url),'utf8'));
const snapshot=()=>structuredClone(original);
const validEvidence=()=>({
 environment:'PRIVATE_QA_NO_SEND',
 tenant_id:'11111111-1111-4111-8111-111111111111',
 store_a_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 store_b_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 actor_a_fingerprint:'a'.repeat(64),
 actor_b_fingerprint:'b'.repeat(64),
 actor_consented:true,
 independent_reviewer_present:true,
 real_auth_attested_by_authorized_operator:true,
 store_scope_verified_server_side:true,
 no_provider_send:true,no_customer_data:true,
 evidence_hashes:{
  owner_a_consent:'1'.repeat(64),owner_b_consent:'2'.repeat(64),
  store_registry:'3'.repeat(64),membership_readback:'4'.repeat(64),
  session_verification_a:'5'.repeat(64),session_verification_b:'6'.repeat(64),
  signed_ingress_boundary:'7'.repeat(64),independent_denials:'8'.repeat(64)
 }
});
const denied=(r)=>{assert.equal(r.canMigrate,false);assert.equal(r.canPublish,false);
 assert.equal(r.canModifyHosted,false);assert.equal(r.canCallHostedRpc,false);
 assert.equal(r.canSendProvider,false);assert.equal(r.canAcceptJWT,false);};
const has=(r,term)=>assert.ok(r.blockers.some(x=>x.includes(term)),
 'Missing '+term+': '+r.blockers.join(','));
test('read-only baseline matches 7 tenant-only Commerce surfaces',()=>{
 const r=inspectCompatibility(snapshot());assert.equal(r.status,'TENANT_ONLY_BASELINE_VERIFIED');
 assert.equal(r.sourceOnlyMatrixReady,true);denied(r);has(r,'TENANT_ONLY_PUBLIC_COMMERCE');
});
test('empty baseline blocked',()=>{let r=inspectCompatibility(null);denied(r);has(r,'MISSING_READ_ONLY_BASELINE')});
test('wrong project rejected',()=>{let s=snapshot();s.project_ref='other';let r=inspectCompatibility(s);denied(r);has(r,'PROJECT_MISMATCH')});
test('snapshot change to store schema never promotes based on old baseline',()=>{
 let s=snapshot();s.stores_table_present=true;let r=inspectCompatibility(s);denied(r);has(r,'STAGING_DRIFT')
});
test('missing Commerce surface blocked',()=>{let s=snapshot();s.table_surfaces.pop();let r=inspectCompatibility(s);denied(r);has(r,'SEVEN_COMMERCE')});
test('fabricated store_id true requires reaudit',()=>{let s=snapshot();s.table_surfaces[0].has_store_id=true;let r=inspectCompatibility(s);denied(r);has(r,'SCHEMA_CHANGED')});
test('lost RLS denied',()=>{let s=snapshot();s.table_surfaces[1].rls=false;let r=inspectCompatibility(s);denied(r);has(r,'RLS_BASELINE_DRIFT')});
test('lost FORCE RLS denied',()=>{let s=snapshot();s.table_surfaces[1].force_rls=false;let r=inspectCompatibility(s);denied(r);has(r,'RLS_BASELINE_DRIFT')});
test('anon read grant drift rejected',()=>{let s=snapshot();s.table_surfaces[1].anon_select=true;let r=inspectCompatibility(s);denied(r);has(r,'API_GRANT_DRIFT')});
test('unverified JWT claim cannot promote a snapshot',()=>{let s=snapshot();s.real_auth_store_ab_jwt_verified=true;let r=inspectCompatibility(s);denied(r);has(r,'UNPROVEN_OWNER')});
test('missing security definer RPC gap blocked',()=>{
 let s=snapshot();s.external_contract_surfaces=[];let r=inspectCompatibility(s);denied(r);has(r,'PRIVILEGED_RPC_GAP')
});
test('marked real live channel cutover requires reaudit',()=>{
 let s=snapshot();s.n8n_boundaries[0].released_store_scoped=true;let r=inspectCompatibility(s);denied(r);has(r,'LIVE_CHANNEL_CONTRACT')
});
test('owner evidence absent blocked',()=>{
 let r=inspectPrivateOwnerPairing(snapshot(),null);denied(r);has(r,'NO_PRIVATE_EVIDENCE')
});
test('metadata-only perfect-looking owner manifest never constitutes real Auth test',()=>{
 let r=inspectPrivateOwnerPairing(snapshot(),validEvidence());
 assert.equal(r.status,'PRIVATE_INDEPENDENT_REVIEW_REQUIRED');
 assert.equal(r.mayPrivatelyReviewEvidence,true);
 assert.equal(r.hostedABAdmission,false);assert.equal(r.realAuthTested,false);denied(r)
});
test('raw access token field rejected',()=>{
 let e=validEvidence();e.access_token='REDACTED';let r=inspectPrivateOwnerPairing(snapshot(),e);
 denied(r);has(r,'RAW_CREDENTIAL_OR_TOKEN')
});
test('nested secret field rejected',()=>{
 let e=validEvidence();e.evidence_hashes.secret='REDACTED';let r=inspectPrivateOwnerPairing(snapshot(),e);
 denied(r);has(r,'RAW_CREDENTIAL_OR_TOKEN')
});
test('store ids must differ',()=>{
 let e=validEvidence();e.store_b_id=e.store_a_id;let r=inspectPrivateOwnerPairing(snapshot(),e);
 denied(r);has(r,'SAME_TENANT_DISTINCT_STORE')
});
test('actor fingerprints must differ',()=>{
 let e=validEvidence();e.actor_b_fingerprint=e.actor_a_fingerprint;let r=inspectPrivateOwnerPairing(snapshot(),e);
 denied(r);has(r,'DISTINCT_ACTORS')
});
test('private consent required',()=>{
 let e=validEvidence();e.actor_consented=false;let r=inspectPrivateOwnerPairing(snapshot(),e);
 denied(r);has(r,'INDEPENDENT_CONSENT')
});
test('independent reviewer required',()=>{
 let e=validEvidence();e.independent_reviewer_present=false;let r=inspectPrivateOwnerPairing(snapshot(),e);
 denied(r);has(r,'INDEPENDENT_CONSENT')
});
test('missing external evidence receipt blocked',()=>{
 let e=validEvidence();delete e.evidence_hashes.session_verification_b;let r=inspectPrivateOwnerPairing(snapshot(),e);
 denied(r);has(r,'REQUIRED_EVIDENCE')
});
test('wrong admission environment denied',()=>{
 let e=validEvidence();e.environment='PRODUCTION';let r=inspectPrivateOwnerPairing(snapshot(),e);
 denied(r);has(r,'PRIVATE_QA_REQUIRED')
});
test('provider sends cannot be requested in readiness',()=>{
 let e=validEvidence();e.no_provider_send=false;let r=inspectPrivateOwnerPairing(snapshot(),e);
 denied(r);has(r,'REAL_AUTH_OR_SCOPE')
});
test('missing verified authority remains denied',()=>{
 let e=validEvidence();e.store_scope_verified_server_side=false;let r=inspectPrivateOwnerPairing(snapshot(),e);
 denied(r);has(r,'REAL_AUTH_OR_SCOPE')
});
test('UAT matrix has 31 independent scenarios all NOT_RUN',()=>{
 let a=noSendUatCases();assert.equal(a.length,31);
 assert.equal(new Set(a.map(x=>x.id)).size,31);
 assert.ok(a.every(x=>x.actual==='NOT_RUN'&&x.runtimeVerified===false&&x.evidence_sha256===null));
 let r=inspectUatReceipts(a);denied(r);assert.equal(r.status,'PREPARED_NOT_EXECUTED');
 assert.equal(r.realUatExecuted,false);assert.equal(r.canScheduleHostedUat,false);
});
test('UAT matrix cannot be truncated',()=>{
 let r=inspectUatReceipts(noSendUatCases().slice(0,30));denied(r);has(r,'COMPLETE_CASE_MATRIX')
});
test('cannot substitute PASS without external runtime validation',()=>{
 let a=noSendUatCases().map(x=>({...x}));
 a[0].actual='PASS';a[0].runtimeVerified=true;
 let r=inspectUatReceipts(a);denied(r);has(r,'UNAUTHORIZED_RESULT')
});
test('cannot invent evidence hash in source-only UAT plan',()=>{
 let a=noSendUatCases().map(x=>({...x}));
 a[4].evidence_sha256='a'.repeat(64);
 let r=inspectUatReceipts(a);denied(r);has(r,'INVENTED_EVIDENCE')
});
test('changing expected behavior requires a new versioned plan',()=>{
 let a=noSendUatCases().map(x=>({...x}));
 a[2].expected='ALLOW';
 let r=inspectUatReceipts(a);denied(r);has(r,'CASE_CONTRACT_DRIFT')
});
test('duplicate UAT case id denied',()=>{
 let a=noSendUatCases().map(x=>({...x}));
 a[30].id=a[29].id;
 let r=inspectUatReceipts(a);denied(r);has(r,'DUPLICATE_CASE')
});

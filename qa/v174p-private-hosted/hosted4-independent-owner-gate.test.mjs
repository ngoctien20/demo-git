import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as signEd25519} from 'node:crypto';
import {assessIndependentAuthorization,CONTRACT,WORKER,ACCOUNT,LOCKED_V175_RESOURCES} from './hosted4-independent-owner-gate.mjs';
const now=Date.parse('2026-11-17T07:30:00.000Z');
const SHA='d203cbe084241f0296eda16576accb133f19c88a';
const owner=generateKeyPairSync('ed25519'),security=generateKeyPairSync('ed25519');
const spki=pair=>pair.publicKey.export({type:'spki',format:'pem'});
const trust={
 owner:{role:'owner',kid:'test-owner-key',provisioned_out_of_band:true,public_key_spki_pem:spki(owner)},
 security:{role:'security_reviewer',kid:'test-security-key',provisioned_out_of_band:true,public_key_spki_pem:spki(security)}
};
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
 (x!==null&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x));
const signed=(payload,pair,kid)=>({
 kid,signature:signEd25519(null,Buffer.from('TIEN404_V174P_HOSTED4_OWNER_GATE\n'+canonical(payload)),
  pair.privateKey).toString('base64url')
});
function fixture(){
 const payload={
  contract:CONTRACT,account_id:ACCOUNT,target_worker:WORKER,replay_class:'V174PReplayGuard',
  phase:'INACTIVE_UPLOAD_ONLY',scope:'SYNTHETIC_QA_NO_SEND_NO_COMMERCE',
  source_sha:SHA,qa_origin:'https://t404-qa.example.com/',operator_emails:['operator@example.com'],
  resources:['dedicated_qa_worker','sqlite_durable_object','worker_access_all_traffic',
    'reusable_operator_allow_policy','managed_session_key','managed_access_jwks','dedicated_qa_host'],
  max_http_requests:96,max_spend_usd:5,
  allow_account_wide_spend_limit_change:false,
  allow_real_data:false,allow_commerce_writes:false,allow_provider_send:false,
  issued_at:new Date(now-1000).toISOString(),expires_at:new Date(now+1800000).toISOString()
 };
 const signatures={owner:signed(payload,owner,'test-owner-key'),security:signed(payload,security,'test-security-key')};
 const inventory={
  account_id:ACCOUNT,source:'CLOUDFLARE_CONTROL_PLANE_READ_ONLY',collected_at_ms:now-60000,
  script_names:[...LOCKED_V175_RESOURCES.scripts,'ngoctien20-bio'],
  worker_names:['tien404-g22-shop-b-map-nosend-staging'],
  do_namespace_names:[...LOCKED_V175_RESOURCES.namespaces],
  access_app_names:['tien404-ai-git-staging - Cloudflare Pages']
 };
 const review={
  independently_verified_source_sha:SHA,
  live_inventory_independently_attested:true,
  verified_no_cross_workstream_bindings:true,
  owner_budget_reviewed_independently:true,
  operator_identity_reviewed_independently:true,
  rollback_plan_reviewed_independently:true,
  no_public_route_attested:true
 };
 return {payload,signatures,trust:structuredClone(trust),inventory,review};
}
const assess=f=>assessIndependentAuthorization(f.payload,f.signatures,f.trust,f.inventory,f.review,now);
const denies=(f,code)=>{
 const r=assess(f);assert(r.reasons.includes(code),JSON.stringify(r.reasons));
 assert.equal(r.deploy_authorized,false);
};
test('01 dual signers on exact synthetic fixture yield review-only state, never deployment',()=>{
 const x=assess(fixture());
 assert.deepEqual(x.reasons,[]);
 assert.match(x.status,/NEEDS_OPERATOR_AUTHORIZATION/);
 assert.equal(x.deploy_authorized,false);
 assert.equal(x.verified_owner_authority,false);
 assert.equal(x.enable_public_route_authorized,false);
});
test('02 completely missing evidence always blocked',()=>{
 const x=assessIndependentAuthorization({},null,null,null,null,now);
 assert.equal(x.status,'BLOCKED');assert.equal(x.deploy_authorized,false);
});
test('03 deny payload tampering after signatures',()=>{const f=fixture();f.payload.max_spend_usd=9;denies(f,'owner_ed25519_signature');denies(f,'security_ed25519_signature');});
test('04 reject missing external trust anchor',()=>{const f=fixture();f.trust.owner=null;denies(f,'external_owner_trust_anchor');denies(f,'owner_ed25519_signature');});
test('05 reject same signer key for security and owner',()=>{const f=fixture();f.trust.security=f.trust.owner;denies(f,'independent_distinct_signer_keys');});
test('06 reject wrong security kid',()=>{const f=fixture();f.signatures.security.kid='attacker';denies(f,'security_ed25519_signature');});
test('07 reject malformed / missing Ed25519 signature',()=>{const f=fixture();f.signatures.owner.signature='AAAA';denies(f,'owner_ed25519_signature');});
test('08 wrong script SHA must fail independently',()=>{const f=fixture();f.review.independently_verified_source_sha='a'.repeat(40);denies(f,'pinned_source_sha');});
test('09 fail closed to account mismatch',()=>{const f=fixture();f.payload.account_id='wrong';denies(f,'isolated_target_account');});
test('10 no public route or LIVE phase',()=>{const f=fixture();f.payload.phase='PUBLIC';denies(f,'phase_a_only_no_active_route');});
test('11 do not permit provider sends',()=>{const f=fixture();f.payload.allow_provider_send=true;denies(f,'no_send_synthetic_scope');});
test('12 no blank operator allowlist or broad wildcard',()=>{const f=fixture();f.payload.operator_emails=['*@example.com'];denies(f,'explicit_operator_emails');});
test('13 no Pages host impersonation',()=>{const f=fixture();f.payload.qa_origin='https://tien404-ai-git-staging.pages.dev/';denies(f,'private_qa_origin');});
test('14 no HTTP or personal BIO domain',()=>{const f=fixture();f.payload.qa_origin='http://ngoctien20.io.vn/';denies(f,'private_qa_origin');});
test('15 97 requests exceed maximum 96',()=>{const f=fixture();f.payload.max_http_requests=97;denies(f,'bounded_http_requests');});
test('16 require explicit positive bounded spend',()=>{const f=fixture();f.payload.max_spend_usd=0;denies(f,'explicit_positive_qa_spend');});
test('17 prohibit changing account-wide spending limits',()=>{const f=fixture();f.payload.allow_account_wide_spend_limit_change=true;denies(f,'no_shared_account_limit_change');});
test('18 expired signed packet denied even if signatures valid',()=>{const f=fixture();f.payload.expires_at=new Date(now-1000).toISOString();denies(f,'short_lived_time_bound');});
test('19 stale inventory rejected',()=>{const f=fixture();f.inventory.collected_at_ms=now-600001;denies(f,'independent_fresh_cloudflare_read_only_inventory');});
test('20 missing independent reviewer of inventory rejected',()=>{const f=fixture();f.review.live_inventory_independently_attested=false;denies(f,'independent_fresh_cloudflare_read_only_inventory');});
test('21 deny collision with own dedicated Worker',()=>{const f=fixture();f.inventory.script_names.push(WORKER);denies(f,'no_target_worker_collision');});
test('22 deny collision with own Access app',()=>{const f=fixture();f.inventory.access_app_names.push('Private '+WORKER);denies(f,'no_access_app_collision');});
test('23 deny another workstream DO listed as missing',()=>{const f=fixture();f.inventory.do_namespace_names.pop();denies(f,'parallel_v175_resources_preserved');});
test('24 deny a V17.5 worker listed as missing',()=>{const f=fixture();f.inventory.script_names.shift();denies(f,'parallel_v175_resources_preserved');});
test('25 deny existing target DO namespace collision',()=>{const f=fixture();f.inventory.do_namespace_names.push(WORKER+'_V174PReplayGuard');denies(f,'no_durable_namespace_collision');});
test('26 deny unreviewed cross-workstream binding',()=>{const f=fixture();f.review.verified_no_cross_workstream_bindings=false;denies(f,'no_shared_qa_data_or_binding');});
test('27 deny absent independent cost review',()=>{const f=fixture();f.review.owner_budget_reviewed_independently=false;denies(f,'owner_privacy_and_cost_review');});
test('28 deny absent rollback / no-public-route attestation',()=>{const f=fixture();f.review.no_public_route_attested=false;denies(f,'rollback_and_no_route_attestation');});
test('29 deny missing approval requested resource',()=>{const f=fixture();f.payload.resources.pop();denies(f,'strict_resource_scope');});
test('30 deny silently added extra JSON fields',()=>{const f=fixture();f.payload.deploy_now=true;denies(f,'exact_signed_contract_fields');});
test('31 deny customer-data scope',()=>{const f=fixture();f.payload.allow_real_data=true;denies(f,'no_send_synthetic_scope');});
test('32 deny alternate signing contract even if JSON field shape is correct',()=>{const f=fixture();f.payload.contract='OTHER_CONTRACT';denies(f,'exact_contract_version');});

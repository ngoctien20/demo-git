import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as rsaSign,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyPrivateOperatorAdmission,reviewPrivateOperatorAndReservePermit,hashPermit} from './hosted4b3-private-operator-admission.mjs';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const now=Date.parse('2026-11-17T10:00:00.000Z'),seconds=now/1000;
const p={deployment_operator_email:'operator@example.com',nonce:'a'.repeat(32),
 worker_name:'tien404-v174p-private-qa-issuer'};
const trust=()=>({
 source:'PRIVATE_IDENTITY_BROKER_OUT_OF_BAND',independent_operator_registry_verified:true,
 kid:'synthetic-private-broker-k1',spki_pem:pair.publicKey.export({format:'pem',type:'spki'}),
 issuer:'https://qa-identity.example.com',audience:'t404-private-qa-admission',
 authorized_operator_subject:'qa-test-operator-0001',authorized_operator_email:'operator@example.com'
});
const base=()=>({
 iss:'https://qa-identity.example.com',aud:'t404-private-qa-admission',
 sub:'qa-test-operator-0001',email:'operator@example.com',email_verified:true,
 role:'qa_deployment_operator',scope:'t404:qa:inactive-first-upload',
 iat:seconds-20,nbf:seconds-20,exp:seconds+180,auth_time:seconds-30,
 amr:['password','mfa'],permit_sha256:hashPermit(p)
});
function issue(payload=base(),header={alg:'RS256',kid:'synthetic-private-broker-k1'}){
 const h=Buffer.from(JSON.stringify(header)).toString('base64url');
 const c=Buffer.from(JSON.stringify(payload)).toString('base64url');
 const sig=rsaSign('RSA-SHA256',Buffer.from(h+'.'+c),pair.privateKey).toString('base64url');
 return h+'.'+c+'.'+sig;
}
const verify=(token=issue(),t=trust(),permit=p)=>verifyPrivateOperatorAdmission({
 jwt:token,trustConfig:t,permit,now});
const blocked=(mutation,reason)=>{
 const c=base(),h={alg:'RS256',kid:'synthetic-private-broker-k1'},t=trust();
 mutation(c,h,t);
 const result=verify(issue(c,h),t);
 assert.equal(result.state,'BLOCKED_OPERATOR_IDENTITY');
 assert.equal(result.reason,reason);
 assert.equal(result.can_upload,false);
};
test('01 valid synthetic broker RS256 identity is REVIEW-ONLY, never real owner admission',()=>{
 const r=verify();assert.equal(r.identity_admitted_for_private_review,true);
 assert.equal(r.real_identity_independently_proven,false);
 assert.equal(r.can_upload,false);assert.equal(r.can_modify_cloudflare,false);
 assert.match(r.operator_subject_hash,/^[a-f0-9]{64}$/);
});
test('02 missing JWT denied',()=>assert.equal(verifyPrivateOperatorAdmission({now}).can_upload,false));
test('03 forged RS256 signature denied',()=>{
 const t=issue().split('.');t[2]=(t[2].startsWith('A')?'B':'A')+t[2].slice(1);
 assert.equal(verify(t.join('.')).reason,'JWT_SIGNATURE_INVALID');
});
test('04 alg none denied even with RSA signature',()=>blocked((c,h)=>{h.alg='none'},'JWT_ALGORITHM_OR_KEY_INJECTION'));
test('05 kid mismatch denied',()=>blocked((c,h)=>{h.kid='attacker-kid'},'NO_INDEPENDENT_BROKER_TRUST'));
test('06 header jwk injection denied',()=>blocked((c,h)=>{h.jwk={kty:'RSA'}},'JWT_ALGORITHM_OR_KEY_INJECTION'));
test('07 JWT issuer mismatch denied',()=>blocked(c=>{c.iss='https://phishing.example.com'},'JWT_ISSUER_OR_AUDIENCE'));
test('08 JWT audience mismatch denied',()=>blocked(c=>{c.aud='other-audience'},'JWT_ISSUER_OR_AUDIENCE'));
test('09 expired JWT denied',()=>blocked(c=>{c.exp=seconds-1},'JWT_EXPIRED_STALE_OR_FUTURE'));
test('10 future nbf denied',()=>blocked(c=>{c.nbf=seconds+30},'JWT_EXPIRED_STALE_OR_FUTURE'));
test('11 stale MFA authentication denied',()=>blocked(c=>{c.auth_time=seconds-301},'JWT_EXPIRED_STALE_OR_FUTURE'));
test('12 token life above five minutes denied',()=>blocked(c=>{c.exp=seconds+600},'JWT_EXPIRED_STALE_OR_FUTURE'));
test('13 missing mfa denied',()=>blocked(c=>{c.amr=['password']},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('14 impersonated subject denied',()=>blocked(c=>{c.sub='attacker'},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('15 changed email denied',()=>blocked(c=>{c.email='other@example.com'},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('16 unverified email denied',()=>blocked(c=>{c.email_verified=false},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('17 wrong operator role denied',()=>blocked(c=>{c.role='admin'},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('18 excess provider/Commerce scope denied',()=>blocked(c=>{c.scope='t404:commerce:write'},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('19 signed JWT bound to different permit denied',()=>blocked(c=>{c.permit_sha256='e'.repeat(64)},'OPERATOR_NOT_BOUND_TO_SIGNED_PERMIT'));
test('20 no independent registry flag denied',()=>blocked((c,h,t)=>{t.independent_operator_registry_verified=false},'NO_INDEPENDENT_BROKER_TRUST'));
test('21 attacker public key mismatch denied',()=>{
 const t=trust(),attacker=generateKeyPairSync('rsa',{modulusLength:2048});
 t.spki_pem=attacker.publicKey.export({format:'pem',type:'spki'});
 assert.equal(verify(issue(),t).reason,'JWT_SIGNATURE_INVALID');
});
test('22 bearer JWT attached to changed permit denied',()=>{
 assert.equal(verify(issue(),trust(),{...p,nonce:'f'.repeat(32)}).reason,'OPERATOR_NOT_BOUND_TO_SIGNED_PERMIT');
});
test('23 unsupported noncanonical base64url encoding denied',()=>{
 const t=issue().split('.');t[2]+='=';assert.equal(verify(t.join('.')).reason,'JWT_PARSE_OR_CANONICALIZATION');
});
test('24 missing signed permit prevents claiming ledger',async()=>{
 let called=false;
 const result=await reviewPrivateOperatorAndReservePermit({
  operatorJwt:issue(),trustConfig:trust(),evidence:{permit:{...p,nonce:'wrong'}},
  privateLedger:{claimOnce:async()=>{called=true;return {claimed:true}}},
  getFreshInventory:async()=>{called=true;return null},now
 });
 assert.equal(result.permit_ledger_attempted,false);
 assert.equal(called,false);
});
test('25 valid JWT alone cannot bypass missing owner signatures or claim ledger',async()=>{
 let called=false;
 const result=await reviewPrivateOperatorAndReservePermit({
  operatorJwt:issue(),trustConfig:trust(),evidence:{permit:p},
  privateLedger:{claimOnce:async()=>{called=true;return {claimed:true}}},
  getFreshInventory:async()=>{called=true;return null},now
 });
 assert.equal(result.status,'BLOCKED_PERMIT_PREFLIGHT');
 assert.equal(called,false);
 assert.equal(result.can_upload,false);
});

test('26 operator must validate before ledger even if claim adapter advertises success',async()=>{
 let claimCalled=false;
 const broken=issue({...base(),amr:['password']});
 const result=await reviewPrivateOperatorAndReservePermit({
  operatorJwt:broken,trustConfig:trust(),evidence:{permit:p},
  privateLedger:{claimOnce:async()=>{claimCalled=true;return {claimed:true}}},
  getFreshInventory:async()=>{claimCalled=true;return {}},now
 });
 assert.equal(result.identity_admitted_for_private_review,false);
 assert.equal(claimCalled,false);
});
test('27 synthetic full owner and operator signatures pass ONLY into hash-bound ledger reservation',async()=>{
 // Never use these ephemeral keys, role flags or operator@example.com as
 // real human/operator evidence. This is an OFFLINE contract integration test.
 const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
  (x!==null&&typeof x==='object'?
   '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':
   JSON.stringify(x));
 const source=readFileSync(new URL('./hosted-issuer.worker.mjs',import.meta.url),'utf8');
 const manifest=JSON.parse(readFileSync(new URL('./wrangler.hosted4b.inactive.example.json',import.meta.url),'utf8'));
 const all=[...[
  'tien404-v175e1-private-issuer-nosend-staging',
  'tien404-v175e2-ab-gateway-nosend-staging',
  'tien404-v175e2-durable-replay-nosend-staging',
  'tien404-v175e2-installation-registry-nosend-staging',
  'tien404-v175e2a-private-hosted-runner-nosend-staging'
 ],...Array.from({length:23},(_,i)=>'synthetic-existing-'+i)].sort();
 const inventory={
  account_id:'ac01685529c0a31fc185335f07648edf',
  source:'CLOUDFLARE_CONTROL_PLANE_READ_ONLY',collected_at_ms:now-20_000,
  script_names:all,worker_names:all.slice(),
  do_namespace_names:[
   'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
   'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults'
  ],access_app_names:['existing Pages staging'],
  page_verification:{status:'COMPLETE',cross_consistent:true,total_workers:28,total_scripts:28}
 };
 const permit={
  contract:'T404_V174P_HOSTED4B1_PRIVATE_PHASE_A_SIGNED_PERMIT_V1',
  intent:'FIRST_UPLOAD_INACTIVE_ONLY',
  account_id:'ac01685529c0a31fc185335f07648edf',
  worker_name:'tien404-v174p-private-qa-issuer',new_sqlite_class:'V174PReplayGuard',
  source_git_sha:'b9992731e5878eacb0f0c0cd091439b7ce2a935a',
  source_sha256:createHash('sha256').update(source).digest('hex'),
  manifest_sha256:hashPermit(manifest),inventory_sha256:hashPermit(inventory),
  signed_at:new Date(now-1000).toISOString(),expires_at:new Date(now+180000).toISOString(),
  nonce:'b'.repeat(32),deployment_operator_email:'operator@example.com',
  rollback_operator_email:'rollback@example.com',
  incremental_budget_usd:5,max_external_requests:0,accept_shared_account_cost_risk:true,
  ack_spending_limit_not_hard_cap:true,ack_do_storage_charges_excluded:true,
  no_account_wide_limit_change:true,no_public_routes:true,no_preview_url:true,
  no_workers_dev:true,no_secret_upload:true,no_access_modifications:true,
  no_real_customer_data:true,no_outbound_provider_send:true,no_ai_model_calls:true,
  no_commerce_writes:true,create_new_qa_worker_and_sqlite_do_only:true
 };
 const owner=generateKeyPairSync('ed25519'),security=generateKeyPairSync('ed25519');
 const trustAnchors={
  owner:{role:'owner',key_id:'synthetic-owner',registered_out_of_band:true,
   spki_pem:owner.publicKey.export({format:'pem',type:'spki'})},
  security:{role:'security_reviewer',key_id:'synthetic-security',registered_out_of_band:true,
   spki_pem:security.publicKey.export({format:'pem',type:'spki'})}
 };
 const sig=(pair,kid)=>({key_id:kid,signature:rsaSign(null,
   Buffer.from('T404_V174P_HOSTED4B1_PHASE_A_PERMIT\n'+canonical(permit)),
   pair.privateKey).toString('base64url')});
 const evidence={
  permit,signatures:{owner:sig(owner,'synthetic-owner'),security:sig(security,'synthetic-security')},
  trustAnchors,registryEvidence:{
   independently_verified_git_sha:permit.source_git_sha,
   independently_verified_source_hash:permit.source_sha256,
   inventory_collected_by_independent_connector:true,
   v175_durable_ownership_independently_reviewed:true,
   nonce_uniqueness_verified_by_durable_private_ledger:true,
   deployment_operator_email:permit.deployment_operator_email,
   rollback_operator_email:permit.rollback_operator_email,
   operator_verified_out_of_band:true,rollback_operator_verified_out_of_band:true,
   finance_owner_cost_reviewed_out_of_band:true,
   owner_real_identity_verified_out_of_band:true,
   security_reviewer_real_identity_verified_out_of_band:true
  },
  sourceArtifact:source,manifestArtifact:manifest,
  inventoryEvidence:{status:'COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW',errors:[],inventory}
 };
 let observed=null;
 const ledger={claimOnce:async claim=>{
  observed=claim;
  return {claimed:true,durable_commit_confirmed:true,receipt_id:'synthetic-only-receipt-1234'};
 }};
 const jwt=issue({...base(),permit_sha256:hashPermit(permit)});
 const result=await reviewPrivateOperatorAndReservePermit({
  operatorJwt:jwt,trustConfig:trust(),evidence,privateLedger:ledger,
  getFreshInventory:async()=>structuredClone(evidence.inventoryEvidence),now
 });
 assert.equal(result.status,'ONE_TIME_PERMIT_RESERVED_FOR_MANUAL_REVIEW_ONLY',
  JSON.stringify(result.reasons||result.signer_gate_reasons||[]));
 assert.match(observed.operator_subject_hash,/^[a-f0-9]{64}$/);
 assert.equal(observed.permit_hash,hashPermit(permit));
 assert.equal(result.can_upload,false);
 assert.equal(result.can_deploy,false);
 assert.equal(result.real_identity_independently_proven,false);
});

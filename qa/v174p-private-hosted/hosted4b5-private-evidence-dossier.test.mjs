import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as edSign} from 'node:crypto';
import {
 assessPrivateEvidenceDossier,CONTRACT,PHASE_LEDGER,PHASE_QA,digest
} from './hosted4b5-private-evidence-dossier.mjs';
import {ACCOUNT,WORKER,LEDGER} from './hosted4b4-independent-finance-ledger-gate.mjs';
const NOW=Date.parse('2026-11-17T11:30:00.000Z');
const roles=['owner','finance','security','operator','rollback'];
const keys=Object.fromEntries([...roles,'ledger_postflight'].map(n=>[n,generateKeyPairSync('ed25519')]));
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':
 (x!==null&&typeof x==='object'?
  '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':
  JSON.stringify(x));
const sign=(p,role,prefix)=>({
 key_id:'synthetic-'+role+'-key',
 signature:edSign(null,Buffer.from(prefix+canon(p)),keys[role].privateKey).toString('base64url')
});
function fixture(phase=PHASE_LEDGER){
 const names=[
  'tien404-v175e1-private-issuer-nosend-staging',
  'tien404-v175e2-ab-gateway-nosend-staging',
  'tien404-v175e2-durable-replay-nosend-staging',
  'tien404-v175e2-installation-registry-nosend-staging',
  'tien404-v175e2a-private-hosted-runner-nosend-staging',
  'tien404-rpc16-merchant-evidence-inactive-staging',
  ...Array.from({length:23},(_,i)=>'unrelated-'+i)
 ].sort();
 if(phase===PHASE_QA)names.push(LEDGER);
 const x={
  account_id:ACCOUNT,source:'CLOUDFLARE_CONTROL_PLANE_READ_ONLY',
  collected_at_ms:NOW-20000,
  worker_names:names.slice(),script_names:names.slice(),
  do_namespace_names:[
   'tien404-v175e2-durable-replay-nosend-staging_ReplayBucket',
   'tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults',
   ...(phase===PHASE_QA?[LEDGER+'_V174PPermitLedger']:[])
  ],
  access_app_names:['TIEN404 RPC16 Merchant Evidence Staging — DENY ALL',
   'tien404-ai-git-staging - Cloudflare Pages'],
  page_verification:{cross_consistent:true,total_workers:names.length,
   total_scripts:names.length}
 };
 const refs=Object.fromEntries([
  'owner_authority','finance_authority','security_review','operator_mfa','rollback_acceptance'
 ].map((n,i)=>[n,{ref_id:'EV-private-metadata-'+String(i)+'-qa',
   sha256:String(i+1).repeat(64),kind:n}]));
 const pkt={
  contract:CONTRACT,phase,account_id:ACCOUNT,
  target_worker:phase===PHASE_LEDGER?LEDGER:WORKER,
  source_git_sha:'cf392f52da1eab6525825dd71cf7ca841be86611',
  owner_permit_sha256:'a'.repeat(64),
  finance_packet_sha256:'b'.repeat(64),
  inventory_sha256:digest(x),target_manifest_sha256:'c'.repeat(64),
  qa_budget_usd:3,ledger_budget_usd:2,private_evidence_refs:refs,
  issued_at:new Date(NOW-1000).toISOString(),
  expires_at:new Date(NOW+180000).toISOString(),nonce:'d'.repeat(32),
  public_routes_allowed:false,preview_allowed:false,
  workers_dev_allowed:false,existing_resources_mutation_allowed:false,
  production_writes_allowed:false,budget_limits_mutation_allowed:false,
  automated_upload_allowed:false,ledger_receipt_sha256:null
 };
 const registry=Object.fromEntries([...roles,'ledger_postflight'].map(n=>[
  n,{key_id:'synthetic-'+n+'-key',role:n,registered_out_of_band:true,
     spki_pem:keys[n].publicKey.export({format:'pem',type:'spki'})}
 ]));
 const f={
  packet:pkt,trustedRegistry:registry,
  inventory:{account_id:ACCOUNT,status:'COMPLETE_READ_ONLY_NEEDS_INDEPENDENT_REVIEW',
   errors:[],snapshot:x},signatures:{},now:NOW,priorLedgerAcceptance:null
 };
 if(phase===PHASE_QA){
  const receipt={
   contract:'T404_V174P_HOSTED_LEDGER_POSTFLIGHT_V1',
   resource:PHASE_LEDGER,worker_name:LEDGER,
   worker_id:'e'.repeat(32),namespace_id:'f'.repeat(32),
   namespace_name:LEDGER+'_V174PPermitLedger',
   created_at:new Date(NOW-60000).toISOString(),
   inventory_before_sha256:'4'.repeat(64),
   inventory_after_sha256:digest(x),
   no_public_route:true,no_preview:true,no_workers_dev:true,
   no_existing_resource_change:true,no_secrets:true,no_provider_sends:true
  };
  pkt.ledger_receipt_sha256=digest(receipt);
  f.priorLedgerAcceptance={
   receipt,signature:sign(receipt,'ledger_postflight',
    'T404_V174P_4B5_LEDGER_POSTFLIGHT_REVIEW\n')
  };
 }
 resign(f);
 return f;
}
function resign(f){
 f.signatures=Object.fromEntries(roles.map(n=>[
  n,sign(f.packet,n,'T404_V174P_4B5_SIGNED_EVIDENCE:'+f.packet.phase+':'+n+'\n')
 ]));
}
function reject(fn,reason,resignAfter=false,phase=PHASE_LEDGER){
 const f=fixture(phase);fn(f);if(resignAfter)resign(f);
 const r=assessPrivateEvidenceDossier(f);
 assert.equal(r.decision,'BLOCKED',JSON.stringify(r.reasons));
 assert(r.reasons.includes(reason),JSON.stringify(r.reasons));
 assert.equal(r.can_upload,false);assert.equal(r.can_create_ledger,false);
 assert.equal(r.can_upload_qa_worker,false);assert.equal(r.cloudflare_writes_made,false);
}
test('01 synthetic five signatures for inactive ledger only pass mathematics, no Cloudflare authority',()=>{
 const r=assessPrivateEvidenceDossier(fixture());
 assert.deepEqual(r.reasons,[]);
 assert.equal(r.decision,'SIGNED_METADATA_MATH_CONSISTENT_NOT_REAL_AUTHORIZATION');
 assert.equal(r.can_create_ledger,false);assert.equal(r.hosted_ledger_currently_deployed_verified,false);
});
test('02 no packet blocks; no upload',()=>{
 const r=assessPrivateEvidenceDossier({now:NOW});
 assert.equal(r.decision,'BLOCKED');assert(r.reasons.length>=8);
});
test('03 forged owner signature fails',()=>reject(f=>{
 f.signatures.owner.signature=(f.signatures.owner.signature[0]==='A'?'B':'A')+f.signatures.owner.signature.slice(1);
},'five_independently_signed_phase_bound_attestations'));
test('04 missing finance signature fails',()=>reject(f=>{
 delete f.signatures.finance;
},'five_independently_signed_phase_bound_attestations'));
test('05 missing security reviewer signature fails',()=>reject(f=>{
 delete f.signatures.security;
},'five_independently_signed_phase_bound_attestations'));
test('06 missing operator signature fails',()=>reject(f=>{
 delete f.signatures.operator;
},'five_independently_signed_phase_bound_attestations'));
test('07 missing rollback signature fails',()=>reject(f=>{
 delete f.signatures.rollback;
},'five_independently_signed_phase_bound_attestations'));
test('08 role swapped signature cannot bypass domain separation',()=>reject(f=>{
 f.signatures.owner=f.signatures.finance;
},'five_independently_signed_phase_bound_attestations'));
test('09 owner signing public key duplicated under different role id fails',()=>reject(f=>{
 f.trustedRegistry.finance.spki_pem=f.trustedRegistry.owner.spki_pem;
},'five_independent_out_of_band_role_keys'));
test('10 changing source SHA even with new five signatures is detected by bundle validation',()=>reject(f=>{
 f.packet.source_git_sha='wrong-commit';
},'immutable_source_and_approval_hashes',true));
test('11 adding malicious evidence URL is forbidden even if all five signatures re-signed',()=>reject(f=>{
 f.packet.private_evidence_refs.owner_authority.url='https://attacker.example/collect';
},'five_private_opaque_evidence_references_only',true));
test('12 adding raw Merchant document bytes forbidden',()=>reject(f=>{
 f.packet.private_evidence_refs.owner_authority.file_content='merchant scan';
},'five_private_opaque_evidence_references_only',true));
test('13 adding JWT or credential field forbidden',()=>reject(f=>{
 f.packet.access_token='Bearer SYNTHETIC_TEST_SHOULD_NOT_COMMIT';
},'exact_metadata_only_fields',true));
test('14 path traversal evidence locator not allowed',()=>reject(f=>{
 f.packet.private_evidence_refs.finance_authority.ref_id='../../secret';
},'five_private_opaque_evidence_references_only',true));
test('15 missing private evidence categories forbidden',()=>reject(f=>{
 delete f.packet.private_evidence_refs.rollback_acceptance;
},'five_private_opaque_evidence_references_only',true));
test('16 cryptographic evidence hash cannot be empty',()=>reject(f=>{
 f.packet.private_evidence_refs.security_review.sha256='';
},'five_private_opaque_evidence_references_only',true));
test('17 wrong Cloudflare account rejected',()=>reject(f=>{
 f.packet.account_id='other';
},'target_account_and_phase',true));
test('18 public routes strictly forbidden',()=>reject(f=>{
 f.packet.public_routes_allowed=true;
},'no_public_network_or_writes',true));
test('19 preview route strictly forbidden',()=>reject(f=>{
 f.packet.preview_allowed=true;
},'no_public_network_or_writes',true));
test('20 billing limit mutation strictly forbidden',()=>reject(f=>{
 f.packet.budget_limits_mutation_allowed=true;
},'no_public_network_or_writes',true));
test('21 automatic upload is forbidden',()=>reject(f=>{
 f.packet.automated_upload_allowed=true;
},'no_public_network_or_writes',true));
test('22 zero finance allocation rejected',()=>reject(f=>{
 f.packet.ledger_budget_usd=0;
},'two_distinct_positive_usd_risk_allocations',true));
test('23 combined allocation above model risk limit rejected',()=>reject(f=>{
 f.packet.ledger_budget_usd=24;
},'two_distinct_positive_usd_risk_allocations',true));
test('24 expired packet rejected',()=>reject(f=>{
 f.packet.expires_at=new Date(NOW-1).toISOString();
},'short_lived_15_minute_packet',true));
test('25 wrong inventory digest rejected even with freshly signed dossier',()=>reject(f=>{
 f.packet.inventory_sha256='f'.repeat(64);
},'fresh_full_independent_inventory_digest',true));
test('26 stale Cloudflare GET evidence rejected',()=>reject(f=>{
 f.inventory.snapshot.collected_at_ms=NOW-60001;
 f.packet.inventory_sha256=digest(f.inventory.snapshot);
},'fresh_full_independent_inventory_digest',true));
test('27 truncated worker page metadata rejected',()=>reject(f=>{
 f.inventory.snapshot.page_verification.total_workers=10;
 f.packet.inventory_sha256=digest(f.inventory.snapshot);
},'fresh_full_independent_inventory_digest',true));
test('28 first ledger upload denied if ledger already exists',()=>reject(f=>{
 f.inventory.snapshot.worker_names.push(LEDGER);
 f.inventory.snapshot.script_names.push(LEDGER);
 f.inventory.snapshot.page_verification.total_workers=30;
 f.packet.inventory_sha256=digest(f.inventory.snapshot);
},'target_resource_absent',true));
test('29 ledger phase cannot smuggle prior hosted receipt',()=>reject(f=>{
 f.packet.ledger_receipt_sha256='d'.repeat(64);
},'ledger_phase_requires_no_prior_receipt',true));
test('30 synthetic QA-Worker phase with independent signed hosted ledger receipt still cannot upload',()=>{
 const r=assessPrivateEvidenceDossier(fixture(PHASE_QA));
 assert.deepEqual(r.reasons,[]);
 assert.equal(r.decision,'SIGNED_METADATA_MATH_CONSISTENT_NOT_REAL_AUTHORIZATION');
 assert.equal(r.can_upload_qa_worker,false);
});
test('31 QA Worker cannot start before ledger exists in control plane',()=>reject(f=>{
 f.inventory.snapshot.worker_names=f.inventory.snapshot.worker_names.filter(n=>n!==LEDGER);
 f.inventory.snapshot.script_names=f.inventory.snapshot.script_names.filter(n=>n!==LEDGER);
 f.inventory.snapshot.page_verification.total_workers=29;
 f.packet.inventory_sha256=digest(f.inventory.snapshot);
},'qa_rejected_until_ledger_in_current_inventory',true,PHASE_QA));
test('32 QA Worker needs earlier independent ledger receipt',()=>reject(f=>{
 f.priorLedgerAcceptance=null;
},'exact_prior_ledger_receipt_bound_to_new_inventory',false,PHASE_QA));
test('33 QA Worker receipt invalid signature cannot be used',()=>reject(f=>{
 f.priorLedgerAcceptance.signature.signature=
 (f.priorLedgerAcceptance.signature.signature[0]==='A'?'B':'A')+f.priorLedgerAcceptance.signature.signature.slice(1);
},'private_independent_ledger_postflight_signature',false,PHASE_QA));
test('34 QA Worker receipt with public exposure fails',()=>reject(f=>{
 f.priorLedgerAcceptance.receipt.no_public_route=false;
 f.packet.ledger_receipt_sha256=digest(f.priorLedgerAcceptance.receipt);
},'exact_prior_ledger_receipt_bound_to_new_inventory',true,PHASE_QA));
test('35 QA Worker receipt wrong namespace fails',()=>reject(f=>{
 f.priorLedgerAcceptance.receipt.namespace_name='other-namespace';
 f.packet.ledger_receipt_sha256=digest(f.priorLedgerAcceptance.receipt);
},'exact_prior_ledger_receipt_bound_to_new_inventory',true,PHASE_QA));
test('36 QA Worker ledger postflight signer cannot reuse owner key',()=>reject(f=>{
 f.trustedRegistry.ledger_postflight.spki_pem=f.trustedRegistry.owner.spki_pem;
},'private_independent_ledger_postflight_signature',false,PHASE_QA));
test('37 QA Worker target already exists must block',()=>reject(f=>{
 f.inventory.snapshot.worker_names.push(WORKER);
 f.inventory.snapshot.script_names.push(WORKER);
 f.inventory.snapshot.page_verification.total_workers=31;
 f.packet.inventory_sha256=digest(f.inventory.snapshot);
},'target_resource_absent',true,PHASE_QA));
test('38 switched phase cannot reuse ledger approvals',()=>reject(f=>{
 f.packet.phase=PHASE_QA;f.packet.target_worker=WORKER;
},'five_independently_signed_phase_bound_attestations'));
test('39 attacker key ID registered flag false rejects',()=>reject(f=>{
 f.trustedRegistry.finance.registered_out_of_band=false;
},'five_independent_out_of_band_role_keys'));
test('40 no URL/file reference fields anywhere inside packet positive reference set',()=>{
 const f=fixture();
 assert(!JSON.stringify(f.packet).includes('https://'));
 assert(f.packet.private_evidence_refs.owner_authority.ref_id.startsWith('EV-'));
});

test('41 missing V17.5 namespace in otherwise consistent signed inventory blocks',()=>reject(f=>{
 f.inventory.snapshot.do_namespace_names.shift();
 f.packet.inventory_sha256=digest(f.inventory.snapshot);
},'fresh_full_independent_inventory_digest',true));
test('42 QA Worker requires independently inventoried hosted ledger namespace',()=>reject(f=>{
 f.inventory.snapshot.do_namespace_names=
  f.inventory.snapshot.do_namespace_names.filter(n=>n!==LEDGER+'_V174PPermitLedger');
 f.packet.inventory_sha256=digest(f.inventory.snapshot);
},'qa_rejected_until_ledger_in_current_inventory',true,PHASE_QA));
test('43 stale hosted ledger receipt from one day ago cannot authorize QA',()=>reject(f=>{
 f.priorLedgerAcceptance.receipt.created_at=new Date(NOW-86400001).toISOString();
 f.packet.ledger_receipt_sha256=digest(f.priorLedgerAcceptance.receipt);
},'exact_prior_ledger_receipt_bound_to_new_inventory',true,PHASE_QA));
test('44 unreviewed extra authority field cannot bypass exact signer set',()=>reject(f=>{
 f.signatures.superadmin={key_id:'synthetic-superadmin',signature:'x'};
},'five_independently_signed_phase_bound_attestations'));
test('45 duplicated Worker script name in signed inventory is disallowed',()=>reject(f=>{
 f.inventory.snapshot.worker_names[0]=f.inventory.snapshot.worker_names[1];
 f.inventory.snapshot.script_names[0]=f.inventory.snapshot.script_names[1];
 f.packet.inventory_sha256=digest(f.inventory.snapshot);
},'fresh_full_independent_inventory_digest',true));

'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {SOURCES,REQUIRED,reviewP0dDossier}=require('./private-certification-gate.cjs');
function packet(){
 const receipts={};let n=0;
 for(const [kind,issuer] of Object.entries(REQUIRED)){
   receipts[kind]={issuer_class:issuer,status:'PENDING_INDEPENDENT_PRIVATE_REVIEW',
      ticket:'SEC-PRIVATE'+String(n++).padStart(12,'0')};
 }
 return {contract:'TIEN404_V15_P0D_READINESS_V1',
   project:'ifxlvrhyjhbzbrkdsida',request_id:'P0D-REVIEWONLY00001',receipts};
}
const noRelease=r=>{
 for(const k of ['real_owner_certified','hosted_backup_certified',
 'hosted_restore_certified','real_signed_approval_certified',
 'hosted_store_rls_certified','may_export_hosted','may_restore_hosted',
 'may_apply_migration','may_backfill','may_send_provider',
 'may_write_orders','may_enable_paid_models','pilot_allowed']){
   assert.equal(r[k],false,k);
 }
 assert.equal(r.review_only,true);
};
test('empty dossier blocks every real action',()=>{
 const r=reviewP0dDossier({...packet(),receipts:{}});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.missing_private_proof.length,Object.keys(REQUIRED).length);
 noRelease(r);
});
test('all private ticket references only request human review',()=>{
 const r=reviewP0dDossier(packet());
 assert.equal(r.reason,'INDEPENDENT_HUMAN_VERIFICATION_AND_EXPLICIT_APPROVAL_REQUIRED');
 assert.equal(r.missing_private_proof.length,0);
 noRelease(r);
});
test('source rehearsal evidence is explicitly never hosted certification',()=>{
 assert.equal(SOURCES.recovery_rehearsal.pr,132);
 assert.equal(SOURCES.backup_approval_rehearsal.pr,135);
 assert.equal(SOURCES.store_expand_rehearsal.pr,136);
 for(const entry of Object.values(SOURCES)) assert.match(entry.level,/SYNTHETIC/);
 noRelease(reviewP0dDossier(packet()));
});
test('not having independent merchant owner proof blocks',()=>{
 const p=packet();delete p.receipts.merchant_auth_witness;
 const r=reviewP0dDossier(p);
 assert.deepEqual(r.missing_private_proof,['merchant_auth_witness']);
 noRelease(r);
});
test('shop owner proof cannot authorize project-wide export',()=>{
 const p=packet();delete p.receipts.platform_controller_approval;
 assert.equal(reviewP0dDossier(p).missing_private_proof[0],'platform_controller_approval');
});
test('private restore proof is separate from a local synthetic restore',()=>{
 const p=packet();delete p.receipts.isolated_restore;
 const r=reviewP0dDossier(p);
 assert.ok(r.missing_private_proof.includes('isolated_restore'));
 noRelease(r);
});
test('native provider ownership cannot be replaced with QA pairing',()=>{
 const p=packet();p.receipts.provider_owner_consent.issuer_class='QA_BINDING';
 assert.equal(reviewP0dDossier(p).reason,'MALFORMED_OR_UNTRUSTED_PRIVATE_PROOF_REFERENCE');
});
test('fake PASS or VERIFIED claims are denied',()=>{
 for(const s of ['PASS','APPROVED','VERIFIED','SIGNED_REAL']){
  const p=packet();p.receipts.backup_integrity.status=s;
  noRelease(reviewP0dDossier(p));
  assert.equal(reviewP0dDossier(p).reason,'MALFORMED_OR_UNTRUSTED_PRIVATE_PROOF_REFERENCE');
 }
});
test('confidential data and credentials cannot enter public ticket manifest',()=>{
 for(const field of ['email','user_id','password','token','jwt','private_key','backup_url']){
  const p=packet();p.receipts.merchant_auth_witness[field]='redacted';
  const r=reviewP0dDossier(p);
  assert.equal(r.reason,'MALFORMED_OR_UNTRUSTED_PRIVATE_PROOF_REFERENCE');
  noRelease(r);
 }
});
test('duplicate ticket cannot prove two independent roles',()=>{
 const p=packet();
 p.receipts.independent_security_approval.ticket=p.receipts.platform_controller_approval.ticket;
 assert.equal(reviewP0dDossier(p).reason,'MALFORMED_OR_UNTRUSTED_PRIVATE_PROOF_REFERENCE');
});
test('two distinct independent reviewers required for backup export',()=>{
 const p=packet();delete p.receipts.independent_security_approval;
 assert.ok(reviewP0dDossier(p).missing_private_proof.includes('independent_security_approval'));
});
test('missing encryption custody or operator blocks',()=>{
 for(const k of ['encryption_destination','scoped_export_operator','private_export_manifest']){
  const p=packet();delete p.receipts[k];assert.ok(reviewP0dDossier(p).missing_private_proof.includes(k));
 }
});
test('legacy data requires independent attribution rather than default Store',()=>{
 const p=packet();delete p.receipts.legacy_row_attribution;
 assert.ok(reviewP0dDossier(p).missing_private_proof.includes('legacy_row_attribution'));
});
test('cross project or prod scope rejected',()=>{
 for(const project of ['some_other_ref','production','']){
  const p=packet();p.project=project;
  assert.equal(reviewP0dDossier(p).reason,'INVALID_OR_OUT_OF_SCOPE_REQUEST');
 }
});
test('unknown fields and implicit authorization rejected',()=>{
 const p=packet();p.approved=true;
 assert.equal(reviewP0dDossier(p).reason,'INVALID_OR_OUT_OF_SCOPE_REQUEST');
});
test('unknown receipt categories and malformed ticket rejected',()=>{
 const p=packet();p.receipts.whitelist_admin={};
 assert.equal(reviewP0dDossier(p).reason,'MALFORMED_OR_UNTRUSTED_PRIVATE_PROOF_REFERENCE');
 const q=packet();q.receipts.isolated_restore.ticket='https://example.com/backups';
 assert.equal(reviewP0dDossier(q).reason,'MALFORMED_OR_UNTRUSTED_PRIVATE_PROOF_REFERENCE');
});
test('no-input or malicious types cannot request export',()=>{
 for(const p of [null,undefined,1,{},[],Object.create(null),'x']){
  noRelease(reviewP0dDossier(p));
 }
});

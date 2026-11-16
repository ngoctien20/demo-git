'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EVIDENCE,FORBIDDEN_PHASES,inspectOwnershipPacket}=require('./ownership-evidence-gate.cjs');
function makePack(){
  const evidence={};
  Object.entries(EVIDENCE).forEach(([name,source],i)=>{
    evidence[name]={evidence_id:'EV-CASE'+String(i).padStart(10,'0'),
      source_class:source,status:'SUBMITTED_NOT_VERIFIED',
      review_ticket:'SEC-PRIVATE00000'+String(i).padStart(2,'0')};
  });
  return {version:'V15_P0B_EVIDENCE_V1',scope:'STAGING_PRIVATE_REVIEW_ONLY',
    evidence,requested_operations:['REVIEW_PRIVATE_EVIDENCE']};
}
test('no evidence means migration always blocked',()=>{
 const x=inspectOwnershipPacket({version:'V15_P0B_EVIDENCE_V1',scope:'STAGING_PRIVATE_REVIEW_ONLY',
 evidence:{},requested_operations:[]});
 assert.equal(x.status,'BLOCKED_INCOMPLETE_OR_INVALID_EVIDENCE');
 assert.equal(x.missing_evidence.length,Object.keys(EVIDENCE).length);
 assert.equal(x.can_apply_migration,false);
});
test('complete self-declared packet is never independent verification',()=>{
 const x=inspectOwnershipPacket(makePack());
 assert.equal(x.status,'INDEPENDENT_REVIEW_REQUIRED');
 assert.equal(x.real_owner_verified,false);assert.equal(x.merchant_consent_verified,false);
 assert.equal(x.hosted_store_rls_verified,false);assert.equal(x.restore_verified,false);
 assert.equal(x.approved_migration,false);assert.equal(x.can_apply_migration,false);
});
test('fake PASS flags cannot be used as evidence',()=>{
 const p=makePack();p.evidence.auth_user.status='PASS';
 const r=inspectOwnershipPacket(p);
 assert.equal(r.status,'BLOCKED_INCOMPLETE_OR_INVALID_EVIDENCE');
 assert.deepEqual(r.malformed_evidence,['auth_user']);
});
test('one missing owner Store proof blocks',()=>{
 const p=makePack();delete p.evidence.store_membership;
 const r=inspectOwnershipPacket(p);
 assert.deepEqual(r.missing_evidence,['store_membership']);
 assert.equal(r.can_change_rls,false);
});
test('independent real provider consent is mandatory',()=>{
 const p=makePack();delete p.evidence.independent_provider_owner_consent;
 const r=inspectOwnershipPacket(p);
 assert.equal(r.missing_evidence.includes('independent_provider_owner_consent'),true);
});
test('two legacy sets demand separate provenance',()=>{
 const p=makePack();delete p.evidence.legacy_orders_attribution;
 assert.equal(inspectOwnershipPacket(p).missing_evidence.includes('legacy_orders_attribution'),true);
});
test('restore drill cannot be replaced by a backup-only claim',()=>{
 const p=makePack();delete p.evidence.isolated_restore_drill;
 const r=inspectOwnershipPacket(p);
 assert.equal(r.restore_verified,false);
 assert.equal(r.missing_evidence.includes('isolated_restore_drill'),true);
});
test('private evidence cannot contain raw email/phone/user IDs or credentials',()=>{
 const p=makePack();p.evidence.auth_user.email='person@example.org';
 assert.equal(inspectOwnershipPacket(p).status,'BLOCKED_INCOMPLETE_OR_INVALID_EVIDENCE');
 delete p.evidence.auth_user.email;p.evidence.auth_user.access_token='fake';
 assert.equal(inspectOwnershipPacket(p).status,'BLOCKED_INCOMPLETE_OR_INVALID_EVIDENCE');
});
test('plain URLs are not accepted in lieu of private evidence tickets',()=>{
 const p=makePack();p.evidence.auth_user.evidence_id='https://example.org/123';
 assert.equal(inspectOwnershipPacket(p).status,'BLOCKED_INCOMPLETE_OR_INVALID_EVIDENCE');
});
test('reusing proof ID for two independent sources is invalid',()=>{
 const p=makePack();p.evidence.store_membership.evidence_id=p.evidence.tenant_membership.evidence_id;
 const r=inspectOwnershipPacket(p);
 assert.equal(r.status,'BLOCKED_INCOMPLETE_OR_INVALID_EVIDENCE');
});
test('unknown proof keys cannot silently pass',()=>{
 const p=makePack();p.evidence.admin_override={evidence_id:'EV-OVERRIDE123456'};
 assert.equal(inspectOwnershipPacket(p).status,'BLOCKED_INCOMPLETE_OR_INVALID_EVIDENCE');
});
test('unrecognized source class is not accepted',()=>{
 const p=makePack();p.evidence.auth_user.source_class='MERCHANT_SELF_CLAIM';
 assert.equal(inspectOwnershipPacket(p).status,'BLOCKED_INCOMPLETE_OR_INVALID_EVIDENCE');
});
test('every hosted write and real send operation is rejected',()=>{
 for(const op of FORBIDDEN_PHASES){
   const p=makePack();p.requested_operations.push(op);
   const x=inspectOwnershipPacket(p);
   assert.equal(x.status,'BLOCKED_INVALID_OR_UNAUTHORIZED_PACKET',op);
   assert.equal(x.can_apply_migration,false);assert.equal(x.can_send_provider,false);
 }
});
test('client may not supply blanket approval flags or private identifiers',()=>{
 const p=makePack();p.approved=true;
 assert.equal(inspectOwnershipPacket(p).status,'BLOCKED_INVALID_OR_UNAUTHORIZED_PACKET');
});
test('invalid packet types fail closed',()=>{
 for(const p of [null,undefined,[],{},'ok',{version:'V15_P0B_EVIDENCE_V1'}]){
   const x=inspectOwnershipPacket(p);
   assert.equal(x.status,'BLOCKED_INVALID_OR_UNAUTHORIZED_PACKET');
   assert.equal(x.no_production_release,true);
 }
});
test('all output options remain non-authorizing',()=>{
 for(const p of [makePack(),{},null]){
  const x=inspectOwnershipPacket(p);
  for(const key of ['can_apply_migration','can_change_rls','can_reassign_legacy_rows',
    'can_send_provider','can_write_real_order','real_owner_verified','restore_verified']){
    assert.equal(x[key],false,key);
  }
 }
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const h=require('./private-recovery-intake.cjs');
const K=h.REASONS;
const HEX=['a','b','c','d','e','f','1','2','3','4','5','6'];
const sha=i=>HEX[i%HEX.length].repeat(64);
const roles=['roles','schema','application_data','auth_data'];
function archive(){
 const snapshotTag='QA-SNAPSHOT-METADATA01';
 return {
  projectRef:h.PROJECT,mode:'PRIVATE_OPERATOR_METADATA_ONLY',
  snapshotTag,consistentCaptureAttested:true,
  encryptedPrivateStorage:true,restrictedOperatorAccess:true,
  retentionApproved:true,noPublicUploadAttested:true,
  independentFullRestoreSucceeded:true,authFkNineValidated:true,
  fourApplicationRowsRecovered:true,roleAndPolicyParityVerified:true,
  independentRollbackSucceeded:true,
  components:roles.map((kind,i)=>({
    kind,sha256:sha(i),bytes:100+i,dumpSucceeded:true,snapshotTag
  }))
 };
}
function row(slot,i){
 const table=slot.startsWith('P')?'products':'orders';
 const types=h.CLASSES[table];
 return {
  slot,table,anonymousTenantGroup:i%2?'QA_GROUP_2':'QA_GROUP_1',
  rowVersionDigest:sha(4+i),sourceRecordDigest:sha(8+i),
  ambiguousStoreOwnership:false,sourceStillMatchesHosted:true,
  merchantActorRef:'ACT-MERCHANT-AAA00000',
  reviewerActorRef:'ACT-REVIEWER-BBB00000',
  merchantIdentityPrivatelyChecked:true,
  reviewerIdentityPrivatelyChecked:true,
  merchantSignaturePrivatelyChecked:true,
  reviewerSignaturePrivatelyChecked:true,
  evidence:types.map((type,j)=>({
    type,claimedEvidenceDigest:sha(i+j),boundToExactRecordAndStore:true,
    reviewedInPrivateRepository:true
  }))
 };
}
function intake(){
 return {projectRef:h.PROJECT,mode:'PRIVATE_OPERATOR_METADATA_ONLY',
  rows:['P01','P02','O01','O02'].map(row)};
}
const fail=(r,k)=>assert.ok(r.issueCodes.includes(k),JSON.stringify(r.issueCodes));
test('01 four mandatory archive components documented',()=>{
 assert.deepEqual(h.PARTS,roles);
});
test('02 valid-looking archive metadata is only PRIVATE MANUAL REVIEW, never actual restore',()=>{
 const r=h.inspectArchiveManifest(archive());
 assert.equal(r.status,'READY_FOR_PRIVATE_MANUAL_REVIEW_ONLY');
 assert.equal(r.authDataRestored,false);
 assert.equal(r.canMigrate,false);
});
test('03 no archive and no project is always blocked',()=>{
 fail(h.inspectArchiveManifest(),K.WRONG_SCOPE);
});
test('04 incorrect project scope is blocked',()=>{
 fail(h.inspectArchiveManifest({...archive(),projectRef:'production'}),K.WRONG_SCOPE);
});
test('05 untrusted public/upload mode is blocked',()=>{
 fail(h.inspectArchiveManifest({...archive(),mode:'PUBLIC_CI'}),K.WRONG_SCOPE);
});
test('06 original five-schema archive omits Auth-data component',()=>{
 const x=archive();x.components=x.components.filter(y=>y.kind!=='auth_data');
 fail(h.inspectArchiveManifest(x),K.ARCHIVE_SET);
});
test('07 duplicate component kind fails',()=>{
 const x=archive();x.components[3].kind='schema';
 fail(h.inspectArchiveManifest(x),K.ARCHIVE_SET);
});
test('08 duplicate archive digest fails',()=>{
 const x=archive();x.components[3].sha256=x.components[0].sha256;
 fail(h.inspectArchiveManifest(x),K.FILE_DIGEST);
});
test('09 incorrect SHA-256 length fails',()=>{
 const x=archive();x.components[0].sha256='abc';
 fail(h.inspectArchiveManifest(x),K.FILE_DIGEST);
});
test('10 zero-size file fails',()=>{
 const x=archive();x.components[2].bytes=0;
 fail(h.inspectArchiveManifest(x),K.FILE_DIGEST);
});
test('11 failed pg_dump exit is not accepted',()=>{
 const x=archive();x.components[1].dumpSucceeded=false;
 fail(h.inspectArchiveManifest(x),K.FILE_DIGEST);
});
test('12 mixed inconsistent snapshot tags fail',()=>{
 const x=archive();x.components[0].snapshotTag='QA-SNAPSHOT-OTHER0001';
 fail(h.inspectArchiveManifest(x),K.SNAPSHOT);
});
test('13 unproven snapshot consistency fails',()=>{
 const x=archive();x.consistentCaptureAttested=false;
 fail(h.inspectArchiveManifest(x),K.SNAPSHOT);
});
test('14 unencrypted storage claim fails privacy gate',()=>{
 const x=archive();x.encryptedPrivateStorage=false;
 fail(h.inspectArchiveManifest(x),K.PROTECTION);
});
test('15 no retention approval fails privacy gate',()=>{
 const x=archive();x.retentionApproved=false;
 fail(h.inspectArchiveManifest(x),K.PROTECTION);
});
test('16 missing independent rollback is blocked',()=>{
 const x=archive();x.independentRollbackSucceeded=false;
 fail(h.inspectArchiveManifest(x),K.RESTORE);
});
test('17 Auth user foreign keys not validated blocks',()=>{
 const x=archive();x.authFkNineValidated=false;
 fail(h.inspectArchiveManifest(x),K.RESTORE);
});
test('18 all four synthetic row packets are only ready for private review',()=>{
 const r=h.inspectMerchantIntake(intake());
 assert.equal(r.status,'READY_FOR_PRIVATE_MANUAL_REVIEW_ONLY');
 assert.equal(r.actualStoreOwnersVerified,0);
 assert.equal(r.canBackfill,false);
});
test('19 default owner intake never succeeds',()=>{
 fail(h.inspectMerchantIntake(),K.ROW_SLOTS);
});
test('20 missing O02 slot fails closed',()=>{
 const x=intake();x.rows=x.rows.slice(0,3);
 fail(h.inspectMerchantIntake(x),K.ROW_SLOTS);
});
test('21 duplicate product slot fails closed',()=>{
 const x=intake();x.rows[3].slot='P01';
 fail(h.inspectMerchantIntake(x),K.ROW_SLOTS);
});
test('22 product/order table mismatch fails row fingerprint',()=>{
 const x=intake();x.rows[0].table='orders';
 fail(h.inspectMerchantIntake(x),K.RECORD);
});
test('23 repeated record digest fails even with four different labels',()=>{
 const x=intake();x.rows[3].sourceRecordDigest=x.rows[0].sourceRecordDigest;
 fail(h.inspectMerchantIntake(x),K.RECORD);
});
test('24 tenant ownership group is not inferred from arbitrary values',()=>{
 const x=intake();x.rows[0].anonymousTenantGroup='ACTUAL_TENANT_UUID';
 fail(h.inspectMerchantIntake(x),K.RECORD);
});
test('25 missing primary origin evidence fails',()=>{
 const x=intake();x.rows[2].evidence=x.rows[2].evidence.slice(1);
 fail(h.inspectMerchantIntake(x),K.SOURCE);
});
test('26 contradictory or ambiguous Store ownership cannot pass',()=>{
 const x=intake();x.rows[0].ambiguousStoreOwnership=true;
 fail(h.inspectMerchantIntake(x),K.AMBIGUITY);
});
test('27 stale hosted row snapshot fails',()=>{
 const x=intake();x.rows[1].sourceStillMatchesHosted=false;
 fail(h.inspectMerchantIntake(x),K.DRIFT);
});
test('28 merchant and independent reviewer may not be same actor',()=>{
 const x=intake();x.rows[1].reviewerActorRef=x.rows[1].merchantActorRef;
 fail(h.inspectMerchantIntake(x),K.REVIEW);
});
test('29 missing real merchant signature check fails',()=>{
 const x=intake();x.rows[0].merchantSignaturePrivatelyChecked=false;
 fail(h.inspectMerchantIntake(x),K.ATTEST);
});
test('30 missing independent reviewer signature check fails',()=>{
 const x=intake();x.rows[3].reviewerSignaturePrivatelyChecked=false;
 fail(h.inspectMerchantIntake(x),K.REVIEW);
});
test('31 exact row/Store binding needed for every evidence class',()=>{
 const x=intake();x.rows[0].evidence[0].boundToExactRecordAndStore=false;
 fail(h.inspectMerchantIntake(x),K.BOUND);
});
test('32 unknown primary source digest blocked',()=>{
 const x=intake();x.rows[2].evidence[1].claimedEvidenceDigest='raw';
 fail(h.inspectMerchantIntake(x),K.BOUND);
});
test('33 forged frontend approved flag does not change verdict',()=>{
 const x=intake();x.approved=true;x.adminOverride=true;
 const r=h.inspectMerchantIntake(x);
 assert.equal(r.canBackfill,false);
 assert.equal(r.actualStoreOwnersVerified,0);
});
test('34 never echo private IDs, tokens, evidence digests or customer data',()=>{
 const secret='very-sensitive-example-not-for-logs';
 const x=intake();x.rows[0].userId=secret;x.rows[0].phone=secret;
 const out=JSON.stringify(h.inspectMerchantIntake(x));
 assert.equal(out.includes(secret),false);
 assert.equal(out.includes(x.rows[0].sourceRecordDigest),false);
 assert.equal(out.includes('ACT-MERCHANT'),false);
 assert.equal(out.includes('QA_GROUP'),false);
});
test('35 every mode refuses mutation and release even with all claimed checks',()=>{
 const a=h.inspectArchiveManifest(archive()),b=h.inspectMerchantIntake(intake());
 const c=h.releaseBoundary({archive:a,intake:b,approvedHostedMigration:true,actualJwtAcceptance:true});
 for(const r of [a,b,c]){
  assert.equal(r.canMigrate,false);assert.equal(r.canBackfill,false);
  assert.equal(r.canExecuteRpc,false);assert.equal(r.canAlterAcl,false);
  assert.equal(r.canSendProviderMessage,false);
 }
 assert.equal(c.status,'BLOCKED');
});

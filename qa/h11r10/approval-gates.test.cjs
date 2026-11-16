'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DOMAINS,reviewCutover,reviewRecovery,reviewStoreMigration}=require('./approval-gates.cjs');
const cutover=()=>({
 projectRef:'ifxlvrhyjhbzbrkdsida',
 rpc:'public.qa_shop_b_zalo_claim(uuid,text,text,text)',
 publishedV1:'yIJk8LvJoLF40Z62',publishedV2:'OgDZNSAvKEvhnAvn',
 enabledPostObserved:true,oldRpcAnonExecute:true,
 domains:DOMAINS.map((domain,i)=>({domain,independentlyObserved:true,
  coverageCertified:true,evidenceSha256:(i+1).toString(16).repeat(64)})),
 providerSignatureObserved:true,noUnknownExternalCallers:true,
 privateTwoStepHostedAcceptance:true,hostedJwtStoreIsolation:true,
 canaryAndRollbackProven:true,postCutoverMonitoringReady:true,
 independentOperationApproval:true
});
const recoveryKeys=[
 'controllerIndependentlyAuthenticated','securityReviewerIndependentlyAuthenticated',
 'backupOperatorIndependentlyAuthenticated','independentHumanSeparationVerified',
 'merchantDataScopeAndLawfulBasisApproved','encryptedOffsiteStoreAndKeyCustodyProven',
 'authRolesAclAndExternalCoverageProven','oneTimeExportAuthorizationSigned',
 'consistentIsolatedRestoreCertified','retentionAndErasureApproved'
];
const storeKeys=[
 'hostedCanonicalStores','storeIdCoreTables','legacyPerRowOwnershipProof',
 'allLegacyBackfillReconciled','sameTenantJwtApiRlsVerified',
 'tenantSkuCompatibilityApproved','compositeForeignKeysVerified',
 'legacyWritersDualReadCompatibilityVerified','recoveryConsentCertified',
 'rollbackCanaryApproved'
];
const all=keys=>Object.fromEntries(keys.map(x=>[x,true]));
const assertNoPower=r=>{
 for(const k of ['canRevokeRpc','canExportAuth','canApplyStoreMigration',
 'canMerge','canSendProvider','productionReleaseAuthorized',
 'callerCompletenessCertified','reviewerIdentityVerifiedByThisCode'])
 assert.equal(r[k],false,'unexpected privilege: '+k);
};
test('caller baseline never equals full caller inventory',()=>{
 const p=cutover();p.domains=[];p.providerSignatureObserved=false;
 const r=reviewCutover(p);
 assert.equal(r.status,'NO_GO');
 assert.ok(r.blockers.includes('SIX_INDEPENDENT_CALLER_DOMAINS_NOT_PROVEN'));
 assert.ok(r.blockers.includes('REAL_PROVIDER_SIGNATURE_UNVERIFIED'));
 assertNoPower(r);
});
test('signed-looking six-domain self report can only request independent review',()=>{
 const r=reviewCutover(cutover());
 assert.equal(r.status,'REQUIRES_INDEPENDENT_EXTERNAL_APPROVAL');
 assert.equal(r.metadataReviewedOnly,true);assertNoPower(r);
});
test('wrong project or RPC signature explicitly fails',()=>{
 const a=cutover();a.projectRef='other';a.rpc='public.unsafe(text)';
 const r=reviewCutover(a);
 assert.ok(r.blockers.includes('PROJECT_SCOPE_NOT_PINNED'));
 assert.ok(r.blockers.includes('EXACT_RPC_SIGNATURE_REQUIRED'));
 assertNoPower(r);
});
test('unverified and duplicated caller domains reject coverage',()=>{
 const a=cutover();a.domains[0].independentlyObserved=false;
 assert.ok(reviewCutover(a).blockers.includes('SIX_INDEPENDENT_CALLER_DOMAINS_NOT_PROVEN'));
 a.domains[0]=a.domains[1];
 assert.ok(reviewCutover(a).blockers.includes('SIX_INDEPENDENT_CALLER_DOMAINS_NOT_PROVEN'));
});
test('bad evidence digest or absent published chain rejects',()=>{
 const a=cutover();a.domains[0].evidenceSha256='fake';a.publishedV2='other';
 const r=reviewCutover(a);
 assert.ok(r.blockers.includes('SIX_INDEPENDENT_CALLER_DOMAINS_NOT_PROVEN'));
 assert.ok(r.blockers.includes('PUBLISHED_CALLER_CHAIN_UNVERIFIED'));
});
for(const [key,err] of [
 ['providerSignatureObserved','REAL_PROVIDER_SIGNATURE_UNVERIFIED'],
 ['noUnknownExternalCallers','EXTERNAL_CALLER_COMPLETENESS_UNKNOWN'],
 ['privateTwoStepHostedAcceptance','PRIVATE_HOSTED_TWO_STEP_NOT_ACCEPTED'],
 ['hostedJwtStoreIsolation','HOSTED_SAME_TENANT_JWT_RLS_NOT_PROVEN'],
 ['canaryAndRollbackProven','CANARY_ROLLBACK_NOT_PROVEN'],
 ['postCutoverMonitoringReady','POST_CUTOVER_MONITORING_NOT_PROVEN'],
 ['independentOperationApproval','EXACT_REVOKE_AUTHORIZATION_NOT_VERIFIED']
])test('RPC cutover refuses missing '+key,()=>{
 const p=cutover();p[key]=false;const r=reviewCutover(p);
 assert.equal(r.status,'NO_GO');assert.ok(r.blockers.includes(err));assertNoPower(r);
});
test('Auth recovery on observed metadata remains blocked',()=>{
 const r=reviewRecovery();
 assert.equal(r.status,'NO_GO');assert.ok(r.blockers.length>=10);assertNoPower(r);
});
test('even fully affirmative recovery metadata never authorizes Auth export',()=>{
 const r=reviewRecovery(all(recoveryKeys));
 assert.equal(r.status,'REQUIRES_INDEPENDENT_EXTERNAL_APPROVAL');assertNoPower(r);
});
for(const k of recoveryKeys)test('missing recovery authority '+k+' blocks',()=>{
 const packet=all(recoveryKeys);packet[k]=false;
 const r=reviewRecovery(packet);
 assert.equal(r.status,'NO_GO');assertNoPower(r);
});
test('current hosted Store schema fails migration',()=>{
 const r=reviewStoreMigration({hostedCanonicalStores:false,storeIdCoreTables:false});
 assert.equal(r.status,'NO_GO');
 assert.ok(r.blockers.includes('CANONICAL_STORES_NOT_HOSTED'));
 assert.ok(r.blockers.includes('STORE_ID_NOT_HOSTED'));assertNoPower(r);
});
test('self-reported all-green Store readiness never applies migration',()=>{
 const r=reviewStoreMigration(all(storeKeys));
 assert.equal(r.status,'REQUIRES_INDEPENDENT_EXTERNAL_APPROVAL');assertNoPower(r);
});
for(const k of storeKeys)test('Store release fails closed without '+k,()=>{
 const p=all(storeKeys);p[k]=false;
 const r=reviewStoreMigration(p);
 assert.equal(r.status,'NO_GO');assertNoPower(r);
});

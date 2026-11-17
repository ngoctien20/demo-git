import test from 'node:test';
import assert from 'node:assert/strict';
import {
 inspectPrivateMerchantConsentPacket,inspectProposedCanaryIsolation,
 prohibitClaimedRelease,originalStoreCaseRefs
} from './v17-7f-private-owner-consent-preflight.mjs';

const NOW=1794912000000,hex=(s)=>s.repeat(64);
function packet(){
 return {
   mode:'OFFLINE_REDACTED_FIXTURE',
   consentScope:'FOUR_ORIGINAL_STORE_PROVENANCE_ONLY',
   noUpload:true,noStoreRead:true,noSend:true,
   privateIntakeRef:'intake-qa-private',
   invitationDigest:hex('a'),expiryMs:NOW+1000*60*10,
   caseRefs:[...originalStoreCaseRefs],
   witnesses:originalStoreCaseRefs.map((caseRef,i)=>({
     caseRef,issuerDigest:hex('1'),ownerSessionDigest:hex('2'),
     reviewerSessionDigest:hex('3'),
     originalSourceDigest:hex(String(i+4)),
     observedAtMs:NOW,
     scope:'READONLY_ORIGINAL_STORE_BINDING'
   }))
 };
}
function isolated(){
 return {
   mode:'NO_DEPLOY_SOURCE_ONLY',
   evidenceWorker:'tien404-rpc16-merchant-evidence-inactive-staging',
   evidenceAccessAppId:'f994d4b2-d4f9-419b-8585-5d33be506f13',
   evidenceAccessAllowCount:0,evidenceAccessBypassCount:0,
   evidencePublicRoutesEnabled:false,
   merchantUploadsAllowed:false,
   providerCanaryDeployed:false,
   providerCanarySharesEvidenceWorker:false,
   providerCanarySharesCommerceCredential:false,
   providerCanaryHasOutboundBindings:false,
   providerCanaryHasDatabaseWriteBindings:false,
   activateProduction:false
 };
}
function locked(x){
 for(const field of ['realMerchantAuthorized','realOwnerVerified','independentReviewerVerified',
 'realStoreMembershipVerified','originalRecordSourceVerified','hostedR2IntakePermitted',
 'databaseMigrationPermitted','realProviderCanaryPermitted',
 'canReadCustomerRows','canSendProvider','canPublish'])
 assert.equal(x[field],false,field);
 assert.equal(x.sourceOnly,true);
}
function denyOwner(reason,fn){
 const x=packet();fn(x);
 const r=inspectPrivateMerchantConsentPacket(x,NOW);
 assert.equal(r.candidate,false);assert.equal(r.reason,reason);locked(r);
}
function denyPlan(fn){
 const p=isolated();fn(p);
 const r=inspectProposedCanaryIsolation(p);
 assert.equal(r.candidate,false);
 assert.equal(r.reason,'PRIVATE_RPC16_AND_PROVIDER_ISOLATION_NOT_PROVEN');
 locked(r);
}
test('four original evidence slots metadata are candidate ONLY',()=>{
 const x=inspectPrivateMerchantConsentPacket(packet(),NOW);
 assert.equal(x.candidate,true);assert.equal(x.caseCount,4);
 assert.equal(x.realUserSessionsInspected,0);assert.equal(x.actualSourceRowsRead,0);
 assert.equal(x.independentExternalVerifierStillRequired,true);locked(x);
});
test('missing intake mode fails closed',()=>denyOwner('PRIVATE_CONSENT_MODE_NOT_ESTABLISHED',x=>x.mode='REAL'));
test('intake cannot upload Merchant data',()=>denyOwner('PRIVATE_CONSENT_MODE_NOT_ESTABLISHED',x=>x.noUpload=false));
test('intake cannot read Store data',()=>denyOwner('PRIVATE_CONSENT_MODE_NOT_ESTABLISHED',x=>x.noStoreRead=false));
test('intake cannot send messages',()=>denyOwner('PRIVATE_CONSENT_MODE_NOT_ESTABLISHED',x=>x.noSend=false));
test('wrong consent scope blocked',()=>denyOwner('PRIVATE_CONSENT_MODE_NOT_ESTABLISHED',x=>x.consentScope='ALL_DATA'));
test('missing invitation digest blocked',()=>denyOwner('PRIVATE_INVITATION_BOUND_OR_EXPIRED',x=>x.invitationDigest='xx'));
test('expired invitation blocked',()=>denyOwner('PRIVATE_INVITATION_BOUND_OR_EXPIRED',x=>x.expiryMs=NOW-1));
test('overlong invitation blocked',()=>denyOwner('PRIVATE_INVITATION_BOUND_OR_EXPIRED',x=>x.expiryMs=NOW+30*60*1000));
test('invalid intake reference blocked',()=>denyOwner('PRIVATE_INVITATION_BOUND_OR_EXPIRED',x=>x.privateIntakeRef='a'));
test('three records cannot complete G0',()=>denyOwner('FOUR_EXACT_SOURCE_RECORDS_MISSING',x=>x.caseRefs.pop()));
test('duplicated record cannot replace missing',()=>denyOwner('FOUR_EXACT_SOURCE_RECORDS_MISSING',x=>x.caseRefs[0]=x.caseRefs[1]));
test('owner witness list cannot omit fourth row',()=>denyOwner('FOUR_EXACT_SOURCE_RECORDS_MISSING',x=>x.witnesses.pop()));
test('witness binding wrong source blocked',()=>denyOwner('FOUR_WITNESS_BINDINGS_MISSING',x=>x.witnesses[0].caseRef='OTHER_RECORD'));
test('missing issuer digest blocked',()=>denyOwner('MISSING_WITNESS_PROVENANCE_DIGEST',x=>x.witnesses[0].issuerDigest=''));
test('missing original source digest blocked',()=>denyOwner('MISSING_WITNESS_PROVENANCE_DIGEST',x=>x.witnesses[0].originalSourceDigest=''));
test('issuer cannot certify itself as owner',()=>denyOwner('NON_INDEPENDENT_ISSUER_OWNER_REVIEWER',x=>x.witnesses[0].issuerDigest=x.witnesses[0].ownerSessionDigest));
test('issuer cannot be independent reviewer',()=>denyOwner('NON_INDEPENDENT_ISSUER_OWNER_REVIEWER',x=>x.witnesses[0].issuerDigest=x.witnesses[0].reviewerSessionDigest));
test('owner and independent reviewer cannot match',()=>denyOwner('NON_INDEPENDENT_ISSUER_OWNER_REVIEWER',x=>x.witnesses[0].ownerSessionDigest=x.witnesses[0].reviewerSessionDigest));
test('expired witness blocked',()=>denyOwner('WITNESS_SCOPE_OR_FRESHNESS_INVALID',x=>x.witnesses[0].observedAtMs=NOW-600001));
test('future witness blocked',()=>denyOwner('WITNESS_SCOPE_OR_FRESHNESS_INVALID',x=>x.witnesses[0].observedAtMs=NOW+600001));
test('source witness cannot request store write',()=>denyOwner('WITNESS_SCOPE_OR_FRESHNESS_INVALID',x=>x.witnesses[0].scope='STORE_WRITE'));
for(const f of ['jwt','raw_payload','phone','email','access_token','merchant_name','message','signature']){
 test('owner witness cannot include '+f,()=>denyOwner('PII_OR_UNKNOWN_WITNESS_FIELD',x=>x.witnesses[0][f]='fake'));
}
for(const f of ['jwt','proofVerified','access_token','ownerId','storeId','approved']){
 test('packet top level cannot include '+f,()=>denyOwner('RAW_IDENTITY_OR_UNTRUSTED_TOP_LEVEL_FIELD',x=>x[f]='fake'));
}
test('private Merchant evidence and provider webhook must remain separate',()=>{
 const r=inspectProposedCanaryIsolation(isolated());
 assert.equal(r.candidate,true);assert.equal(r.isolatedInfrastructurePlan,true);
 assert.equal(r.hostedExternalAccessDeniedProved,false);
 assert.equal(r.providerSignedWebhookProved,false);locked(r);
});
test('RPC16 Access Allow cannot be auto enabled',()=>denyPlan(p=>p.evidenceAccessAllowCount=1));
test('RPC16 Access Bypass cannot be enabled',()=>denyPlan(p=>p.evidenceAccessBypassCount=1));
test('merchant evidence Worker cannot expose route',()=>denyPlan(p=>p.evidencePublicRoutesEnabled=true));
test('merchant upload cannot happen in this phase',()=>denyPlan(p=>p.merchantUploadsAllowed=true));
test('provider canary cannot be deployed in source-only plan',()=>denyPlan(p=>p.providerCanaryDeployed=true));
test('provider webhook cannot share RPC16 Worker',()=>denyPlan(p=>p.providerCanarySharesEvidenceWorker=true));
test('provider webhook cannot borrow Commerce credentials',()=>denyPlan(p=>p.providerCanarySharesCommerceCredential=true));
test('canary cannot get outbound bindings',()=>denyPlan(p=>p.providerCanaryHasOutboundBindings=true));
test('canary cannot get DB write bindings',()=>denyPlan(p=>p.providerCanaryHasDatabaseWriteBindings=true));
test('no accidental production activation',()=>denyPlan(p=>p.activateProduction=true));
test('inaccurate access app name not accepted',()=>denyPlan(p=>p.evidenceAccessAppId='another-id'));
test('wrong RPC16 Worker name not accepted',()=>denyPlan(p=>p.evidenceWorker='tien404-public-worker'));
test('claimed all-green proof remains NO-GO',()=>{
 const r=prohibitClaimedRelease({ownerVerified:true,providerVerified:true,approved:true});
 assert.equal(r.prerequisites.length,7);assert.equal(r.realCanaryApproved,false);locked(r);
});

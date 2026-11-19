import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import {assessPrivateReviewGate,canonicalRequest} from './private-secdef-review-gate.mjs';
import {checkLocalHarnessBlueprint,getHarnessPlan} from './isolated-gotrue-harness-plan.mjs';
import {verifySyntheticTransactionAttestation,canonicalAttestation,describeTransactionAttestationBoundary}
 from './auth-store-tx-attestation.mjs';

const manifest=JSON.parse(readFileSync(new URL('../v18.3.6o/SECDEF_METADATA_MANIFEST.json',import.meta.url),'utf8'));
const N=1800000000,H=x=>x.repeat(64);
const owner=generateKeyPairSync('ed25519'),reviewer=generateKeyPairSync('ed25519'),
      attacker=generateKeyPairSync('ed25519');
const pem=k=>k.publicKey.export({type:'spki',format:'pem'});
const clone=x=>structuredClone(x);
function reviewRequest(){
 return {protocol:'TIEN404_PRIVATE_SECDEF_REVIEW_REQUEST_P1',project:'ifxlvrhyjhbzbrkdsida',
   environment:'STAGING',operation:'READ_ONLY_PRIVATE_SOURCE_INSPECTION',
   manifestCommit:H('a'),targetIdentityDigests:manifest.functions.slice(0,2).map(x=>x.identity_sha256),
   ownerActor:'synthetic-owner',reviewerActor:'synthetic-reviewer',implementerActor:'synthetic-implementer',
   issuedAt:N-1,expiresAt:N+900,noFunctionBodyLogging:true,readOnly:true,
   evidenceDestination:'https://private-review.example.invalid/fixture-1',
   forbidsAuthSessions:true,forbidsSecrets:true,forbidsPrivilegeChanges:true};
}
function review(args={}){
 const request=args.request||reviewRequest();
 const proofKey=args.proofKey||owner.privateKey;
 const reviewerKey=args.reviewerKey||reviewer.privateKey;
 const ownerProof=args.ownerProof||{algorithm:'Ed25519',
  signature:sign(null,Buffer.from(canonicalRequest(request)),proofKey).toString('hex')};
 const reviewerProof=args.reviewerProof||{algorithm:'Ed25519',
  signature:sign(null,Buffer.from(canonicalRequest(request)),reviewerKey).toString('hex')};
 return assessPrivateReviewGate({manifest:args.manifest||manifest,request,ownerProof,reviewerProof,
   fixtureTrust:args.fixtureTrust===undefined?{
     mode:'SYNTHETIC_OFFLINE_TEST',ownerKey:pem(owner),reviewerKey:pem(reviewer)
   }:args.fixtureTrust},args.now??N);
}
const audit=[
// expected good fixture still no real owner approval
 ['dual ephemeral signatures validate but authorize nothing',()=>{const r=review();assert.equal(r.status,'SYNTHETIC_SIGNATURES_PASS_PRIVATE_HUMAN_APPROVAL_STILL_REQUIRED');assert.equal(r.functionBodyReadAuthorized,false);}],
 ['private review never grants data access',()=>assert.equal(review().realAuthAccessAllowed,false)],
 ['private review never permits permission writes',()=>assert.equal(review().permissionWritesAllowed,false)],
 ['private review never admits production',()=>assert.equal(review().productionAdmitted,false)],
 ['invalid untrusted fixture registry fails',()=>assert.ok(review({fixtureTrust:{mode:'NONE'}}).findings.includes('TRUSTED_REAL_OWNER_REVIEWER_KEYS_NOT_ESTABLISHED'))],
 ['missing owner signature denied',()=>assert.ok(review({ownerProof:{algorithm:'Ed25519',signature:'00'}}).findings.includes('OWNER_SYNTHETIC_PROOF_INVALID'))],
 ['missing reviewer signature denied',()=>assert.ok(review({reviewerProof:{algorithm:'none',signature:'00'}}).findings.includes('REVIEWER_SYNTHETIC_PROOF_INVALID'))],
 ['different reviewer public key denied',()=>assert.ok(review({fixtureTrust:{mode:'SYNTHETIC_OFFLINE_TEST',ownerKey:pem(owner),reviewerKey:pem(attacker)}}).findings.includes('REVIEWER_SYNTHETIC_PROOF_INVALID'))],
 ['wrong owner private key signed request denied',()=>assert.ok(review({proofKey:attacker.privateKey}).findings.includes('OWNER_SYNTHETIC_PROOF_INVALID'))],
 ['tampered signed manifest SHA detected',()=>{const r=reviewRequest();r.manifestCommit=H('b');const old=reviewRequest();const p={algorithm:'Ed25519',signature:sign(null,Buffer.from(canonicalRequest(old)),owner.privateKey).toString('hex')};assert.ok(review({request:r,ownerProof:p}).findings.includes('OWNER_SYNTHETIC_PROOF_INVALID'));}],
 ['wrong project forbidden',()=>{const r=reviewRequest();r.project='prod';assert.ok(review({request:r}).findings.includes('TARGET_STAGING_ONLY'));}],
 ['non-STAGING environment forbidden',()=>{const r=reviewRequest();r.environment='PRODUCTION';assert.ok(review({request:r}).findings.includes('TARGET_STAGING_ONLY'));}],
 ['wrong operation forbidden',()=>{const r=reviewRequest();r.operation='GRANT_EXECUTE';assert.ok(review({request:r}).findings.includes('OPERATION_NOT_ALLOWED'));}],
 ['owner and reviewer identical actors forbidden',()=>{const r=reviewRequest();r.reviewerActor=r.ownerActor;assert.ok(review({request:r}).findings.includes('THREE_DISTINCT_ACTORS_REQUIRED'));}],
 ['reviewer and implementer identical forbidden',()=>{const r=reviewRequest();r.reviewerActor=r.implementerActor;assert.ok(review({request:r}).findings.includes('THREE_DISTINCT_ACTORS_REQUIRED'));}],
 ['expired approval denied',()=>{const r=reviewRequest();r.expiresAt=N-1;assert.ok(review({request:r}).findings.includes('SHORT_LIVED_REVIEW_WINDOW_REQUIRED'));}],
 ['future issuance denied',()=>{const r=reviewRequest();r.issuedAt=N+15;assert.ok(review({request:r}).findings.includes('SHORT_LIVED_REVIEW_WINDOW_REQUIRED'));}],
 ['overlong window denied',()=>{const r=reviewRequest();r.expiresAt=N+4000;assert.ok(review({request:r}).findings.includes('SHORT_LIVED_REVIEW_WINDOW_REQUIRED'));}],
 ['missing exact function identity denied',()=>{const r=reviewRequest();r.targetIdentityDigests=[H('1')];assert.ok(review({request:r}).findings.includes('EXACT_MANIFEST_TARGETS_REQUIRED'));}],
 ['duplicate selected function denied',()=>{const r=reviewRequest();r.targetIdentityDigests=[r.targetIdentityDigests[0],r.targetIdentityDigests[0]];assert.ok(review({request:r}).findings.includes('EXACT_MANIFEST_TARGETS_REQUIRED'));}],
 ['no selected function denied',()=>{const r=reviewRequest();r.targetIdentityDigests=[];assert.ok(review({request:r}).findings.includes('EXACT_MANIFEST_TARGETS_REQUIRED'));}],
 ['readOnly must explicitly be true',()=>{const r=reviewRequest();r.readOnly=false;assert.ok(review({request:r}).findings.includes('STRICT_READ_ONLY_REDACTION_REQUIRED'));}],
 ['no logs of function bodies mandatory',()=>{const r=reviewRequest();r.noFunctionBodyLogging=false;assert.ok(review({request:r}).findings.includes('STRICT_READ_ONLY_REDACTION_REQUIRED'));}],
 ['Auth session read prohibited',()=>{const r=reviewRequest();r.forbidsAuthSessions=false;assert.ok(review({request:r}).findings.includes('STRICT_READ_ONLY_REDACTION_REQUIRED'));}],
 ['secrets read prohibited',()=>{const r=reviewRequest();r.forbidsSecrets=false;assert.ok(review({request:r}).findings.includes('STRICT_READ_ONLY_REDACTION_REQUIRED'));}],
 ['grant changes prohibited',()=>{const r=reviewRequest();r.forbidsPrivilegeChanges=false;assert.ok(review({request:r}).findings.includes('STRICT_READ_ONLY_REDACTION_REQUIRED'));}],
 ['unknown evidence destination forbidden',()=>{const r=reviewRequest();r.evidenceDestination='https://public.example.com';assert.ok(review({request:r}).findings.includes('FIXTURE_PRIVATE_EVIDENCE_DESTINATION_REQUIRED'));}],
 ['drifted O manifest prevents review',()=>{const m=clone(manifest);m.functions[0].identity_arguments+='tampered';assert.ok(review({manifest:m}).findings.includes('MANIFEST_METADATA_DRIFT'));}],
];
for(const [i,[name,fn]] of audit.entries())test('A'+String(i+1).padStart(2,'0')+' '+name,fn);

function localPlan(){return {
 mode:'PLAN_ONLY',target:'BRAND_NEW_DISPOSABLE_LOCAL',projectRef:null,
 supabaseCliVersion:'2.99.1',gotrueImageDigest:'sha256:'+H('a'),
 postgresImageDigest:'sha256:'+H('b'),bindAddress:'127.0.0.1',
 externalEgressBlocked:true,smtpNetworkDisabled:true,smsNetworkDisabled:true,
 webhookNetworkDisabled:true,containerImagePullPreflightComplete:true,
 privateLocalCredentialStore:true,tokenLogRedaction:true,noRealOwners:true,
 syntheticDataOnly:true,noStagingVolumes:true,sameDatabaseForAuthAndStore:true,
 lockingAndRowPrivilegePreflight:true,twoPersonResourceApproval:true,
 separateLocalTestApproval:true,cleanupProcedureReviewed:true,
 disposableVolumeVerified:true,productionServicesEnabled:false,
 providerSendEnabled:false,usesActualAuthUsers:false,usesServiceRoleFromStaging:false
};}
const harness=[
 ['complete blueprint is plan only',()=>assert.equal(checkLocalHarnessBlueprint(localPlan()).status,'PLAN_READY_FOR_HUMAN_REVIEW_ONLY')],
 ['plan cannot launch containers',()=>assert.equal(checkLocalHarnessBlueprint(localPlan()).containersStarted,0)],
 ['plan cannot call actual GoTrue',()=>assert.equal(checkLocalHarnessBlueprint(localPlan()).actualAuthCalls,0)],
 ['plan cannot read session rows',()=>assert.equal(checkLocalHarnessBlueprint(localPlan()).authSessionsRead,0)],
 ['plan cannot admit production',()=>assert.equal(checkLocalHarnessBlueprint(localPlan()).productionAdmitted,false)],
 ['missing plan blocked',()=>assert.equal(checkLocalHarnessBlueprint({}).status,'BLOCKED_HARNESS_BLUEPRINT')],
 ['remote target project forbidden',()=>{const x=localPlan();x.projectRef='ifxlvrhyjhbzbrkdsida';assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('NO_EXISTING_PROJECT_REF'));}],
 ['production target forbidden',()=>{const x=localPlan();x.target='PRODUCTION';assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('LOCAL_ONLY'));}],
 ['unversioned CLI forbidden',()=>{const x=localPlan();x.supabaseCliVersion='latest';assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('PIN_CLI_VERSION'));}],
 ['missing GoTrue digest forbidden',()=>{const x=localPlan();x.gotrueImageDigest='';assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('PIN_CONTAINER_DIGESTS'));}],
 ['missing PG digest forbidden',()=>{const x=localPlan();x.postgresImageDigest='';assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('PIN_CONTAINER_DIGESTS'));}],
 ['bind public listener forbidden',()=>{const x=localPlan();x.bindAddress='0.0.0.0';assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('LOOPBACK_ONLY'));}],
 ['external egress must block',()=>{const x=localPlan();x.externalEgressBlocked=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('NO_EXTERNAL_EGRESS'));}],
 ['smtp disabled externally',()=>{const x=localPlan();x.smtpNetworkDisabled=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('NO_EXTERNAL_EGRESS'));}],
 ['SMS disabled externally',()=>{const x=localPlan();x.smsNetworkDisabled=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('NO_EXTERNAL_EGRESS'));}],
 ['webhook disabled externally',()=>{const x=localPlan();x.webhookNetworkDisabled=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('NO_EXTERNAL_EGRESS'));}],
 ['offline image preflight needed',()=>{const x=localPlan();x.containerImagePullPreflightComplete=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('OFFLINE_IMAGE_CACHE_PREFLIGHT'));}],
 ['test credentials private',()=>{const x=localPlan();x.privateLocalCredentialStore=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('CREDENTIAL_REDACTION'));}],
 ['token logs redacted',()=>{const x=localPlan();x.tokenLogRedaction=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('CREDENTIAL_REDACTION'));}],
 ['explicit no real owners required',()=>{const x=localPlan();delete x.noRealOwners;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('SYNTHETIC_ISOLATION_ONLY'));}],
 ['synthetic only data required',()=>{const x=localPlan();x.syntheticDataOnly=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('SYNTHETIC_ISOLATION_ONLY'));}],
 ['do not mount staging volumes',()=>{const x=localPlan();x.noStagingVolumes=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('SYNTHETIC_ISOLATION_ONLY'));}],
 ['same database topology required',()=>{const x=localPlan();x.sameDatabaseForAuthAndStore=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('SAME_DB_TOPOLOGY_REQUIRED'));}],
 ['DB row lock permissions preflight required',()=>{const x=localPlan();x.lockingAndRowPrivilegePreflight=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('TRANSACTION_LOCKS_AND_ROLES_PREFLIGHT'));}],
 ['two person resource approval required',()=>{const x=localPlan();x.twoPersonResourceApproval=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('RESOURCE_APPROVAL_REQUIRED'));}],
 ['independent local UAT approval required',()=>{const x=localPlan();x.separateLocalTestApproval=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('RESOURCE_APPROVAL_REQUIRED'));}],
 ['cleanup procedure reviewed',()=>{const x=localPlan();x.cleanupProcedureReviewed=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('CLEANUP_RESTORE_PLAN'));}],
 ['disposable volume verified',()=>{const x=localPlan();x.disposableVolumeVerified=false;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('CLEANUP_RESTORE_PLAN'));}],
 ['production services forbidden',()=>{const x=localPlan();x.productionServicesEnabled=true;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('LIVE_SERVICES_FORBIDDEN'));}],
 ['actual Auth users forbidden',()=>{const x=localPlan();x.usesActualAuthUsers=true;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('LIVE_SERVICES_FORBIDDEN'));}],
 ['service role from staging forbidden',()=>{const x=localPlan();x.usesServiceRoleFromStaging=true;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('LIVE_SERVICES_FORBIDDEN'));}],
 ['provider sends forbidden',()=>{const x=localPlan();x.providerSendEnabled=true;assert.ok(checkLocalHarnessBlueprint(x).blockers.includes('LIVE_SERVICES_FORBIDDEN'));}],
 ['plan advertises non-execution',()=>{const x=getHarnessPlan();assert.equal(x.codeActuallyExecutesContainers,false);assert.equal(x.remoteProjectConnected,false);}]
];
for(const [i,[name,fn]] of harness.entries())test('G'+String(i+1).padStart(2,'0')+' '+name,fn);

const receiptKey=generateKeyPairSync('ed25519');
function tx(){
 const id='00000000-0000-4000-8000-000000000801',jti='00000000-0000-4000-8000-000000000802';
 const start=N;
 const steps=['SESSION_AUTHORITY_CHECK','SESSION_ROW_LOCK','STORE_MEMBERSHIP_LOCK',
              'CATALOG_RESOURCE_LOCK','NONCE_CONSUME','TRANSACTION_COMMIT']
              .map((action,i)=>({action,transactionId:id,occurredAt:start+i}));
 return {protocol:'TIEN404_P_SYNTHETIC_TX_ATTEST_V1',source:'SYNTHETIC_OFFLINE_PG17_MODEL',
   database:'tien404_v1836m_disposable',transactionId:id,jti,
   issuer:'tien404-synthetic-authority',capability:'CATALOG_READ',
   sessionHash:H('a'),subjectHash:H('b'),tenantHash:H('c'),storeHash:H('d'),
   resourceHash:H('e'),membershipRevision:1,nonceResult:'FIRST_CONSUME',
   authDecision:'ACTIVE',storeDecision:'ACTIVE',resourceDecision:'OWNED_BY_STORE',
   transactionDecision:'COMMIT',startedAt:start,committedAt:start+7,steps};
}
const attest=(receipt=tx(),options={})=>{
 const proof={alg:'Ed25519',signature:sign(null,Buffer.from(canonicalAttestation(receipt)),
    options.privateKey||receiptKey.privateKey).toString('hex')};
 if(options.proofOverride)Object.assign(proof,options.proofOverride);
 return verifySyntheticTransactionAttestation(receipt,proof,options.publicKey||pem(receiptKey),
   {seenJti:options.seenJti});
};
const txn=[
 ['signed complete fixture byte-integrity passes',()=>assert.equal(attest().status,'SYNTHETIC_BYTES_VERIFIED')],
 ['valid synthetic receipt does not prove SQL commit',()=>assert.equal(attest().actualPostgresTransactionVerified,false)],
 ['valid synthetic receipt does not prove GoTrue Auth',()=>assert.equal(attest().actualGoTrueSessionVerified,false)],
 ['never grants production',()=>assert.equal(attest().productionPermission,false)],
 ['synthetic digest present',()=>assert.match(attest().syntheticReceiptDigest,/^[0-9a-f]{64}$/)],
 ['wrong signing key rejected',()=>assert.ok(attest(tx(),{privateKey:attacker.privateKey}).findings.includes('SYNTHETIC_ATTESTATION_SIGNATURE_INVALID'))],
 ['wrong verifier key rejected',()=>assert.ok(attest(tx(),{publicKey:pem(attacker)}).findings.includes('SYNTHETIC_ATTESTATION_SIGNATURE_INVALID'))],
 ['bad algorithm blocked',()=>assert.ok(attest(tx(),{proofOverride:{alg:'none'}}).findings.includes('SIGNATURE_FORMAT_INVALID'))],
 ['missing signing proof blocked',()=>{const x=tx();assert.equal(verifySyntheticTransactionAttestation(x,null,pem(receiptKey)).status,'BLOCKED_SYNTHETIC_ATTESTATION');}],
 ['wrong protocol blocked even when signed',()=>{const x=tx();x.protocol='P2';assert.ok(attest(x).findings.includes('SYNTHETIC_PROVENANCE_ONLY'));}],
 ['real Supabase source claim forbidden',()=>{const x=tx();x.source='REAL_AUTH';assert.ok(attest(x).findings.includes('SYNTHETIC_PROVENANCE_ONLY'));}],
 ['production DB claim forbidden',()=>{const x=tx();x.database='production';assert.ok(attest(x).findings.includes('SYNTHETIC_PROVENANCE_ONLY'));}],
 ['missing session hash blocked',()=>{const x=tx();x.sessionHash='';assert.ok(attest(x).findings.includes('INVALID_sessionHash'));}],
 ['invalid subject hash blocked',()=>{const x=tx();x.subjectHash='subject-id';assert.ok(attest(x).findings.includes('INVALID_subjectHash'));}],
 ['invalid Tenant hash blocked',()=>{const x=tx();x.tenantHash='x';assert.ok(attest(x).findings.includes('INVALID_tenantHash'));}],
 ['invalid Store hash blocked',()=>{const x=tx();x.storeHash='x';assert.ok(attest(x).findings.includes('INVALID_storeHash'));}],
 ['invalid resource hash blocked',()=>{const x=tx();x.resourceHash='x';assert.ok(attest(x).findings.includes('INVALID_resourceHash'));}],
 ['wrong capability blocked',()=>{const x=tx();x.capability='ORDER_WRITE';assert.ok(attest(x).findings.includes('UNAUTHORIZED_OPERATION'));}],
 ['wrong issuer blocked',()=>{const x=tx();x.issuer='untrusted';assert.ok(attest(x).findings.includes('UNAUTHORIZED_OPERATION'));}],
 ['missing membership revision blocked',()=>{const x=tx();x.membershipRevision=0;assert.ok(attest(x).findings.includes('STORE_REVISION_REQUIRED'));}],
 ['revoked Auth blocked',()=>{const x=tx();x.authDecision='REVOKED';assert.ok(attest(x).findings.includes('AUTH_STORE_NONCE_OR_COMMIT_UNVERIFIED'));}],
 ['revoked Store blocked',()=>{const x=tx();x.storeDecision='REVOKED';assert.ok(attest(x).findings.includes('AUTH_STORE_NONCE_OR_COMMIT_UNVERIFIED'));}],
 ['cross Store resource rejected',()=>{const x=tx();x.resourceDecision='WRONG_STORE';assert.ok(attest(x).findings.includes('AUTH_STORE_NONCE_OR_COMMIT_UNVERIFIED'));}],
 ['replayed nonce result rejected',()=>{const x=tx();x.nonceResult='REPLAY';assert.ok(attest(x).findings.includes('AUTH_STORE_NONCE_OR_COMMIT_UNVERIFIED'));}],
 ['rolled back transaction rejected',()=>{const x=tx();x.transactionDecision='ROLLBACK';assert.ok(attest(x).findings.includes('AUTH_STORE_NONCE_OR_COMMIT_UNVERIFIED'));}],
 ['commit without nonce step rejected',()=>{const x=tx();x.steps.splice(4,1);assert.ok(attest(x).findings.includes('SINGLE_TRANSACTION_LOCK_ORDER_INVALID'));}],
 ['session check after member lock rejected',()=>{const x=tx();[x.steps[0],x.steps[2]]=[x.steps[2],x.steps[0]];assert.ok(attest(x).findings.includes('SINGLE_TRANSACTION_LOCK_ORDER_INVALID'));}],
 ['cross-transaction lock evidence rejected',()=>{const x=tx();x.steps[2].transactionId='00000000-0000-4000-8000-000000000809';assert.ok(attest(x).findings.includes('SINGLE_TRANSACTION_LOCK_ORDER_INVALID'));}],
 ['reordered event timestamp rejected',()=>{const x=tx();x.steps[2].occurredAt=N-1;assert.ok(attest(x).findings.includes('SINGLE_TRANSACTION_LOCK_ORDER_INVALID'));}],
 ['late timestamp rejected',()=>{const x=tx();x.committedAt=N+100;assert.ok(attest(x).findings.includes('TRANSACTION_CLOCK_INVALID'));}],
 ['commit before begin rejected',()=>{const x=tx();x.committedAt=N-1;assert.ok(attest(x).findings.includes('TRANSACTION_CLOCK_INVALID'));}],
 ['duplicate JTI in local fixture rejected',()=>assert.ok(attest(tx(),{seenJti:new Set([tx().jti])}).findings.includes('LOCAL_FIXTURE_REPLAY_DETECTED'))],
 ['no true durable nonce claim',()=>assert.equal(attest().durableNonceLedgerVerified,false)],
 ['no actual owner A/B proof',()=>assert.equal(attest().actualOwnerABVerified,false)],
 ['boundary names previous disposable PG17 proof',()=>assert.match(describeTransactionAttestationBoundary().baselineDisposablePg17Evidence,/44505388890/)],
 ['boundary blocks real Auth claim',()=>assert.equal(describeTransactionAttestationBoundary().actualGoTrueDeleteRaceNotVerified,true)],
 ['altered store field invalidates prior signature',()=>{const original=tx(),proof={alg:'Ed25519',signature:sign(null,Buffer.from(canonicalAttestation(original)),receiptKey.privateKey).toString('hex')};original.storeHash=H('f');assert.ok(verifySyntheticTransactionAttestation(original,proof,pem(receiptKey)).findings.includes('SYNTHETIC_ATTESTATION_SIGNATURE_INVALID'));}]
];
for(const [i,[name,fn]] of txn.entries())test('T'+String(i+1).padStart(2,'0')+' '+name,fn);

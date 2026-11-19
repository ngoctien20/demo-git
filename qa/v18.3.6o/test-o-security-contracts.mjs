import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewManifest,identityDigest,compareManifestToFreshMetadata} from './secdef-manifest-review.mjs';
import {gotrueScenarios,assessDisposableGoTruePlan,makeGoTrueEvidenceChecklist} from './gotrue-disposable-plan.mjs';
import {proofOptions,proofCriteria,assessRpcProofOption,summarizeRpcOptions} from './rpc-proof-admissibility.mjs';
const base=JSON.parse(readFileSync(new URL('./SECDEF_METADATA_MANIFEST.json',import.meta.url),'utf8'));
const cp=x=>structuredClone(x),sha=c=>c.repeat(64);
const check=(label,fn)=>test(label,fn);
const reviewed=()=>reviewManifest(cp(base));
const plan=()=>({
 executionMode:'PLAN_ONLY',target:'LOCAL_DISPOSABLE_SUPABASE_STACK',targetProjectRef:null,
 egressDisabled:true,publicEndpointDisabled:true,syntheticUsersOnly:true,
 credentialsGeneratedEphemerally:true,noSecretLogging:true,noProductionConfigMounts:true,
 noPersistentCustomerData:true,samePostgresAuthAndStoreVerified:true,
 teardownAndEvidenceRetentionPlan:true,approvalForResourceCreation:true,
 independentReviewerAssigned:true,toolVersionPinnedDigest:sha('a'),
 realSupabaseProjectConnected:false,productionCredentialMounted:false,
 providerSendsAllowed:false,migrationsToStagingAllowed:false
});
const evidence=()=>Object.fromEntries(proofCriteria.map(k=>[k,true]));

const mc=[
 ['manifest exactly four read-only review targets',()=>assert.equal(reviewed().observedEntries,4)],
 ['baseline manifest only ready for review scope',()=>assert.equal(reviewed().status,'READY_FOR_PRIVATE_REVIEW_SCOPE_REQUEST')],
 ['metadata is not a code review',()=>assert.equal(reviewed().actualSecurityReviewPerformed,false)],
 ['identity hashes match SQL identity string',()=>{for(const f of base.functions)assert.equal(identityDigest(f),f.identity_sha256);}],
 ['no actual body hash admitted',()=>assert.equal(reviewed().actualFunctionBodyHashVerified,false)],
 ['no owner approval asserted',()=>assert.equal(reviewed().externalOwnerApprovalVerified,false)],
 ['no production access admitted',()=>assert.equal(reviewed().productionAdmitted,false)],
 ['function identity argument drift blocked',()=>{const x=cp(base);x.functions[0].identity_arguments+=' , i int';assert.equal(reviewManifest(x).status,'BLOCKED_METADATA_DRIFT');}],
 ['function owner role drift blocked',()=>{const x=cp(base);x.functions[0].owner_role='anon';assert.ok(reviewManifest(x).blockers.includes('FUNCTION_SCOPE_OR_OWNER_DRIFT'));}],
 ['effective anon grant drift blocked',()=>{const x=cp(base);x.functions[1].anon_exec=false;assert.ok(reviewManifest(x).blockers.some(y=>y.startsWith('ROLE_GRANT_METADATA_DRIFT')));}],
 ['unexpected new function blocked',()=>{const x=cp(base);x.functions.push({...x.functions[0],name:'extra'});assert.equal(reviewManifest(x).status,'BLOCKED_METADATA_DRIFT');}],
 ['duplicate function blocked',()=>{const x=cp(base);x.functions[1]=cp(x.functions[0]);assert.ok(reviewManifest(x).blockers.includes('EXACT_FOUR_FUNCTIONS_REQUIRED'));}],
 ['wrong project blocked',()=>{const x=cp(base);x.project_ref='wrong';assert.ok(reviewManifest(x).blockers.includes('STAGING_IDENTITY_MISMATCH'));}],
 ['missing search path config blocked',()=>{const x=cp(base);x.functions[1].search_path_configured=false;assert.equal(reviewManifest(x).status,'BLOCKED_METADATA_DRIFT');}],
 ['unexpected function source blocked',()=>{const x=cp(base);x.functions[1].prosrc='forbidden';assert.ok(reviewManifest(x).blockers.includes('SENSITIVE_FUNCTION_CONTENT_FORBIDDEN'));}],
 ['false body read claim blocked',()=>{const x=cp(base);x.actual_function_body_reviewed=true;assert.equal(reviewManifest(x).status,'BLOCKED_METADATA_DRIFT');}],
 ['false production approval blocked',()=>{const x=cp(base);x.production_approved=true;assert.equal(reviewManifest(x).status,'BLOCKED_METADATA_DRIFT');}],
 ['real session SELECT entitlement drift blocked',()=>{const x=cp(base);x.session_privilege_metadata.service_role_select=true;assert.ok(reviewManifest(x).blockers.includes('SESSION_METADATA_OR_PRIVILEGE_DRIFT'));}],
 ['scoped SHA comparison permits metadata review only',()=>{const r=compareManifestToFreshMetadata(base,base.functions);assert.equal(r.status,'SCOPE_DIGESTS_MATCH_METADATA_ONLY');assert.equal(r.productionAdmitted,false);}],
 ['modified fresh SHA blocks',()=>{const x=cp(base.functions);x[0].identity_sha256=sha('0');assert.equal(compareManifestToFreshMetadata(base,x).status,'BLOCKED_METADATA_DRIFT');}],
 ['missing fresh inventory blocks',()=>assert.equal(compareManifestToFreshMetadata(base,null).status,'BLOCKED_METADATA_DRIFT')]
];
for(const [i,[name,fn]] of mc.entries())check('M'+String(i+1).padStart(2,'0')+' '+name,fn);

const gc=[
 ['20 scenarios with distinct IDs',()=>{assert.equal(gotrueScenarios.length,20);assert.equal(new Set(gotrueScenarios.map(x=>x.id)).size,20);}],
 ['no scenarios have actual Auth evidence',()=>assert.ok(gotrueScenarios.every(s=>s.passed===false&&s.realEvidence==='NOT_COLLECTED'))],
 ['empty GoTrue plan is blocked',()=>assert.equal(assessDisposableGoTruePlan({}).status,'BLOCKED_PLAN_GATES')],
 ['fully specified plan still cannot start',()=>{const r=assessDisposableGoTruePlan(plan());assert.equal(r.status,'PLAN_PACKET_READY_FOR_RESOURCE_APPROVAL');assert.equal(r.authorizedToStart,false);}],
 ['no resource was created by plan',()=>assert.equal(assessDisposableGoTruePlan(plan()).resourcesCreated,false)],
 ['actual signOut remains unverified',()=>assert.equal(assessDisposableGoTruePlan(plan()).actualSignOutSemanticsVerified,false)],
 ['remote project ref forbidden',()=>{const p=plan();p.targetProjectRef='ifxlvrhyjhbzbrkdsida';assert.ok(assessDisposableGoTruePlan(p).blockers.includes('REMOTE_PROJECT_REFERENCE_FORBIDDEN'));}],
 ['no egress prevents SMTP/provider leak',()=>{const p=plan();p.egressDisabled=false;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('PROHIBIT_EXTERNAL_EGRESS'));}],
 ['no public listener',()=>{const p=plan();p.publicEndpointDisabled=false;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('NO_PUBLIC_AUTH_LISTENER'));}],
 ['synthetic users only',()=>{const p=plan();p.syntheticUsersOnly=false;assert.equal(assessDisposableGoTruePlan(p).status,'BLOCKED_PLAN_GATES');}],
 ['ephemeral credentials required',()=>{const p=plan();p.credentialsGeneratedEphemerally=false;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('EPHEMERAL_TEST_CREDENTIALS_REQUIRED'));}],
 ['no token in logs',()=>{const p=plan();p.noSecretLogging=false;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('AUTH_TOKEN_REDACTION_REQUIRED'));}],
 ['no production mounts',()=>{const p=plan();p.noProductionConfigMounts=false;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('NO_PRODUCTION_MOUNTS'));}],
 ['same PG domain prerequisite',()=>{const p=plan();p.samePostgresAuthAndStoreVerified=false;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('SAME_DB_TEST_PREREQUISITE'));}],
 ['teardown mandatory',()=>{const p=plan();p.teardownAndEvidenceRetentionPlan=false;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('TEARDOWN_PLAN_REQUIRED'));}],
 ['explicit creation approval pending',()=>{const p=plan();p.approvalForResourceCreation=false;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('RESOURCE_CREATION_APPROVAL_PENDING'));}],
 ['independent reviewer required',()=>{const p=plan();p.independentReviewerAssigned=false;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('INDEPENDENT_REVIEWER_NOT_ASSIGNED'));}],
 ['version hash mandatory',()=>{const p=plan();p.toolVersionPinnedDigest='';assert.ok(assessDisposableGoTruePlan(p).blockers.includes('PINNED_TOOL_VERSION_EVIDENCE_REQUIRED'));}],
 ['real project connected forbidden',()=>{const p=plan();p.realSupabaseProjectConnected=true;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('LIVE_SYSTEM_OR_ESCALATED_OPERATION_FORBIDDEN'));}],
 ['real production key forbidden',()=>{const p=plan();p.productionCredentialMounted=true;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('LIVE_SYSTEM_OR_ESCALATED_OPERATION_FORBIDDEN'));}],
 ['provider send forbidden',()=>{const p=plan();p.providerSendsAllowed=true;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('LIVE_SYSTEM_OR_ESCALATED_OPERATION_FORBIDDEN'));}],
 ['staging migration forbidden',()=>{const p=plan();p.migrationsToStagingAllowed=true;assert.ok(assessDisposableGoTruePlan(p).blockers.includes('LIVE_SYSTEM_OR_ESCALATED_OPERATION_FORBIDDEN'));}],
 ['checklist requires teardown and redaction',()=>{const r=makeGoTrueEvidenceChecklist();assert.equal(r.rawTokensAllowedInLogs,false);assert.ok(r.proposedSequence.some(s=>s.includes('TEARDOWN')));}],
 ['signOut scope matrix present',()=>assert.ok(['local','global','others'].every(s=>gotrueScenarios.some(x=>x.scope===s)))],
 ['ambiguity, replay, isolation covered',()=>assert.ok(['GT15','GT16','GT17','GT19'].every(id=>gotrueScenarios.some(s=>s.id===id)))]
];
for(const [i,[name,fn]] of gc.entries())check('G'+String(i+1).padStart(2,'0')+' '+name,fn);

const pc=[
 ['3 conditional and 4 rejected',()=>{const r=summarizeRpcOptions();assert.equal(r.conditional,3);assert.equal(r.rejected,4);}],
 ['12 independent hard gates',()=>assert.equal(proofCriteria.length,12)],
 ['no production DB proof selected',()=>assert.equal(summarizeRpcOptions().approvedDbVerificationMechanism,'NONE')],
 ['service-role proxy rejected',()=>assert.equal(assessRpcProofOption('X1_CLIENT_SERVICE_ROLE').status,'REJECTED')],
 ['JWT alone rejected',()=>assert.equal(assessRpcProofOption('X2_JWT_SIGNATURE_ONLY').status,'REJECTED')],
 ['public fixture key rejected',()=>assert.equal(assessRpcProofOption('X3_STATIC_QA_HMAC_KEY').status,'REJECTED')],
 ['HMAC misrepresented as Ed25519 rejected',()=>assert.equal(assessRpcProofOption('X4_PGCRYPTO_HMAC_CALLED_ED25519').status,'REJECTED')],
 ['no P1 evidence denied',()=>assert.equal(assessRpcProofOption('P1_PRIVATE_NODE_ED25519_PLUS_DB_PUBLIC_KEY_VERIFY',{}).status,'BLOCKED_CRYPTO_TRUST_GATE')],
 ['no P2 evidence denied',()=>assert.equal(assessRpcProofOption('P2_PRIVATE_NODE_ED25519_PLUS_DB_HMAC',{}).status,'BLOCKED_CRYPTO_TRUST_GATE')],
 ['no P3 evidence denied',()=>assert.equal(assessRpcProofOption('P3_PRIVATE_BACKEND_NARROW_DB_IDENTITY',{}).status,'BLOCKED_CRYPTO_TRUST_GATE')],
 ['P1 verifier support cannot be assumed',()=>assert.ok(assessRpcProofOption('P1_PRIVATE_NODE_ED25519_PLUS_DB_PUBLIC_KEY_VERIFY',evidence()).blockers.includes('ED25519_SQL_VERIFIER_UNPROVEN'))],
 ['P2 separate HMAC key custody unproven',()=>assert.ok(assessRpcProofOption('P2_PRIVATE_NODE_ED25519_PLUS_DB_HMAC',evidence()).blockers.includes('INDEPENDENT_HMAC_SECRET_REQUIRED'))],
 ['P3 DB identity not yet proven',()=>assert.ok(assessRpcProofOption('P3_PRIVATE_BACKEND_NARROW_DB_IDENTITY',evidence()).blockers.includes('PRIVATE_DB_CALLER_IMPERSONATION_UNCLOSED'))],
 ['all P1 fake evidence is review-only',()=>{const x=assessRpcProofOption('P1_PRIVATE_NODE_ED25519_PLUS_DB_PUBLIC_KEY_VERIFY',{...evidence(),supportedDatabaseEd25519VerifierPrivatelyProved:true});assert.equal(x.status,'EVIDENCE_PACKET_READY_FOR_PRIVATE_REVIEW');assert.equal(x.productionAdmitted,false);}],
 ['all P2 fake evidence is review-only',()=>{const x=assessRpcProofOption('P2_PRIVATE_NODE_ED25519_PLUS_DB_HMAC',{...evidence(),databaseHmacSecretIndependentFromIssuerKey:true});assert.equal(x.productionKeyProvisioned,false);assert.equal(x.productionAdmitted,false);}],
 ['all P3 fake evidence is review-only',()=>{const x=assessRpcProofOption('P3_PRIVATE_BACKEND_NARROW_DB_IDENTITY',{...evidence(),pinnedPrivateDbCallerNoImpersonationVerified:true});assert.equal(x.verifiedRealAuthSession,false);}],
 ['client Store authority rejected',()=>{const x=assessRpcProofOption('P2_PRIVATE_NODE_ED25519_PLUS_DB_HMAC',{...evidence(),databaseHmacSecretIndependentFromIssuerKey:true,acceptsClientSuppliedStoreId:true});assert.ok(x.blockers.includes('UNTRUSTED_STORE_CLAIM'));}],
 ['reuse Supabase JWT key rejected',()=>{const x=assessRpcProofOption('P1_PRIVATE_NODE_ED25519_PLUS_DB_PUBLIC_KEY_VERIFY',{...evidence(),supportedDatabaseEd25519VerifierPrivatelyProved:true,reusesSupabaseJwtSigningSecret:true});assert.ok(x.blockers.includes('JWT_KEY_REUSE_FORBIDDEN'));}],
 ['committed test secret rejected',()=>{const x=assessRpcProofOption('P2_PRIVATE_NODE_ED25519_PLUS_DB_HMAC',{...evidence(),databaseHmacSecretIndependentFromIssuerKey:true,usesCommittedFixtureSecret:true});assert.ok(x.blockers.includes('QA_FIXTURE_KEY_FORBIDDEN'));}],
 ['public EXECUTE denied',()=>{const x=assessRpcProofOption('P3_PRIVATE_BACKEND_NARROW_DB_IDENTITY',{...evidence(),pinnedPrivateDbCallerNoImpersonationVerified:true,grantsExecuteToPublic:true});assert.ok(x.blockers.includes('PUBLIC_EXECUTE_FORBIDDEN'));}],
 ['unknown option denied',()=>assert.equal(assessRpcProofOption('invalid',evidence()).status,'UNKNOWN_OPTION_BLOCKED')]
];
for(const [i,[name,fn]] of pc.entries())check('P'+String(i+1).padStart(2,'0')+' '+name,fn);
for(const [i,field] of proofCriteria.entries())check('P'+String(i+22).padStart(2,'0')+' missing '+field+' blocks',()=>{
 const x=evidence();x[field]=false;
 const r=assessRpcProofOption('P1_PRIVATE_NODE_ED25519_PLUS_DB_PUBLIC_KEY_VERIFY',{
   ...x,supportedDatabaseEd25519VerifierPrivatelyProved:true
 });
 assert.ok(r.blockers.includes('MISSING_'+field));assert.equal(r.productionAdmitted,false);
});

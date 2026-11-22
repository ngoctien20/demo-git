import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewV218ReactionStagingAdmission as assess} from './v218-staging-readiness.mjs';

const now=1795350000000;
const catalog='a'.repeat(32);
const digest='b'.repeat(64);
const good=()=>({
 db:{projectRef:'ifxlvrhyjhbzbrkdsida',pgMajor:17,configCoreExists:true,
   channelsForcedRls:true,anonCannotRead:true,authCannotDirectWrite:true,
   activeMessengerDemoConnections:1,catalogShapeMd5:catalog},
 migrations:{configCoreBaselineReconciled:true,reactionCandidateReviewed:true,
   grantsAndRlsAudited:true},
 meta:{realOauthAppAttested:true,pageMessagingTaskAttested:true,
   pageSubscriptionAttested:true,appTokenScopeAttested:true,
   ownerStorePageBindingAttested:true,challengeClaimedAtomically:true,
   trustedIssuerReviewed:true,verifiedAtMs:now-60*60*1000},
 auth:{realOwnerAJwt:true,realOwnerBJwt:true,distinctOwnerSessions:true,
   ownerBIsolatedFromStoreA:true,ownerAIsolatedFromStoreB:true,
   anonDenied:true,readOnly:true,testedAtMs:now-60*60*1000},
 backup:{artifactSha256:digest,restoredArtifactSha256:digest,
   encryptedAndDecryptVerified:true,restoreIntoDisposablePassed:true,
   readbackValidated:true,sourceCatalogShapeMd5:catalog,
   createdAtMs:now-70*60*1000,restoredAtMs:now-55*60*1000},
 approval:{explicitStagingMigrationApproval:true,securityOwnerReviewed:true,
   restoreRollbackOwnerReviewed:true}
});
const blockIds=e=>assess(e,now).blockers.map(b=>b.id);

test('reported staging state without evidence is NO_GO with every independent gate',()=>{
 const x=assess({},now);
 assert.equal(x.status,'NO_GO');
 assert.deepEqual(x.blockers.map(b=>b.id),['database','migrations','meta','jwt','backup','approval']);
 assert.equal(x.canApplyHostedMigration,false);
 assert.equal(x.canIssueMetaPageProof,false);
 assert.equal(x.canPublishReaction,false);
 assert.equal(x.canSendMetaReaction,false);
});
test('even all externally reported checks only allow human review; never deploy',()=>{
 const x=assess(good(),now);
 assert.equal(x.status,'REVIEW_REQUIRED');
 assert.equal(x.blockers.length,0);
 assert.equal(x.evidenceOnly,true);
 assert.equal(x.canApplyHostedMigration,false);
 assert.equal(x.canSendMetaReaction,false);
 assert.equal(x.requiresIndependentHumanAuthorization,true);
});
test('known V21.8 condition: Config Core exists but migration history untracked',()=>{
 const x=good();x.migrations.configCoreBaselineReconciled=false;
 assert.deepEqual(blockIds(x),['migrations']);
});
test('backup artifact being encrypted is NOT proof that exact file restores',()=>{
 const x=good();x.backup.restoreIntoDisposablePassed=false;
 assert.deepEqual(blockIds(x),['backup']);
});
test('restored digest must exactly equal source backup SHA',()=>{
 const x=good();x.backup.restoredArtifactSha256='c'.repeat(64);
 assert.deepEqual(blockIds(x),['backup']);
});
test('backup must match current hosted schema fingerprint',()=>{
 const x=good();x.backup.sourceCatalogShapeMd5='d'.repeat(32);
 assert.deepEqual(blockIds(x),['backup']);
});
test('pre-restore data snapshot older than one day is insufficient',()=>{
 const x=good();x.backup.createdAtMs=now-25*60*60*1000;
 assert.deepEqual(blockIds(x),['backup']);
});
test('restoration timestamp before backup timestamp is impossible',()=>{
 const x=good();x.backup.restoredAtMs=x.backup.createdAtMs-1000;
 assert.deepEqual(blockIds(x),['backup']);
});
test('wrong staging project is blocked even if flags are all true',()=>{
 const x=good();x.db.projectRef='other';
 assert.deepEqual(blockIds(x),['database']);
});
test('a Meta Business Suite inbox does not prove OAuth Page installation',()=>{
 const x=good();x.meta.realOauthAppAttested=false;
 assert.deepEqual(blockIds(x),['meta']);
});
test('Meta proof without Page message task or atomic nonce is blocked',()=>{
 const x=good();x.meta.pageMessagingTaskAttested=false;
 x.meta.challengeClaimedAtomically=false;
 assert.deepEqual(blockIds(x),['meta']);
});
test('synthetic Owner A/B SQL role-switch is not real signed JWT UAT',()=>{
 const x=good();x.auth.realOwnerAJwt=false;x.auth.realOwnerBJwt=false;
 assert.deepEqual(blockIds(x),['jwt']);
});
test('one overlapping Owner A/B session is not cross-tenant negative evidence',()=>{
 const x=good();x.auth.distinctOwnerSessions=false;
 assert.deepEqual(blockIds(x),['jwt']);
});
test('an explicit owner approval is still required for staging even with every check',()=>{
 const x=good();x.approval.explicitStagingMigrationApproval=false;
 assert.deepEqual(blockIds(x),['approval']);
});
test('future, stale or invalid clock timestamps fail closed',()=>{
 const x=good();
 x.meta.verifiedAtMs=now+1000;
 assert.deepEqual(blockIds(x),['meta']);
 assert.equal(assess(good(),-1).status,'NO_GO');
});
test('no secret, JWT, Page ID, DB URL or bearer token is echoed by the report',()=>{
 const x=good();x.extra={accessToken:'SECRET_DO_NOT_PRINT'};
 const result=JSON.stringify(assess(x,now));
 assert.equal(result.includes('SECRET_DO_NOT_PRINT'),false);
 assert.equal(result.includes('Bearer'),false);
 assert.equal(result.includes('ifxlvrhyjhbzbrkdsida'),false);
});

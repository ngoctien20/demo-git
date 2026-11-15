'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assessHostedReplayGate,FLAGS,READINESS_SQL}=require('./hosted-security-gate.cjs');
const {createSyntheticKeyring,createSyntheticRotationIndex}=require('./key-rotation.cjs');
const {planSyntheticRetention}=require('./retention-gate.cjs');
const {deriveIdentity}=require('../messenger-rich-v136m5/private-event-store.cjs');

const NOW=Date.parse('2026-11-15T12:00:00Z'),now=()=>NOW;
const DAY=86400000;
const T='11111111-1111-4111-8111-111111111111';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const P='12345678901234567',P2='98765432109876543';
const S='55555555555555555',S2='66666666666666666';
const K1='synthetic_secret_for_old_key_V136M6_12345';
const K2='synthetic_secret_for_new_key_V136M6_67890';
const K3='synthetic_secret_for_latest_key_V136M6_99999';
const trusted=(o={})=>({source:'SERVER_VERIFIED_MESSENGER_BINDING',
 serverDerived:true,verified:true,tenantId:T,storeId:A,pageId:P,
 recipientPsid:S,bindingVersion:1,...o});
const ring=(active='v1',pairs=[['v1',K1]])=>
 createSyntheticKeyring({activeVersion:active,
 keys:pairs.map(([version,secret])=>({version,secret}))});
const old=()=>ring(),both=()=>ring('v2',[['v1',K1],['v2',K2]]);
const newer=()=>ring('v3',[['v1',K1],['v2',K2],['v3',K3]]);
const query=(o={})=>({trusted:trusted(o),replayKey:'a'.repeat(64)});
const facts=()=>Object.fromEntries(FLAGS.map(k=>[k,true]));
const evidence=(o={})=>({source:'SYNTHETIC_QA_EVIDENCE',
 checkedAtMs:NOW,facts:{...facts(),...o}});
const row=(o={})=>({id:'mock-1',status:'PREVIEW_READY',
 claimedAtMs:NOW-50*DAY,completedAtMs:NOW-50*DAY,
 expiresAtMs:NOW-40*DAY,legalHold:false,outboxPending:false,...o});
const retention=(rows=[row()],extra={})=>planSyntheticRetention({
 mode:'SYNTHETIC_RETENTION_REVIEW',rows,now,
 policyApproved:true,tombstoneContinuityVerified:true,...extra});
const throws=(f,p)=>assert.throws(f,new RegExp(p));
test('hosted gate is default deny, even with complete fixture',()=>{
 throws(()=>assessHostedReplayGate({evidence:evidence(),now}),
 'M6_HOSTED_GATE_UNAVAILABLE');
});
test('only synthetic review can evaluate flags',()=>{
 throws(()=>assessHostedReplayGate({mode:'HOSTED_READY',
  evidence:evidence(),now}),'M6_HOSTED_GATE_UNAVAILABLE');
});
test('missing evidence rejected rather than treating it as true',()=>{
 throws(()=>assessHostedReplayGate({mode:'SYNTHETIC_READINESS_REVIEW',now}),
 'M6_EVIDENCE_INVALID_OR_STALE');
});
test('untrusted evidence source rejected',()=>{
 throws(()=>assessHostedReplayGate({mode:'SYNTHETIC_READINESS_REVIEW',now,
  evidence:{...evidence(),source:'BROWSER_ASSERTION'}}),
 'M6_EVIDENCE_INVALID_OR_STALE');
});
test('old/future evidence denied',()=>{
 for(const checkedAtMs of [NOW-86400001,NOW+1]){
  throws(()=>assessHostedReplayGate({mode:'SYNTHETIC_READINESS_REVIEW',now,
   evidence:{...evidence(),checkedAtMs}}),'M6_EVIDENCE_INVALID_OR_STALE');
 }
});
test('all fixture evidence cannot authorize hosted writes',()=>{
 const a=assessHostedReplayGate({
  mode:'SYNTHETIC_READINESS_REVIEW',evidence:evidence(),now});
 assert.equal(a.status,'SATISFIED_IN_FIXTURE_ONLY');
 assert.equal(a.readyForOwnerReview,true);
 for(const flag of ['hostedReplayEnabled','authorizedSchemaMigration',
  'canModifyRls','canUseCredential','canWriteOrders','canSendMessenger',
  'realPostgresVerified','ownerApprovalVerified','keyRotationActivated'])
  assert.equal(a[flag],false,flag);
});
test('missing each critical security flag blocks and reports exact flag',()=>{
 for(const name of FLAGS){
  const x=assessHostedReplayGate({
   mode:'SYNTHETIC_READINESS_REVIEW',evidence:evidence({[name]:false}),now});
  assert.equal(x.status,'BLOCKED_IN_SYNTHETIC_REVIEW');
  assert.deepEqual(x.missing,[name]);
  assert.equal(x.hostedReplayEnabled,false);
 }
});
test('undefined facts cannot be treated as passing evidence',()=>{
 const obj=evidence();delete obj.facts.restrictedDbRoleVerified;
 const a=assessHostedReplayGate({mode:'SYNTHETIC_READINESS_REVIEW',
  evidence:obj,now});
 assert.ok(a.missing.includes('restrictedDbRoleVerified'));
});
test('hosted readiness SQL contains ONLY SELECT and schema discovery',()=>{
 assert.match(READINESS_SQL,/^SELECT/);
 assert.match(READINESS_SQL,/to_regclass\('public\.stores'\)/);
 assert.match(READINESS_SQL,/app_private\.messenger_event_claims/);
 assert.match(READINESS_SQL,/relforcerowsecurity/);
 assert.doesNotMatch(READINESS_SQL,/\b(INSERT|UPDATE|DELETE|ALTER|DROP|GRANT)\b/);
});
test('rotation keyring demands active version and strong secret',()=>{
 throws(()=>createSyntheticKeyring({activeVersion:'v1',keys:[]}),/M6_KEYRING_INVALID/);
 throws(()=>createSyntheticKeyring({activeVersion:'v2',keys:[{version:'v1',secret:K1}]}),
 /M6_ACTIVE_KEY_MISSING/);
 throws(()=>createSyntheticKeyring({activeVersion:'v1',keys:[{version:'v1',secret:'weak'}]}),
 /M6_KEYRING_INVALID/);
});
test('duplicate key versions are denied',()=>{
 throws(()=>createSyntheticKeyring({activeVersion:'v1',
  keys:[{version:'v1',secret:K1},{version:'v1',secret:K2}]}),
 'M6_KEYRING_INVALID');
});
test('keyring never serializes key material',()=>{
 const x=both();
 const repr=JSON.stringify(x);
 assert.doesNotMatch(repr,/synthetic_secret/);
 assert.equal(x.manifest().activeVersion,'v2');
 assert.deepEqual(x.manifest().versions,['v2','v1']);
});
test('legacy v1 ring matches V13.6M.5 HMAC fingerprint exactly',()=>{
 const x=old().variants(query())[0],legacy=deriveIdentity({
  trusted:trusted(),replayKey:'a'.repeat(64),secret:K1});
 assert.equal(x.senderHash,legacy.senderHash);
 assert.equal(x.eventHash,legacy.eventHash);
 assert.equal(x.rowKey.includes(S),false);
});
test('the same event is deduped before rotating keys',()=>{
 const ix=createSyntheticRotationIndex(),k=old();
 ix.activate({ring:k,expectedEpoch:0});
 assert.equal(ix.claim({ring:k,...query()}).firstSeen,true);
 assert.equal(ix.claim({ring:k,...query()}).firstSeen,false);
 assert.equal(ix.diagnostics().storedFingerprints,1);
});
test('old claim remains duplicate after switching to v2 dual read',()=>{
 const ix=createSyntheticRotationIndex(),a=old(),b=both();
 ix.activate({ring:a,expectedEpoch:0});
 ix.claim({ring:a,...query()});
 const change=ix.activate({ring:b,expectedEpoch:1});
 assert.equal(change.epoch,2);
 const res=ix.claim({ring:b,...query()});
 assert.equal(res.firstSeen,false);
 assert.equal(res.matchedKeyVersion,'v1');
});
test('new events after v2 activation use v2 fingerprint',()=>{
 const ix=createSyntheticRotationIndex(),a=old(),b=both();
 ix.activate({ring:a,expectedEpoch:0});
 ix.activate({ring:b,expectedEpoch:1});
 const r=ix.claim({ring:b,trusted:trusted(),replayKey:'b'.repeat(64)});
 assert.equal(r.firstSeen,true);
 assert.equal(r.matchedKeyVersion,'v2');
 assert.equal(ix.claim({ring:b,trusted:trusted(),
  replayKey:'b'.repeat(64)}).firstSeen,false);
});
test('stale old-only worker is rejected after rotation, not allowed to claim',()=>{
 const ix=createSyntheticRotationIndex(),a=old(),b=both();
 ix.activate({ring:a,expectedEpoch:0});
 ix.activate({ring:b,expectedEpoch:1});
 throws(()=>ix.claim({ring:a,...query()}),'M6_ROTATION_WORKER_STALE');
 assert.equal(ix.diagnostics().storedFingerprints,0);
});
test('drop of old key without approved legacy retention migration fails',()=>{
 const ix=createSyntheticRotationIndex();
 ix.activate({ring:old(),expectedEpoch:0});
 const noOld=ring('v2',[['v2',K2]]);
 throws(()=>ix.activate({ring:noOld,expectedEpoch:1}),'M6_ROTATION_HISTORY_LOST');
});
test('changing key material under an existing key version fails',()=>{
 const ix=createSyntheticRotationIndex();
 ix.activate({ring:old(),expectedEpoch:0});
 const changed=ring('v2',[['v1',K3],['v2',K2]]);
 throws(()=>ix.activate({ring:changed,expectedEpoch:1}),'M6_ROTATION_HISTORY_LOST');
});
test('concurrent rotation plans require exact manifest epoch',()=>{
 const ix=createSyntheticRotationIndex();
 ix.activate({ring:old(),expectedEpoch:0});
 throws(()=>ix.activate({ring:both(),expectedEpoch:0}),'M6_ROTATION_EPOCH_CONFLICT');
 assert.equal(ix.diagnostics().activeVersion,'v1');
});
test('duplicate rotation activation is rejected',()=>{
 const ix=createSyntheticRotationIndex();
 ix.activate({ring:old(),expectedEpoch:0});
 throws(()=>ix.activate({ring:old(),expectedEpoch:1}),'M6_ROTATION_NO_CHANGE');
});
test('v3 rotation preserves v1 and v2 replay history',()=>{
 const ix=createSyntheticRotationIndex(),a=old(),b=both(),c=newer();
 ix.activate({ring:a,expectedEpoch:0});
 ix.claim({ring:a,...query()});
 ix.activate({ring:b,expectedEpoch:1});
 ix.claim({ring:b,trusted:trusted(),replayKey:'b'.repeat(64)});
 ix.activate({ring:c,expectedEpoch:2});
 assert.equal(ix.claim({ring:c,...query()}).matchedKeyVersion,'v1');
 assert.equal(ix.claim({ring:c,trusted:trusted(),replayKey:'b'.repeat(64)}).matchedKeyVersion,'v2');
 assert.equal(ix.claim({ring:c,trusted:trusted(),replayKey:'c'.repeat(64)}).matchedKeyVersion,'v3');
});
test('100 overlapping QA claims on same ring have one winner',async()=>{
 const ix=createSyntheticRotationIndex(),k=old();
 ix.activate({ring:k,expectedEpoch:0});
 const result=await Promise.all(Array.from({length:100},
  async()=>ix.claim({ring:k,...query()})));
 assert.equal(result.filter(x=>x.firstSeen).length,1);
 assert.equal(ix.diagnostics().storedFingerprints,1);
 assert.equal(ix.diagnostics().durable,false);
});
test('same MID in separate sender or Store is not suppressed',()=>{
 const ix=createSyntheticRotationIndex(),k=both();
 ix.activate({ring:k,expectedEpoch:0});
 for(const p of [trusted(),trusted({recipientPsid:S2}),trusted({storeId:B})])
  assert.equal(ix.claim({ring:k,trusted:p,replayKey:'a'.repeat(64)}).firstSeen,true);
 assert.equal(ix.diagnostics().storedFingerprints,3);
});
test('malformed trusted identity cannot mint replay fingerprint',()=>{
 const ix=createSyntheticRotationIndex(),k=old();
 ix.activate({ring:k,expectedEpoch:0});
 throws(()=>ix.claim({ring:k,trusted:trusted({storeId:'bad'}),
  replayKey:'a'.repeat(64)}),'PRIVATE_EVENT_SCOPE_UNVERIFIED');
});
test('retention default denies anything without explicit review mode',()=>{
 throws(()=>planSyntheticRetention({rows:[row()],now}),'M6_RETENTION_OFFLINE_ONLY');
});
test('retention only supports bounded policy windows of 30-365 days',()=>{
 for(const days of [0,7,29,366,1.5]){
  throws(()=>retention([row()],{retentionDays:days}),'M6_RETENTION_INPUT_INVALID');
 }
});
test('old completed event with tombstone proof only eligible for owner REVIEW',()=>{
 const x=retention([row()]);
 assert.equal(x.reviewEligibleCount,1);
 assert.equal(x.deletionExecuted,false);
 assert.equal(x.deletionAuthorized,false);
 assert.equal(x.keyRemovalAuthorized,false);
});
test('CLAIMED or unfinished events are never eligible for purge',()=>{
 const x=retention([row({id:'a',status:'CLAIMED',completedAtMs:null}),
  row({id:'b',status:'REJECTED',completedAtMs:null})]);
 assert.equal(x.counts.UNFINISHED,2);
 assert.equal(x.reviewEligibleCount,0);
});
test('events with legal hold or pending outbox are never eligible',()=>{
 const x=retention([row({id:'a',legalHold:true}),row({id:'b',outboxPending:true})]);
 assert.equal(x.counts.LEGAL_HOLD,1);
 assert.equal(x.counts.OUTBOX_PENDING,1);
});
test('recent completion or unexpired horizon cannot be purged',()=>{
 const x=retention([row({id:'a',completedAtMs:NOW-5*DAY}),
  row({id:'b',expiresAtMs:NOW+DAY})]);
 assert.equal(x.counts.TOO_RECENT,2);
});
test('unproven replay continuity blocks all deletion even after 365 days',()=>{
 const x=retention([row()],{tombstoneContinuityVerified:false});
 assert.equal(x.counts.REPLAY_CONTINUITY_UNVERIFIED,1);
 assert.equal(x.deletionAuthorized,false);
});
test('policy approval cannot be silently assumed',()=>{
 const x=retention([row()],{policyApproved:false});
 assert.equal(x.counts.REPLAY_CONTINUITY_UNVERIFIED,1);
});
test('invalid or duplicate synthetic rows fail review without data exposure',()=>{
 const x=retention([row(),row(),row({id:'bad',claimedAtMs:-1})]);
 assert.equal(x.counts.INVALID_ROW,2);
 assert.equal(x.reviewEligibleCount,1);
});
test('synthetic retention summary never returns raw row ids',()=>{
 const x=retention([row({id:'TOP_SECRET_CUSTOMER_ID'})]);
 assert.doesNotMatch(JSON.stringify(x),/TOP_SECRET_CUSTOMER_ID/);
 assert.equal(x.realHostedRetentionVerified,false);
});
test('all public APIs are planning-only, without production transport',()=>{
 const a=require('./hosted-security-gate.cjs');
 const b=require('./key-rotation.cjs');
 const c=require('./retention-gate.cjs');
 assert.deepEqual(Object.keys(a).sort(),['assessHostedReplayGate','FLAGS','READINESS_SQL'].sort());
 assert.deepEqual(Object.keys(b).sort(),['createSyntheticKeyring','createSyntheticRotationIndex'].sort());
 assert.deepEqual(Object.keys(c),['planSyntheticRetention']);
});

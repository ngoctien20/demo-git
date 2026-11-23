import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewV2111EvidencePacket as review,V2111_EVIDENCE_FORMAT} from './v2111-evidence-review.mjs';
const now=new Date('2026-11-23T12:00:00Z');
const manifest=JSON.parse(readFileSync(new URL('./v2111-evidence-status.json',import.meta.url),'utf8'));
const gates=Object.keys(manifest.gates);
const validRecord=()=>({
 status:'VERIFIED',
 evidence_ref:'t404-evidence://offline-synthetic-fixture-01',
 sha256:'a'.repeat(64),
 captured_at:'2026-11-23T11:00:00Z',
 reviewed_by_role:'independent_security_reviewer',
});
const fakeGreen=()=>{
 const packet=structuredClone(manifest);
 for(const gate of gates) packet.gates[gate]=validRecord();
 return packet;
};
test('V21.11 manifest is credential-free and all seven real-world gates remain BLOCKED',()=>{
 assert.equal(manifest.format,V2111_EVIDENCE_FORMAT);
 assert.equal(manifest.project,'tien404-staging');
 assert.equal(gates.length,7);
 assert.ok(gates.every(k=>manifest.gates[k].status==='BLOCKED'));
 assert.equal(JSON.stringify(manifest).includes('Bearer '),false);
 assert.equal(JSON.stringify(manifest).includes('sb_secret_'),false);
 const r=review(manifest,now);
 assert.equal(r.status,'NO_GO');
 assert.equal(r.blockerCount,7);
 assert.equal(r.canApplyStagingMigration,false);
 assert.equal(r.canSendMetaReaction,false);
});
test('fabricated fully VERIFIED static metadata never becomes release authorization',()=>{
 const r=review(fakeGreen(),now);
 assert.equal(r.status,'INDEPENDENT_REVIEW_REQUIRED');
 assert.equal(r.blockerCount,0);
 for(const flag of [
 'liveMetaProofConfirmed','realOwnerJwtConfirmed','sameArtifactRestoreConfirmed',
 'canApplyStagingMigration','canIssueMetaInstallationProof',
 'canEnableReaction','canSendMetaReaction'])
 assert.equal(r[flag],false,flag);
 assert.equal(r.requiresTrustedSourceVerification,true);
 assert.equal(r.requiresSeparateOwnerApproval,true);
});
test('one missing Meta installation proof enforces NO_GO',()=>{
 const p=fakeGreen();p.gates.meta_page_oauth_graph_get={status:'BLOCKED'};
 const r=review(p,now);
 assert.deepEqual(r.blockers.map(x=>x.gate),['meta_page_oauth_graph_get']);
});
test('real Owner A/B signed JWT gate cannot be replaced by SQL role simulation',()=>{
 const p=fakeGreen();p.gates.owner_a_b_signed_auth_uat={status:'TESTED'};
 assert.equal(review(p,now).status,'NO_GO');
});
test('fresh backup creation cannot replace same-artifact disposable restore',()=>{
 const p=fakeGreen();p.gates.same_artifact_disposable_restore={status:'PROPOSED'};
 assert.equal(review(p,now).blockers[0].gate,'same_artifact_disposable_restore');
});
test('security review is independent of a migration consent',()=>{
 const p=fakeGreen();p.gates.reaction_schema_security_review={status:'BLOCKED'};
 assert.equal(review(p,now).status,'NO_GO');
});
test('expiry and future timestamps fail closed',()=>{
 for(const time of ['2026-11-22T11:00:00Z','2026-11-23T15:00:00Z']){
  const p=fakeGreen();p.gates.meta_test_app_authority.captured_at=time;
  assert.equal(review(p,now).status,'NO_GO');
 }
});
test('a digest, GitHub run URL and reviewer string alone still cannot approve migration',()=>{
 const p=fakeGreen();
 p.gates.meta_test_app_authority.evidence_ref='https://github.com/ngoctien20/demo-git/actions/runs/45070525859';
 const r=review(p,now);
 assert.equal(r.status,'INDEPENDENT_REVIEW_REQUIRED');
 assert.equal(r.canApplyStagingMigration,false);
});
test('untrusted extra fields for token, JWT, secret, Page IDs are rejected',()=>{
 for(const extra of [{access_token:'never-store'}, {serviceRoleKey:'never'},
 {raw_jwt:'never'}, {metaPageId:'1234567890123'}]){
  const p=fakeGreen();Object.assign(p.gates.meta_test_app_authority,extra);
  assert.equal(review(p,now).status,'NO_GO');
  assert.equal(JSON.stringify(review(p,now)).includes('never'),false);
 }
});
test('missing, typoed, foreign repo or malformed evidence references fail closed',()=>{
 for(const evidence_ref of ['https://github.com/other/repo/actions/runs/45070525859',
 'https://graph.facebook.com/debug_token?access_token=BAD',
 't404-evidence://x','https://evil.example/authorize','']){
  const p=fakeGreen();p.gates.meta_page_oauth_graph_get.evidence_ref=evidence_ref;
  assert.equal(review(p,now).status,'NO_GO');
 }
});
test('invalid JSON-like or additional top-level fields cannot silently bypass gate',()=>{
 for(const p of [null,[],{format:V2111_EVIDENCE_FORMAT,project:'other',gates:{}},
 {...fakeGreen(),noSend:false}]){
  const r=review(p,now);
  assert.equal(r.status,'NO_GO');
  assert.equal(r.canSendMetaReaction,false);
 }
});
test('all reports are redacted and contain no credentials or external Page ID',()=>{
 const p=fakeGreen();
 p.gates.meta_test_app_authority.evidence_ref='t404-evidence://synthetic-issuer-redacted-reference';
 const r=review(p,now);
 const json=JSON.stringify(r);
 assert.equal(json.includes('synthetic-issuer-redacted-reference'),false);
 assert.equal(json.includes('access_token'),false);
 assert.equal(json.includes('jwt.'),false);
});

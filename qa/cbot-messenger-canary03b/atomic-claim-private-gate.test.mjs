import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {createSyntheticClaimLedger,createSyntheticOneShotCanary,
 assessPrivateProofRecord,verifyOneShotSqlContract} from './atomic-claim-private-gate.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const proofRecord=JSON.parse(readFileSync(join(dir,'private-evidence-redacted-status.json'),'utf8'));
const sql=readFileSync(join(dir,'ONE_SHOT_POSTGRES_REVIEW_ONLY.sql'),'utf8');
const run=(engine,proof,event_id='QA-EVT-ALPHA',rest={})=>engine.attempt({
 proof,marker:'TIEN404-CANARY-LIVE02',
 event:{channel:'MESSENGER',page:'QA_PAGE',recipient:'QA_PSID',app:'QA_APP',messageId:event_id},
 signatureVerified:true,dedupVerified:true,privateConsent:true,...rest
});
test('private Page + recipient evidence remains publicly NO-GO',()=>{
 const a=assessPrivateProofRecord(proofRecord);
 assert.equal(a.decision,'NO_GO');
 assert.equal(a.can_send,false);
 assert.equal(a.can_publish,false);
 assert.equal(a.reasons.length,7);
 assert.equal(a.real_recipient_bound,false);
});
test('fake private approvals fail closed instead of granting scope',()=>{
 for(const f of ['qa_recipient_binding','qa_consent','independent_reviewer',
   'owner_final_patch_approval','atomic_backend_verified','rollback_private_snapshot',
   'app_page_messages_subscription']){
  const x={...proofRecord,[f]:'VERIFIED'};
  assert.deepEqual(assessPrivateProofRecord(x).reasons,['UNTRUSTED_PRIVATE_PROOF_SELF_ASSERTION']);
 }
});
test('adding PSID, token, Page ID or operator metadata fails exact evidence schema',()=>{
 for(const k of ['psid','page_id','access_token','approved','tenant_id','store_id','customer_name']){
  const x={...proofRecord,[k]:'fake'};
  assert.deepEqual(assessPrivateProofRecord(x).reasons,['INVALID_PUBLIC_EVIDENCE']);
 }
});
test('first QA grant claims once but produces zero Messenger sends',async()=>{
 const e=createSyntheticOneShotCanary({ledger:createSyntheticClaimLedger()});
 const proof=e.issueSyntheticProof();
 const r=await run(e,proof);
 assert.equal(r.decision,'CLAIMED_OFFLINE_ONLY');
 assert.equal(r.claim_consumed,true);
 assert.equal(r.delivery_guarantee,'AT_MOST_ONE_ATTEMPT_NOT_EXACTLY_ONCE');
 assert.equal(r.can_send,false);
 assert.equal(r.provider_sends,0);
 assert.equal(r.orders_written,0);
});
test('same grant and same Meta event cannot claim twice',async()=>{
 const e=createSyntheticOneShotCanary({ledger:createSyntheticClaimLedger()});
 const p=e.issueSyntheticProof();
 assert.equal((await run(e,p)).decision,'CLAIMED_OFFLINE_ONLY');
 const r=await run(e,p);
 assert.equal(r.decision,'BLOCK');
 assert.equal(r.reason,'ONE_SHOT_ALREADY_CLAIMED');
});
test('two different message IDs cannot use one Page recipient grant twice',async()=>{
 const e=createSyntheticOneShotCanary({ledger:createSyntheticClaimLedger()});
 const p=e.issueSyntheticProof();
 assert.equal((await run(e,p,'QA-EVT-ALPHA')).decision,'CLAIMED_OFFLINE_ONLY');
 assert.equal((await run(e,p,'QA-EVT-BETA')).reason,'ONE_SHOT_ALREADY_CLAIMED');
});
test('competing concurrent attempts in one JS simulation produce exactly one claim',async()=>{
 const ledger=createSyntheticClaimLedger();
 const e=createSyntheticOneShotCanary({ledger});
 const p=e.issueSyntheticProof();
 const attempts=Array.from({length:100},(_,i)=>run(e,p,'QA-EVT-'+String(i+1)));
 const results=await Promise.all(attempts);
 assert.equal(results.filter(x=>x.decision==='CLAIMED_OFFLINE_ONLY').length,1);
 assert.equal(results.filter(x=>x.reason==='ONE_SHOT_ALREADY_CLAIMED').length,99);
 assert.equal(ledger.size(),1);
});
test('claim stays consumed even if provider result was never obtained',async()=>{
 const ledger=createSyntheticClaimLedger();
 const e=createSyntheticOneShotCanary({ledger});
 const p=e.issueSyntheticProof();
 const first=await run(e,p);assert.equal(first.claim_consumed,true);
 assert.equal(ledger.read('QA_GRANT_001').status,'CLAIMED');
 const retry=await run(e,p,'QA-EVT-RETRY');
 assert.equal(retry.reason,'ONE_SHOT_ALREADY_CLAIMED');
});
test('malicious client-supplied pseudo proof is not trusted',async()=>{
 const e=createSyntheticOneShotCanary({ledger:createSyntheticClaimLedger()});
 const p={grantId:'QA_GRANT_001',page:'QA_PAGE',recipient:'QA_PSID',app:'QA_APP',expiresAt:60000};
 const r=await run(e,p);
 assert.equal(r.reason,'PRIVATE_AUTHORITY_NOT_ISSUED');
});
test('cloning an issued proof does not give privilege',async()=>{
 const e=createSyntheticOneShotCanary({ledger:createSyntheticClaimLedger()});
 const p=e.issueSyntheticProof();
 const r=await run(e,{...p});
 assert.equal(r.reason,'PRIVATE_AUTHORITY_NOT_ISSUED');
});
test('non-target Page/sender/app or wrong channel cannot claim the grant',async()=>{
 for(const [key,val] of [['page','OTHER_PAGE'],['recipient','OTHER_USER'],['app','OTHER_APP'],['channel','ZALO_OA']]){
  const ledger=createSyntheticClaimLedger();
  const e=createSyntheticOneShotCanary({ledger});
  const p=e.issueSyntheticProof();
  const evt={channel:'MESSENGER',page:'QA_PAGE',recipient:'QA_PSID',app:'QA_APP',messageId:'QA-EVT-X'};
  evt[key]=val;
  const r=await run(e,p,'QA-EVT-X',{event:evt});
  assert.equal(r.reason,'INVALID_EVENT_SCOPE',key);
  assert.equal(ledger.size(),0);
 }
});
test('invalid signature, dedup or consent is blocked before any claim',async()=>{
 for(const flag of ['signatureVerified','dedupVerified','privateConsent']){
  const ledger=createSyntheticClaimLedger();
  const e=createSyntheticOneShotCanary({ledger});
  const r=await run(e,e.issueSyntheticProof(),'QA-EVT-X',{[flag]:false});
  assert.equal(r.reason,'UNVERIFIED_SIGNATURE_DEDUP_OR_CONSENT');
  assert.equal(ledger.size(),0);
 }
});
test('marker mismatch and order intent never consume grant',async()=>{
 const ledger=createSyntheticClaimLedger(),e=createSyntheticOneShotCanary({ledger});
 const p=e.issueSyntheticProof();
 for(const marker of ['đặt hàng','TIEN404-CUSTOM-LIVE01','TIEN404-CANARY-LIVE02 chốt đơn']){
  const r=await run(e,p,'QA-EVT-X',{marker});
  assert.equal(r.reason,'NOT_ONE_ALLOWED_GREETING');
 }
 assert.equal(ledger.size(),0);
});
test('expired grant rejects without consuming',async()=>{
 const ledger=createSyntheticClaimLedger();
 const e=createSyntheticOneShotCanary({ledger,nowMs:()=>60000});
 assert.equal((await run(e,e.issueSyntheticProof())).reason,'EXPIRED_OR_INVALID_CLOCK');
 assert.equal(ledger.size(),0);
});
test('a grant cannot be minted for a real Page, PSID or arbitrary expiration',()=>{
 const e=createSyntheticOneShotCanary({ledger:createSyntheticClaimLedger()});
 for(const x of [{recipient:'REAL_PSID'},{page:'LIVE_PAGE'},{app:'LIVE_APP'},{expiresAt:999999}]){
  assert.throws(()=>e.issueSyntheticProof(x),/NO_REAL_OR_EXTERNAL_PROOF_ACCEPTED/);
 }
});
test('sql contract uses unique grant, invoker and RLS fail-closed with no public grant',()=>{
 assert.equal(verifyOneShotSqlContract(sql),true);
 assert.match(sql,/ON CONFLICT \(grant_id\) DO NOTHING/i);
 assert.match(sql,/REVOKE ALL ON FUNCTION/i);
 assert.match(sql,/SECURITY INVOKER/i);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
});
test('unsafe check-then-write or missing ON CONFLICT is rejected',()=>{
 for(const s of [sql.replace('ON CONFLICT (grant_id) DO NOTHING',''),
 sql.replace(/SECURITY INVOKER/,'SECURITY DEFINER'),
 sql.replace(/REVOKE ALL ON FUNCTION/,''),
 'SELECT COUNT(*) FROM one_shot_claims; INSERT INTO one_shot_claims VALUES (...)']){
  assert.equal(verifyOneShotSqlContract(s),false);
 }
});
test('no live Meta and credential values included in public evidence/SQL',()=>{
 const data=readFileSync(join(dir,'private-evidence-redacted-status.json'),'utf8')+sql;
 for(const term of ['"psid"','"page_id"','"access_token"','"app_secret"',
  '"customer_phone"','"sender_id"','"recipient_id"','"meta_message_id"'])
  assert.equal(data.includes(term),false,term);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 CONTRACT,REQUIRED_GATES,evaluateUat07,
 declarePrivateM0Accepted,adjudicateStoreRowAsVerified,approveNativePageCommerce
} from './source-evidence-adjudicator.mjs';
const baseline=JSON.parse(readFileSync(new URL('./native-meta-webhook-parity-observation.json',import.meta.url),'utf8'));
const clone=x=>structuredClone(x);
const call=(over={})=>evaluateUat07({observation:baseline,...over});
const decision=(gate,status='PRIVATE_REVIEW_PENDING',extra={})=>
 ({gate,status,opaque_receipt_exists:false,independent_reviewer_checked:false,private_primary_source_read:false,...extra});
const mustBlock=r=>{
 for(const key of ['actual_private_witness_accepted','actual_m0_recovery_accepted',
 'merchant_four_row_owner_proved','meta_page_native_owner_proved','can_change_meta_webhook',
 'can_send_messenger_canary','can_revoke_rpc','can_migrate_store',
 'can_query_hosted_store_orders','can_export_hosted_auth','can_merge_production']){
   assert.equal(r[key],false,key);
 }
};
const rejected=(fn,code)=>assert.throws(fn,{code});
test('01 bounded UAT07 evidence source contract',()=>assert.match(CONTRACT,/REAL_SOURCE_ADJUDICATION/));
test('02 actual Meta App configured callback matches n8n Published webhook',()=>{
 const r=call();assert.equal(r.meta_native_app_webhook_parity_observed,true);
});
test('03 real Meta App messages & postbacks checked in v27',()=>{
 const r=call();assert.equal(r.meta_messages_postbacks_app_subscribed_observed,true);
});
test('04 real App checkbox cannot certify Page-level subscribed_apps',()=>{
 const r=call();assert.equal(r.meta_page_native_owner_proved,false);mustBlock(r);
});
test('05 same page callback and HMAC still does not authorize actual canary',()=>{
 const r=call();assert.equal(baseline.n8n.real_live01_execution,'4176');
 assert.equal(baseline.n8n.live01_signature_verified,true);
 assert.equal(r.can_send_messenger_canary,false);
});
test('06 Meta webhook verify token masked in actual UI',()=>{
 assert.equal(baseline.meta.verify_token_masked_in_ui,true);
});
test('07 wrong callback path prevents parity certification',()=>{
 const x=clone(baseline);x.meta.configured_callback_path='unknown';
 const r=evaluateUat07({observation:x});
 assert.equal(r.meta_native_app_webhook_parity_observed,false);
 assert.ok(r.blockers.includes('META_N8N_WEBHOOK_PATH_OR_PUBLISHED_VERSION_MISMATCH'));
});
test('08 published workflow version drift prevents parity',()=>{
 const x=clone(baseline);x.n8n.messenger_published_version='other';
 assert.equal(evaluateUat07({observation:x}).meta_native_app_webhook_parity_observed,false);
});
test('09 n8n inactive prevents parity',()=>{
 const x=clone(baseline);x.n8n.messenger_active=false;
 assert.equal(evaluateUat07({observation:x}).meta_native_app_webhook_parity_observed,false);
});
test('10 if Meta messages checkbox off, cannot claim native App event readiness',()=>{
 const x=clone(baseline);x.meta.app_webhook_messages_subscribed=false;
 const r=evaluateUat07({observation:x});
 assert.equal(r.meta_messages_postbacks_app_subscribed_observed,false);
});
test('11 if Meta postbacks checkbox off, cannot claim native App event readiness',()=>{
 const x=clone(baseline);x.meta.app_webhook_messaging_postbacks_subscribed=false;
 assert.equal(evaluateUat07({observation:x}).meta_messages_postbacks_app_subscribed_observed,false);
});
test('12 version mismatch v27 cannot retain event parity claim',()=>{
 const x=clone(baseline);x.meta.app_webhook_messages_version='v28.0';
 assert.equal(evaluateUat07({observation:x}).meta_messages_postbacks_app_subscribed_observed,false);
});
test('13 even fabricated Meta native Page owner flag cannot authorize send',()=>{
 const x=clone(baseline);
 x.meta.native_page_subscribed_apps_verified=true;
 x.meta.native_meta_business_page_full_control_verified=true;
 x.meta.pages_messaging_permission_granted_verified=true;
 x.meta.exact_test_recipient_owner_consent_verified=true;
 const r=evaluateUat07({observation:x});
 mustBlock(r);
});
test('14 missing native Page owner still clearly shown as blocker',()=>{
 const r=call();assert.ok(r.blockers.includes('META_PAGE_LEVEL_OWNER_PERMISSION_NOT_VERIFIED'));
});
test('15 stale/untrusted baseline source rejected',()=>{
 const x=clone(baseline);x.scope='SELF_REPORTED';
 rejected(()=>evaluateUat07({observation:x}),'SIGNED_OR_CONNECTED_OBSERVATION_REQUIRED');
});
test('16 no evidence categories submitted means all eight still need adjudication',()=>{
 const r=call();assert.equal(r.unreviewed_categories.length,8);
 assert.equal(r.private_decision_categories_received,0);
});
test('17 private review pending is not a GO decision',()=>{
 const r=call({decisions:[decision(REQUIRED_GATES[0])]});
 assert.equal(r.private_decision_categories_received,1);mustBlock(r);
});
test('18 fake all-green self reported private verdicts never produce release',()=>{
 const r=call({decisions:REQUIRED_GATES.map(g=>decision(g,'SELF_REPORTED_APPROVED_NOT_VERIFIED',{
  opaque_receipt_exists:true,independent_reviewer_checked:true,private_primary_source_read:true
 }))});
 assert.equal(r.private_decision_categories_received,8);
 assert.equal(r.unreviewed_categories.length,0);mustBlock(r);
});
test('19 rejected Store claim must remain explicit',()=>{
 const r=call({decisions:[decision(REQUIRED_GATES[1],'REJECTED')]});
 assert.deepEqual(r.disputed_or_rejected_categories,[REQUIRED_GATES[1]]);
});
test('20 contested M0 evidence remains explicit',()=>{
 const r=call({decisions:[decision(REQUIRED_GATES[0],'CONTESTED')]});
 assert.deepEqual(r.disputed_or_rejected_categories,[REQUIRED_GATES[0]]);
});
test('21 duplicated gate cannot impersonate independent reviewer',()=>{
 const d=decision(REQUIRED_GATES[0]);
 rejected(()=>call({decisions:[d,d]}),'REDACTED_DECISION_SCHEMA_OR_DUPLICATE');
});
test('22 unexpected credential property in decision rejected',()=>{
 rejected(()=>call({decisions:[{...decision(REQUIRED_GATES[0]),raw_jwt:'EXAMPLE'}]}),
 'REDACTED_DECISION_SCHEMA_OR_DUPLICATE');
});
test('23 invalid unknown evidence gate rejected',()=>{
 rejected(()=>call({decisions:[decision('NOT_REAL_GATE')]}),'REDACTED_DECISION_SCHEMA_OR_DUPLICATE');
});
test('24 direct private M0 acceptance cannot be issued by candidate',()=>{
 rejected(declarePrivateM0Accepted,'ACTUAL_INDEPENDENT_OFFHOST_RESTORE_MISSING');
});
test('25 real Store owner mapping cannot be auto-adjudicated',()=>{
 rejected(adjudicateStoreRowAsVerified,'REAL_MERCHANT_OWNER_ROW_PROOF_MISSING');
});
test('26 native Page owner cannot be self-certified in source',()=>{
 rejected(approveNativePageCommerce,'PAGE_LEVEL_APP_PERMISSIONS_AND_MERCHANT_CONSENT_UNVERIFIED');
});

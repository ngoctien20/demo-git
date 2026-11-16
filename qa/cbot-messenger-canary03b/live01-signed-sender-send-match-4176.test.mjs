import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const p=join(dirname(fileURLToPath(import.meta.url)),
 'live01-signed-sender-send-match-4176.json');
const x=JSON.parse(readFileSync(p,'utf8'));
test('signed LIVE01 #4176 identity comparison comes from actual n8n execution',()=>{
 assert.equal(x.contract,'T404_CANARY03B_LIVE01_SIGNED_SENDER_TO_SEND_ATTESTATION_V1');
 assert.equal(x.source,'CONNECTED_N8N_EXECUTION_4176_READ_ONLY_COMPARISON');
 assert.equal(x.execution_id,'4176');
 assert.equal(x.execution_status,'success');
 assert.equal(x.workflow_id,'Z7FdV7uDvApfbURQ');
});
test('Meta HMAC and user LIVE01 marker present on signed inbound event',()=>{
 assert.equal(x.meta_hmac_two_checks_verified,true);
 assert.equal(x.live01_marker_matched,true);
 assert.equal(x.inbound_page_id_present,true);
 assert.equal(x.inbound_sender_psid_present,true);
 assert.equal(x.inbound_message_id_present,true);
});
test('signed sender and Page map to prepared reply and verified Send',()=>{
 for(const k of ['ingress_page_matches_prepare_page',
 'ingress_sender_matches_prepare_sender','ingress_mid_matches_prepare_mid',
 'ingress_page_matches_verified_send_page','ingress_sender_matches_verified_send_sender',
 'meta_send_recipient_matches_signed_inbound_sender','meta_send_message_id_returned',
 'meta_send_message_id_matches_verify_result'])
 assert.equal(x[k],true,k);
});
test('user-confirmed visible reply correlates with actual signed sender',()=>{
 assert.equal(x.user_confirmed_message_visible_in_messenger,true);
 assert.equal(x.signed_event_qa_account_technically_correlated,true);
});
test('signed LIVE01 mapping is NOT live02 consent, Page role or durable allowlist',()=>{
 assert.equal(x.independent_meta_page_full_control_proved,false);
 assert.equal(x.separate_live02_consent_grant_issued,false);
 assert.equal(x.private_expiring_allowlist_created,false);
 assert.equal(x.backend_one_shot_durable_certified,false);
 assert.equal(x.can_send_live02,false);
 assert.equal(x.can_patch_published,false);
});
test('no PSID, Page, Meta MID, user PII or secret material in public attestation',()=>{
 const raw=readFileSync(p,'utf8');
 assert.equal(x.page_and_sender_ids_exported,false);
 assert.equal(x.page_and_sender_ids_logged_publicly,false);
 for(const k of ['"psid"','"sender_id"','"page_id"','"meta_message_id"',
 '"access_token"','"app_secret"','"customer_phone"','"owner_email"',
 '"headers"','"raw_body"'])
 assert.equal(raw.includes(k),false,k);
});

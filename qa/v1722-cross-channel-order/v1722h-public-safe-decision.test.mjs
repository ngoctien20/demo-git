import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const snap=JSON.parse(readFileSync(new URL('./v1722h-public-safe-hosted-go-nogo-20261117.json',import.meta.url),'utf8'));
test('H01 immutable audit snapshot is a current source-only NO-GO, never a runtime authorization',()=>{
 assert.equal(snap.contract,'TIEN404_V17_22H_PUBLIC_SAFE_DECISION_RECORD_V1');
 assert.equal(snap.decision,'NO_GO');
 assert.equal(snap.decision_scope,'REAL_SAME_STORE_MESSENGER_ZALO_HOSTED_NO_SEND_CANARY');
 assert.equal(snap.evidence_class,'READ_ONLY_CONNECTED_METADATA_AND_EXISTING_PINNED_SOURCE');
});
test('H02 real current Supabase Store schema remains absent in dated read-only observation',()=>{
 const r=snap.direct_read_only_snapshot.supabase;
 assert.equal(r.stores_table_exists,false);
 assert.equal(r.store_memberships_table_exists,false);
 assert.equal(r.channel_identity_links_exists,false);
 assert.equal(r.hosted_v1722_qa_orders_exists,false);
 assert.equal(r.store_id_columns_present_in_six_commerce_tables,0);
 assert.equal(r.commerce_tables_observed,6);
 assert.equal(r.public_orders_permissive_select_policy_count,1);
});
test('H03 success n8n metadata never becomes independently accepted native provider owner proof',()=>{
 const r=snap.direct_read_only_snapshot.n8n;
 assert.equal(r.messenger.webhook_execution_metadata_observed,true);
 assert.equal(r.messenger.native_meta_provider_owner_proved_by_execution_metadata,false);
 assert.equal(r.zalo_bot.native_zalo_getme_authenticated_readback_verified,false);
 assert.equal(r.qa_manual_fixture.real_provider_evidence,false);
});
test('H04 primary project originals and independent recovery remain unaccepted',()=>{
 const r=snap.inherited_owner_evidence;
 assert.equal(r.meta_owner.real_meta_page_app_business_admin_proven,false);
 assert.equal(r.zalo_bot_owner.provider_authenticated_getMe_performed,false);
 assert.equal(r.zalo_bot_owner.provider_authenticated_getWebhookInfo_performed,false);
 assert.equal(r.store_auth.real_same_tenant_store_ab_owner_jwt_rls_pass,false);
 assert.equal(r.recovery.current_independent_restoration_accepted,false);
});
test('H05 all seven actual hosted admission gates remain fail-closed',()=>{
 const flags=Object.values(snap.admission_gates);
 assert.equal(flags.length,7);
 assert.ok(flags.every(x=>x===false));
 assert.equal(snap.controls.real_hosted_canary_executed,false);
 assert.equal(snap.controls.source_only,true);
 assert.equal(snap.controls.no_provider_send,true);
 assert.equal(snap.controls.no_order_or_stock_write,true);
 assert.equal(snap.controls.no_credential_intake,true);
 assert.equal(snap.controls.no_deployment,true);
 assert.equal(snap.controls.no_cost_change,true);
 assert.equal(snap.controls.Windows_M0_local_preflight_deferred_not_waived,true);
});
test('H06 no raw token, merchant identity or sensitive credential properties in public snapshot',()=>{
 const text=JSON.stringify(snap);
 assert.doesNotMatch(text,/"(?:jwt|access_token|refresh_token|service_role|password|bot_token|meta_app_secret|phone_number|raw_customer|private_key|psid|session_cookie)"\s*:/i);
 assert.doesNotMatch(text,/Bearer\s+[A-Za-z0-9_-]+/);
 assert.doesNotMatch(text,/bot\d{6,}:[A-Za-z0-9_-]{10,}/);
});

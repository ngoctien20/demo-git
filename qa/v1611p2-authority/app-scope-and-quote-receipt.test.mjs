import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const packet=JSON.parse(readFileSync(new URL('../../docs/ai-handoff/V16_11P2A_APP_ONLY_SCOPE_AND_COST_RECEIPT.json',import.meta.url),'utf8'));
const original=JSON.parse(readFileSync(new URL('../../docs/ai-handoff/V16_11P2_CONFIDENTIAL_QUOTE_ONE_ACTION_PACKET.json',import.meta.url),'utf8'));
const md=readFileSync(new URL('../../docs/ai-handoff/V16_11P2A_APPLICATION_ONLY_SCOPE_AND_QUOTE_CHECKPOINT.md',import.meta.url),'utf8');
test('01 scope intentionally limited to selected application archive',()=>assert.equal(packet.current_scope,'APPLICATION_ARCHIVE_ONLY'));
test('02 archival status remains partial',()=>assert.equal(packet.application_archive_h11r.status,'PARTIAL_APP_ARCHIVE_NOT_FULL_SERVICE_RECOVERY'));
test('03 H11R inventory preserves five app and zero Auth/Storage',()=>{
 const h=packet.application_archive_h11r;assert.equal(h.application_entries,5);assert.equal(h.auth_entries,0);assert.equal(h.storage_entries,0);
});
test('04 historical local H11R checkpoint is not falsely reverified',()=>assert.match(packet.application_archive_h11r.provenance,/NOT_RETESTED/));
test('05 Auth/Storage deferred only from app-only review',()=>{
 const h=packet.application_archive_h11r;assert.equal(h.scope_exclusions.length,2);
 assert.deepEqual(h.scope_exclusions.map(x=>x.domain),['AUTH','STORAGE']);
 assert(h.scope_exclusions.every(x=>x.app_only_gate_blocking===false));
});
test('06 Auth/Storage still block full-service recovery',()=>{
 assert(packet.application_archive_h11r.scope_exclusions.every(x=>x.full_service_gate_blocking===true));
 assert.equal(packet.application_archive_h11r.standalone_full_service_restore_verified,false);
});
test('07 app-only acceptance retains limitations',()=>assert.equal(packet.release_gates.application_archive_review,'ACCEPTED_WITH_LIMITATIONS'));
test('08 hosted DB recovery remains NO_GO',()=>assert.equal(packet.release_gates.database_hosted_recovery,'NO_GO'));
test('09 full Supabase service remains NO_GO',()=>assert.equal(packet.release_gates.full_supabase_service_recovery,'NO_GO'));
test('10 store JWT-RLS and production remain NO_GO',()=>{
 assert.equal(packet.release_gates.store_level_jwt_rls,'NO_GO');
 assert.equal(packet.release_gates.production_commerce,'NO_GO');
});
test('11 provider read-only organization on Free',()=>{
 assert.equal(packet.current_supabase_organization.plan,'free');
 assert.equal(packet.current_supabase_organization.tier,'tier_free');
});
test('12 branch quote is hourly 0.01344 USD',()=>{
 assert.deepEqual(packet.provider_cost_read_only.branch,{type:'branch',recurrence:'hourly',amount_usd:0.01344});
});
test('13 project quote API amount 0 monthly does not equal full zero-cost',()=>{
 assert.equal(packet.provider_cost_read_only.project.amount_usd,0);
 assert.equal(packet.provider_cost_read_only.project_zero_is_all_in_price,false);
 assert.equal(packet.provider_cost_read_only.discount_tax_storage_egress_compute_backup_total,'NOT_VERIFIED');
});
test('14 quote retrieval did not authorize payment, backup, project or branch',()=>{
 assert.equal(packet.provider_cost_read_only.resource_provisioned,false);
 assert.equal(packet.provider_cost_read_only.payment_authorized,false);
 assert.equal(packet.provider_cost_read_only.actual_backup_approved,false);
});
test('15 real JWT and Auth/Storage restoration cannot be claimed',()=>{
 assert.equal(packet.application_archive_h11r.real_supabase_auth_jwt_uat,'NOT_RUN');
 assert.equal(packet.auth_restored,false);assert.equal(packet.storage_objects_restored,false);
});
test('16 source-only patch has no hosted DDL/backup',()=>{
 assert.equal(packet.source_only,true);assert.equal(packet.hosted_sql_changed,false);
 assert.equal(packet.hosted_backup_created,false);assert.equal(packet.full_service_certified,false);
});
test('17 previous V16.11P.2 operator approvals remain disabled',()=>{
 assert.equal(original.one_action.branch_create,false);
 assert.equal(original.one_action.hosted_backup,false);
 assert.equal(original.one_action.hosted_restore,false);
 assert.equal(original.release_decision,'NO_GO');
});
test('18 checkpoint states why app-only does not equal full recovery',()=>{
 assert.match(md,/ACCEPTED WITH LIMITATIONS/);
 assert.match(md,/Full Supabase hosted backup\/restore/);
 assert.match(md,/NO-GO/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {reviewCanary03CReleaseLedger} from './release-evidence-gate.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const r=JSON.parse(readFileSync(join(dir,'actual-hosted-and-workflow-readonly-ledger.json'),'utf8'));
const review=v=>reviewCanary03CReleaseLedger(v);
function noGo(x){
 assert.equal(x.verdict,'NO_GO_LIVE02');
 for(const key of ['can_change_published','can_send_live02','can_write_orders',
   'can_expose_meta_token','can_apply_supabase_migration',
   'private_backup_restore_certified','certified_recipient_approval',
   'verified_hosted_atomic_backend'])
 assert.equal(x[key],false,key);
 assert.equal(x.actual_provider_sends,0);
}
test('real hosted Supabase staging is healthy but one-shot schema/RPC absent',()=>{
 assert.equal(r.supabase_state,'ACTIVE_HEALTHY');
 assert.equal(r.supabase_pg_major,17);
 assert.equal(r.hosted_one_shot_table_count,0);
 assert.equal(r.hosted_claim_rpc_count,0);
 assert.equal(r.hosted_store_table_count,0);
 assert.equal(r.hosted_store_membership_table_count,0);
});
test('real published workflow version-history has exact 27 nodes and 3 credential-bearing nodes',()=>{
 assert.equal(r.published_workflow_id,'Z7FdV7uDvApfbURQ');
 assert.equal(r.published_version,'d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92');
 assert.equal(r.published_nodes,27);
 assert.equal(r.historic_version_nodes,27);
 assert.equal(r.historic_version_connections,23);
 assert.equal(r.credential_assigned_node_count,3);
 assert.equal(r.history_node_names_match_published,true);
 assert.equal(r.history_connections_match_published,true);
});
test('a saved n8n version is NOT an encrypted independent credential backup',()=>{
 const x=review(r);noGo(x);
 assert.equal(x.source_preflight_structurally_valid,true);
 assert.ok(x.reasons.includes('NO_PRIVATE_FULL_ENCRYPTED_WORKFLOW_BACKUP'));
 assert.ok(x.reasons.includes('NO_DISPOSABLE_FULL_RESTORE_OR_CREDENTIAL_REATTACH_PROOF'));
});
test('previous LIVE01 proves historic message match but not new LIVE02 send grant',()=>{
 assert.equal(r.previous_signed_live01_page_sender_send_match,true);
 assert.equal(r.live02_private_expiring_grant_issued,false);
 assert.equal(r.real_reusable_psid_allowlist_set,false);
 noGo(review(r));
});
test('independent backup or restore self-attestation cannot authorize sends',()=>{
 for(const key of ['full_encrypted_private_backup_certified',
   'independent_disposable_restore_certified',
   'full_credential_recovery_certified']){
  const x={...r,[key]:true};
  const decision=review(x);noGo(decision);
  assert.deepEqual(decision.reasons,['REAL_OR_INDEPENDENT_PROOF_REQUIRED_NOT_SELF_ASSERTED']);
 }
});
test('self-claimed one-send and operator reviewer approvals fail closed',()=>{
 for(const key of ['owner_final_exact_patch_authorized',
   'independent_security_reviewer_signed','live02_private_expiring_grant_issued',
   'real_reusable_psid_allowlist_set','native_page_app_permission_verified']){
  const x={...r,[key]:true};
  noGo(review(x));
 }
});
test('even fabricated disposable CI green does not change release decision',()=>{
 const x={...r,postgres_disposable_ci_verified:true};
 noGo(review(x));
});
test('any hosted migration or Published change requires fresh independent audit',()=>{
 for(const key of ['one_shot_postgres_hosted_deployed','published_workflow_modified',
 'provider_token_accessed','actual_live02_sent','personal_meta_identifiers_exported']){
  const x={...r,[key]:true};noGo(review(x));
 }
});
test('unexpected workflow version, node count, credential inventory fail closed',()=>{
 for(const [key,v] of [['published_version','later'],['published_nodes',28],
 ['historic_version_connections',22],['credential_assigned_node_count',2]]){
  const x={...r,[key]:v};const y=review(x);noGo(y);
  assert.deepEqual(y.reasons,['REAL_OR_INDEPENDENT_PROOF_REQUIRED_NOT_SELF_ASSERTED']);
 }
});
test('Page IDs, PSIDs, credentials or personal customer fields are rejected',()=>{
 for(const key of ['psid','page_id','access_token','recipient_id','owner_email','tenant_id']){
  const x={...r,[key]:'fabricated'};const y=review(x);noGo(y);
  assert.deepEqual(y.reasons,['INVALID_OR_PRIVATE_DATA_IN_PUBLIC_LEDGER']);
 }
});
test('current release gate cannot be bypassed with malformed input',()=>{
 for(const x of [undefined,null,[],{},'APPROVED']){
  const y=review(x);noGo(y);
  assert.equal(y.source_preflight_structurally_valid,false);
 }
});
test('disposable SQL uses invoker-only, explicit private grants, unique key and RLS',()=>{
 const s=readFileSync(join(dir,'disposable-postgres-one-shot.sql'),'utf8');
 for(const word of ['SECURITY INVOKER','ON CONFLICT (grant_id) DO NOTHING',
 'ENABLE ROW LEVEL SECURITY','REVOKE ALL ON FUNCTION','REVOKE ALL ON SCHEMA',
 'GRANT EXECUTE ON FUNCTION','CREATE POLICY qa_claim_insert',
 'UNIQUE']) {
  // grant_id PRIMARY KEY also creates the unique arbiter
  if(word==='UNIQUE')assert.match(s,/grant_id uuid PRIMARY KEY/);
  else assert.ok(s.includes(word),word);
 }
 assert.ok(s.includes("CREATE ROLE canary_runtime_qa NOLOGIN"));
 assert.ok(s.includes("CREATE ROLE canary_intruder_qa NOLOGIN"));
});
test('disposable SQL never changes public Supabase or production Commerce data',()=>{
 const s=readFileSync(join(dir,'disposable-postgres-one-shot.sql'),'utf8');
 for(const bad of ['public.orders','public.products','service_role',
 'CREATE EXTENSION','DROP TABLE public','ALTER TABLE public',
 'CREATE SCHEMA public','GRANT ALL ON SCHEMA public']) {
  assert.equal(s.includes(bad),false,bad);
 }
});
test('public hosted inventory snapshot contains no credential/page/PSID material',()=>{
 const s=readFileSync(join(dir,'actual-hosted-and-workflow-readonly-ledger.json'),'utf8');
 for(const key of ['"psid"','"page_id"','"sender_id"','"access_token"',
 '"app_secret"','"email"','"phone"','"customer_name"','"credential_id"'])
 assert.equal(s.includes(key),false,key);
});

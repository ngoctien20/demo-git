/** RPC17.7 — private Real Supabase Auth A/B UAT evidence gate.
 * This module cannot validate JWT signatures or run PostgREST; it accepts ONLY
 * externally verified observations and never authorizes hosted actions.
 */
const blocked=(reason,gaps=[])=>Object.freeze({
 status:'BLOCKED',reason,gaps:Object.freeze(gaps),
 can_assert_real_uat:false,can_migrate:false,can_read_real_data:false,
 can_upload:false,can_send:false,can_deploy:false
});
const exact=(a,b)=>typeof a==='string'&&a.length>0&&a===b;
const verified=(x)=>x?.verified_by_independent_auth_service===true && x?.session_active_rechecked===true && x?.postgrest_authenticated_role===true;
export function inspectRealJwtAbEvidence(evidence={}){
 try{
  const a=evidence?.actorA,b=evidence?.actorB,checks=evidence?.checks;
  if(!verified(a)||!verified(b))return blocked('AUTH_SESSIONS_NOT_INDEPENDENTLY_VERIFIED',['two_real_auth_sessions']);
  if(!a.user_id||!b.user_id||exact(a.user_id,b.user_id)||!a.session_id||!b.session_id||exact(a.session_id,b.session_id))return blocked('DISTINCT_USER_AND_SESSION_REQUIRED');
  if(!exact(a.tenant_id,b.tenant_id)||!a.store_id||!b.store_id||exact(a.store_id,b.store_id))return blocked('SAME_TENANT_DIFFERENT_STORE_REQUIRED');
  if(a.owner_version_verified!==true||b.owner_version_verified!==true||a.store_membership_db_verified!==true||b.store_membership_db_verified!==true)return blocked('CANONICAL_STORE_AUTHORITY_MISSING');
  const required=['A_reads_A_only','B_reads_B_only','A_denied_B','B_denied_A','cross_tenant_denied','revoked_user_denied','outbound_send_disabled','real_merchant_files_absent'];
  const missing=required.filter(k=>checks?.[k]!==true);
  if(missing.length)return blocked('NEGATIVE_POSTGREST_EVIDENCE_MISSING',missing);
  return blocked('INDEPENDENT_SIGNATURE_AND_HUMAN_ADMISSION_REQUIRED');
 }catch{return blocked('FAIL_CLOSED');}
}
export const realSupabaseMigrationDecision=()=>blocked('NO_AUTHORIZED_MIGRATION_RECEIPT');

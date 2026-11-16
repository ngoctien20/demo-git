/**
 * Run: node qa/cbot-uat05/report-cli.mjs
 * Bounded offline report from the pinned DIRECT READ-ONLY audit snapshot.
 * DOES NOT query live Supabase, and does not handle private files or tokens.
 */
import {readFileSync} from 'node:fs';
import {auditRealEvidence} from './real-evidence-intake.mjs';
const observed=JSON.parse(readFileSync(new URL('./observed-hosted-authority-metadata.json',import.meta.url),'utf8'));
const result=auditRealEvidence(observed);
if(result.hostedStoreOrderReadAllowed||result.privilegedRpcRevokeAllowed||
   result.nativeMetaPageSendAllowed||result.nativeZaloOaSendAllowed||
   result.fullPrivateRecoveryAccepted||result.productionReleaseAllowed){
 throw Error('CBOT05_FAIL_CLOSED_POLICY_BREACH');
}
const safeReport={
 contract:result.contract,observed_on:observed.observation_date_jst,
 source_limit:'RECORDED_READ_ONLY_METADATA_NOT_LIVE_REFRESH',
 staging_product_count:observed.supabase.product_count,
 staging_order_count:observed.supabase.order_count,
 staging_auth_user_count:observed.supabase.auth_user_count,
 staging_auth_session_count:observed.supabase.auth_session_count,
 cloudflare_worker_source_read:observed.cloudflare.script_source_downloaded,
 observed_pass_count:result.observedPassed.length,
 unclosed_evidence_count:result.awaitingPrivateEvidenceKinds.length,
 blockers:result.blockers,
 release:{hosted_order_lookup:false,rpc_revoke:false,production:false},
 operator_next:'Use existing PR #198 local archive inspection + H11R11 PR #205 PRIVATE independent reviewer; verify native Meta Page and Zalo OA in their own admin consoles.'
};
process.stdout.write(JSON.stringify(safeReport,null,2)+'\n');

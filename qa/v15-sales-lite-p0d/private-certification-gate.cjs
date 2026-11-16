'use strict';
/**
 * V15 Sales Lite P0-D — cross-branch release dependency dossier ONLY.
 * Pure local validation of ticket references. No provider, DB, backup API,
 * cryptographic real-world certification, authorization or customer data.
 *
 * PR132: ephemeral pg_dump/pg_restore proof ONLY.
 * PR135: synthetic approval signature proof ONLY.
 * PR136: isolated Store RLS expand/rollback proof ONLY.
 */
const SOURCES=Object.freeze({
  recovery_rehearsal:Object.freeze({pr:132,head:'70494f279f8efca5b1ac62004c3fca0186d454a0',run:43790419032,level:'DISPOSABLE_SYNTHETIC_ONLY'}),
  backup_approval_rehearsal:Object.freeze({pr:135,head:'6ef086202a524b0c595fda3f03ae89a10fe73676',run:43792524351,level:'SYNTHETIC_SIGNATURE_ONLY'}),
  store_expand_rehearsal:Object.freeze({pr:136,head:'5cc67aabf0ead335b1ceab413fd32b295a11da16',run:43792737344,level:'DISPOSABLE_SYNTHETIC_ONLY'})
});
const REQUIRED=Object.freeze({
  merchant_auth_witness:'INDEPENDENT_MERCHANT_AUTH',
  tenant_owner_witness:'INDEPENDENT_TENANT_OWNER',
  provider_owner_consent:'NATIVE_PROVIDER_OWNER_VERIFIER',
  platform_controller_approval:'PROJECT_WIDE_DATA_CONTROLLER',
  independent_security_approval:'PRIVATE_SECURITY_REVIEWER',
  encryption_destination:'PRIVATE_VAULT_CUSTODIAN',
  scoped_export_operator:'AUTHORIZED_BACKUP_OPERATOR',
  private_export_manifest:'PRIVATE_BACKUP_OPERATOR',
  backup_integrity:'INDEPENDENT_CHECKSUM_REVIEWER',
  isolated_restore:'INDEPENDENT_RESTORE_OPERATOR',
  legacy_row_attribution:'INDEPENDENT_DATA_STEWARD',
  hosted_store_certification:'HOSTED_AUTH_JWT_RLS_TESTER'
});
const TICKET=/^SEC-[A-Z0-9_-]{12,48}$/;
const REQ_ID=/^P0D-[A-Z0-9_-]{12,48}$/;
const SENSITIVE=/^(?:user_?id|email|phone|customer|psid|token|jwt|password|secret|credential|backup_?url|storage_?url|raw_?data|private_?key)$/i;
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const deny=(reason,gaps)=>Object.freeze({
 status:'BLOCKED',reason,
 missing_private_proof:Object.freeze([...gaps]),
 real_owner_certified:false,hosted_backup_certified:false,
 hosted_restore_certified:false,real_signed_approval_certified:false,
 hosted_store_rls_certified:false,may_export_hosted:false,
 may_restore_hosted:false,may_apply_migration:false,
 may_backfill:false,may_send_provider:false,may_write_orders:false,
 may_enable_paid_models:false,pilot_allowed:false,
 review_only:true,no_hosted_side_effects:true
});
function reviewP0dDossier(packet){
 const all=Object.keys(REQUIRED);
 if(!isPlain(packet)||Object.keys(packet).some(k=>!['contract','project','request_id','receipts'].includes(k))||
   Object.keys(packet).length!==4||
   packet.contract!=='TIEN404_V15_P0D_READINESS_V1'||packet.project!=='ifxlvrhyjhbzbrkdsida'||
   !REQ_ID.test(packet.request_id||'')||!isPlain(packet.receipts))
     return deny('INVALID_OR_OUT_OF_SCOPE_REQUEST',all);
 const missing=[],seen=new Set(),unexpected=[];
 for(const [key,value] of Object.entries(packet.receipts)){
   if(!Object.hasOwn(REQUIRED,key)){unexpected.push(key);continue;}
   if(!isPlain(value)||Object.keys(value).some(k=>SENSITIVE.test(k))||
       Object.keys(value).sort().join(',')!=='issuer_class,status,ticket'||
       value.issuer_class!==REQUIRED[key]||
       value.status!=='PENDING_INDEPENDENT_PRIVATE_REVIEW'||
       !TICKET.test(value.ticket)||seen.has(value.ticket)){
     unexpected.push(key);continue;
   }
   seen.add(value.ticket);
 }
 for(const key of all)if(!Object.hasOwn(packet.receipts,key))missing.push(key);
 if(unexpected.length)return deny('MALFORMED_OR_UNTRUSTED_PRIVATE_PROOF_REFERENCE',[...missing,...unexpected]);
 if(missing.length)return deny('PRIVATE_EVIDENCE_INCOMPLETE',missing);
 return deny('INDEPENDENT_HUMAN_VERIFICATION_AND_EXPLICIT_APPROVAL_REQUIRED',[]);
}
module.exports={SOURCES,REQUIRED,reviewP0dDossier};

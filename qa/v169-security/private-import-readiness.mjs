/**
 * V16.9: PRIVATE FILE ONBOARDING READINESS CONTRACT (synthetic metadata only).
 * It NEVER uploads or stores file bytes, creates signed URLs, contacts a
 * scanner, sends real events or updates product/price/stock/customer tables.
 * Must not be used as a real malware scanner or production access control.
 */
import {previewImport,parseCsv,sampleCsvForStore,MARKER,MAX_SOURCE_BYTES} from '../v168-merchant/import-preview.mjs';
export const IMPORT_READINESS_CONTRACT='T404_V169_PRIVATE_IMPORT_QUARANTINE_QA';
const fail=x=>{throw Error(x)};
const ok=(v,msg)=>{if(!v)fail(msg)};
const REF=/^QA_FILE_[A-Z0-9_]{4,40}$/;
const IMPORT_ID=/^QA_IMPORT_[A-Z0-9_]{4,36}$/;
const FILE_TYPES=Object.freeze({
 CSV:'text/csv',
 XLSX:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
});
const MAX_EXPIRES_MS=20*60*1000;
export function createQaPrivateImportReadiness(ledger){
 ok(ledger&&typeof ledger.validateScope==='function','TRUSTED_QA_LEDGER_REQUIRED');
 const jobs=new Map(),audit=[],activeFiles=new Map();
 let seq=0;
 function permit(scope,store_id,roles){ledger.validateScope(scope,store_id,roles);return scope}
 function ref(store_id,import_id){return store_id+'|'+import_id}
 function readJob(scope,store_id,import_id,roles){
  permit(scope,store_id,roles);
  const job=jobs.get(ref(store_id,import_id));
  ok(job,'IMPORT_NOT_FOUND_OR_CROSS_STORE_DENIED');
  return job;
 }
 function beforeTimeout(job,now_ms){
  ok(Number.isSafeInteger(now_ms)&&now_ms>0,'INVALID_QA_CLOCK');
  ok(now_ms>=job.created_at_ms,'BACKDATED_IMPORT_EVENT');
  if(now_ms>job.expires_at_ms){job.state='EXPIRED_QA';fail('IMPORT_EXPIRED_REUPLOAD_REQUIRED')}
  ok(!['ABORTED_QA','REJECTED_QA','EXPIRED_QA'].includes(job.state),'IMPORT_CLOSED');
 }
 function log(job,type){
  ok(audit.length<2000,'QA_AUDIT_LIMIT');
  audit.push(Object.freeze({seq:++seq,store_id:job.store_id,import_id:job.import_id,event:type,
   state:job.state,qa_only:true}));
 }
 function begin({scope,store_id,import_id,file_ref,format,content_type,size_bytes,now_ms}){
  permit(scope,store_id,['OWNER','TIEN404_SUPPORT']);
  ok(typeof import_id==='string'&&IMPORT_ID.test(import_id)&&
     typeof file_ref==='string'&&REF.test(file_ref),'OPAQUE_QA_REFERENCE_REQUIRED');
  ok(Object.hasOwn(FILE_TYPES,format)&&content_type===FILE_TYPES[format],'CONTENT_TYPE_NOT_ALLOWLISTED');
  ok(Number.isSafeInteger(size_bytes)&&size_bytes>0&&size_bytes<=MAX_SOURCE_BYTES,'FILE_SIZE_DENIED');
  ok(Number.isSafeInteger(now_ms)&&now_ms>0,'INVALID_QA_CLOCK');
  const k=ref(store_id,import_id);
  ok(!jobs.has(k),'REPLAY_IMPORT_ALREADY_REGISTERED');
  ok(!activeFiles.has(store_id+'|'+file_ref),'DUPLICATE_FILE_REF_IN_SHOP');
  const j={contract:IMPORT_READINESS_CONTRACT,store_id,tenant_id:scope.tenant_id,
   import_id,file_ref,format,content_type,size_bytes,created_at_ms:now_ms,
   expires_at_ms:now_ms+MAX_EXPIRES_MS,source_kind:'SYNTHETIC_PRODUCT_CATALOG_ONLY',
   state:'QUARANTINED_METADATA_ONLY',revision:1,scan_state:'NOT_SCANNED',
   preview_rows:0,preview_accepted:0,preview_rejected:0,reviewed_by:null,
   approved_by:null,metadata_only:true,actual_file_stored:false,actual_antivirus_scanned:false,
   data_protection_authorized:false,hosted_import_written:false,qa_only:true};
  jobs.set(k,j);activeFiles.set(store_id+'|'+file_ref,k);log(j,'QUARANTINE_METADATA_CREATED');
  return safe(j);
 }
 function safe(j){
  return Object.freeze({contract:j.contract,tenant_id:j.tenant_id,store_id:j.store_id,
    import_id:j.import_id,source_kind:j.source_kind,state:j.state,revision:j.revision,
    scan_state:j.scan_state,preview_rows:j.preview_rows,preview_accepted:j.preview_accepted,
    preview_rejected:j.preview_rejected,approved_by:j.approved_by,
    reviewed_by:j.reviewed_by,expires_at_ms:j.expires_at_ms,metadata_only:true,
    actual_file_stored:false,actual_antivirus_scanned:false,hosted_import_written:false,
    production_activation:false,qa_only:true});
 }
 function scanMetadata({scope,store_id,import_id,result,expected_revision,now_ms}){
  const j=readJob(scope,store_id,import_id,['IMPORT_SCANNER_QA']);
  beforeTimeout(j,now_ms);
  ok(j.state==='QUARANTINED_METADATA_ONLY','SCAN_ORDER_INVALID');
  ok(expected_revision===j.revision,'IMPORT_REVISION_CONFLICT');
  ok(['CLEAN_QA_SIMULATION','REJECTED_QA_SIMULATION'].includes(result),'SCAN_RESULT_NOT_SYNTHETIC');
  j.scan_state=result;
  j.state=result==='CLEAN_QA_SIMULATION'?'QA_SCAN_SIMULATED':'REJECTED_QA';
  j.revision++;log(j,'SCAN_RESULT_METADATA_ONLY');
  return safe(j);
 }
 function previewSyntheticRows({scope,store_id,import_id,expected_revision,now_ms,rows}){
  const j=readJob(scope,store_id,import_id,['OWNER','TIEN404_SUPPORT']);
  beforeTimeout(j,now_ms);
  ok(j.state==='QA_SCAN_SIMULATED','SCAN_STEP_REQUIRED');
  ok(expected_revision===j.revision,'IMPORT_REVISION_CONFLICT');
  // Reuse V16.8 parser: reject any nonfixture marker or PII/customer columns.
  const sample=rows??parseCsv(sampleCsvForStore(store_id));
  ok(Array.isArray(sample)&&sample.length>=2,'ROWS_NOT_QA');
  const report=previewImport({store_id,rows:sample});
  ok(report.rejected===0,'VALIDATION_FAILURE_NO_IMPORT');
  ok(report.rows.every(x=>x.valid&&x.not_committed&&x.status.endsWith('_PREVIEW')),
    'UNSAFE_OR_NON_SYNTHETIC_CATALOG');
  j.preview_rows=report.total;j.preview_accepted=report.accepted;j.preview_rejected=report.rejected;
  j.state='PREVIEW_ONLY';j.revision++;log(j,'CATALOG_DIFF_PREVIEW_ONLY');
  return Object.freeze({...safe(j),public_qa_preview:Object.freeze({
   total:report.total,accepted:report.accepted,rejected:report.rejected,
   never_committed:true,never_auto_deleted:true})});
 }
 function approvePreview({scope,store_id,import_id,expected_revision,now_ms}){
  const j=readJob(scope,store_id,import_id,['OWNER']);
  beforeTimeout(j,now_ms);
  ok(j.state==='PREVIEW_ONLY'&&j.preview_rows>0,'VALIDATED_PREVIEW_REQUIRED');
  ok(expected_revision===j.revision,'IMPORT_REVISION_CONFLICT');
  j.approved_by=scope.actor_id;j.state='OWNER_APPROVED_QA_ONLY';
  j.revision++;log(j,'QA_OWNER_APPROVED_PREVIEW');
  return safe(j);
 }
 function reviewSecurityMetadata({scope,store_id,import_id,expected_revision,now_ms}){
  const j=readJob(scope,store_id,import_id,['SECURITY_REVIEWER_QA']);
  beforeTimeout(j,now_ms);
  ok(j.state==='OWNER_APPROVED_QA_ONLY','OWNER_APPROVAL_REQUIRED');
  ok(expected_revision===j.revision,'IMPORT_REVISION_CONFLICT');
  ok(j.approved_by!==scope.actor_id,'SELF_REVIEW_FORBIDDEN');
  j.reviewed_by=scope.actor_id;j.state='METADATA_REVIEWED_OFFLINE_QA_ONLY';
  j.revision++;log(j,'INDEPENDENT_METADATA_REVIEW_ONLY');
  return safe(j);
 }
 function cancel({scope,store_id,import_id,expected_revision}){
  const j=readJob(scope,store_id,import_id,['OWNER']);
  ok(expected_revision===j.revision,'IMPORT_REVISION_CONFLICT');
  ok(!['EXPIRED_QA','ABORTED_QA'].includes(j.state),'ALREADY_CLOSED');
  j.state='ABORTED_QA';j.revision++;log(j,'OWNER_CANCELLED_MOCK_IMPORT');
  return safe(j);
 }
 function getStatus({scope,store_id,import_id}){
  return safe(readJob(scope,store_id,import_id,
   ['OWNER','TIEN404_SUPPORT','IMPORT_SCANNER_QA','SECURITY_REVIEWER_QA']));
 }
 function auditForStore({scope,store_id}){
  permit(scope,store_id,['OWNER','SECURITY_REVIEWER_QA']);
  return Object.freeze(audit.filter(x=>x.store_id===store_id).map(x=>({...x})));
 }
 function canUploadRealData(){return Object.freeze({
  actual_upload_enabled:false,private_bucket_created:false,
  signed_upload_url_issued:false,scanner_approved:false,
  store_owner_jwt_verified:false,consent_and_legal_checked:false,
  provider_license_confirmed:false,production_import_allowed:false,
  reason:'HOSTED_STORE_IDENTITY_DPA_PRIVATE_STORAGE_AND_SCANNER_GATES_PENDING'
 })}
 function commitCatalog(){fail('LIVE_CATALOG_COMMIT_FORBIDDEN_V169')}
 function issueSignedUploadUrl(){fail('PRIVATE_STORAGE_NOT_PROVISIONED_V169')}
 function scanRealContent(){fail('REAL_FILE_SCANNER_NOT_CONNECTED_V169')}
 function acceptCustomerPII(){fail('CUSTOMER_PII_INTAKE_FORBIDDEN_V169')}
 return Object.freeze({begin,scanMetadata,previewSyntheticRows,approvePreview,reviewSecurityMetadata,
  cancel,getStatus,auditForStore,canUploadRealData,commitCatalog,issueSignedUploadUrl,
  scanRealContent,acceptCustomerPII});
}
export const PRIVATE_IMPORT_DESIGN=Object.freeze({
 state_model:['QUARANTINED_METADATA_ONLY','QA_SCAN_SIMULATED','PREVIEW_ONLY',
  'OWNER_APPROVED_QA_ONLY','METADATA_REVIEWED_OFFLINE_QA_ONLY','ABORTED_QA','REJECTED_QA','EXPIRED_QA'],
 file_bytes_saved:false,mime_sniffing_performed:false,antimalware_performed:false,
 signed_urls_enabled:false,customers_allowed:false,production_ready:false,
 type_allowlist:FILE_TYPES,required_qa_marker:MARKER,qa_max_file_bytes:MAX_SOURCE_BYTES,
 no_overwrite:true,store_scoped:true,atomic_import:false,
 requires_hosted_owner_jwt:true,requires_private_storage_review:true,
 requires_data_agreement:true,requires_restore_plan:true
});

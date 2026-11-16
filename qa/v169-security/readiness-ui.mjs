/**
 * TIEN404 V16.9 browser-local synthetic readiness console.
 * No network calls, credentials, raw files, real customer data or storage.
 */
import {createQaOwnerEvidenceLedger,EVIDENCE_TYPES} from './owner-evidence.mjs';
import {createQaPrivateImportReadiness} from './private-import-readiness.mjs';
const $=x=>document.getElementById(x);
const ledger=createQaOwnerEvidenceLedger(),intake=createQaPrivateImportReadiness(ledger);
const stores={
 A:{store:'QA_STORE_A',tenant:'QA_TENANT_1',submit:'QA_TI_ENROLL_A',owner:'QA_OWNER_A',reviewer:'QA_QA_REVIEWER_A',scanner:'QA_QA_SCANNER_A'},
 B:{store:'QA_STORE_B',tenant:'QA_TENANT_1',submit:'QA_OWNER_B',owner:'QA_OWNER_B',reviewer:'QA_QA_REVIEWER_B',scanner:'QA_QA_SCANNER_B'},
 C:{store:'QA_STORE_C',tenant:'QA_TENANT_2',submit:'QA_OWNER_C',owner:'QA_OWNER_C',reviewer:'QA_QA_REVIEWER_C',scanner:'QA_QA_SCANNER_C'}
};
const roles=Object.fromEntries(Object.entries(stores).map(([k,v])=>[k,{
 owner:ledger.issueQaActor({actor_id:v.owner,store_id:v.store}),
 submit:ledger.issueQaActor({actor_id:v.submit,store_id:v.store}),
 reviewer:ledger.issueQaActor({actor_id:v.reviewer,store_id:v.store}),
 scanner:ledger.issueQaActor({actor_id:v.scanner,store_id:v.store})
}]));
const imports={};const $show=(node,value)=>{
 $(node).textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
};
const clock=1794800000000;
let selected='A';
for(const kind of EVIDENCE_TYPES){
 const el=document.createElement('option');el.value=kind;el.textContent=kind;
 $('evidenceType').append(el);
}
function active(){return stores[selected]}
function activeActors(){return roles[selected]}
function evidenceId(type){
 return 'QA_EVID_'+selected+'_'+String(EVIDENCE_TYPES.indexOf(type)+1).padStart(3,'0');
}
function currentImportId(){return 'QA_IMPORT_'+selected+'_0001'}
function render(){
 const s=active(),scope=activeActors().owner;
 $('scope').textContent=s.tenant+'\n'+s.store+'\nOwner: '+s.owner;
 const data=ledger.evidenceStatus({scope,store_id:s.store});
 $('evidenceMatrix').replaceChildren();
 for(const e of data.evidence){
  const div=document.createElement('div');div.textContent=e.kind+' · '+e.state;
  $('evidenceMatrix').append(div);
 }
 const gates=[
 'Owner JWT / Store RLS thật: '+data.hosted_owner_jwt_rls,
 'Restore test độc lập: '+data.backup_restore_external,
 'RPC privileged caller authority: '+data.rpc_remediation_authority,
 'Giấy phép n8n thương mại: '+data.commercial_license,
 'Page/OA ownership: '+data.provider_channel_ownership,
 'Quét file thật và private bucket: BLOCKED',
 'Đồng ý xử lý dữ liệu + điều khoản pháp lý: BLOCKED',
 'Ghi đơn và tồn kho thật: BLOCKED'
 ];
 $('blockedGates').replaceChildren();
 for(const line of gates){const div=document.createElement('div');div.textContent=line;$('blockedGates').append(div)}
 $show('releaseResult',{store_id:s.store,reviewed_qa_metadata:data.metadata_reviewed,
  proof_items:data.evidence_total,hosted_certified:false,commerce_enabled:false,
  customer_data_import_enabled:false,release:'NO-GO'});
}
$('shop').addEventListener('change',e=>{
 selected=e.target.value;
 $('evidenceResult').textContent='';
 $('importResult').textContent='';
 render();
});
const operation=(id,fn,output='importResult')=>{
 $(id).addEventListener('click',()=>{
  try{$show(output,fn())}catch(e){$show(output,{status:'DENIED_QA',reason:e.message,
   production_effects:0})}
  render();
 });
};
operation('submitProof',()=>{
 const s=active(),kind=$('evidenceType').value;
 return ledger.makeSubmission({scope:activeActors().submit,store_id:s.store,
  kind,evidence_ref:evidenceId(kind),now_ms:clock});
},'evidenceResult');
operation('reviewProof',()=>{
 const s=active(),kind=$('evidenceType').value;
 return ledger.reviewMetadata({scope:activeActors().reviewer,store_id:s.store,
  kind,evidence_ref:evidenceId(kind),now_ms:clock+100});
},'evidenceResult');
operation('startImport',()=>{
 const s=active(),id=currentImportId();
 const r=intake.begin({scope:activeActors().submit,store_id:s.store,import_id:id,
  file_ref:'QA_FILE_'+selected+'_0001',format:'CSV',
  content_type:'text/csv',size_bytes:180,now_ms:clock});
 imports[selected]=r.import_id;return r;
});
operation('scanImport',()=>{
 const s=active(),id=currentImportId(),r=intake.getStatus({
  scope:activeActors().scanner,store_id:s.store,import_id:id});
 return intake.scanMetadata({scope:activeActors().scanner,store_id:s.store,import_id:id,
  result:'CLEAN_QA_SIMULATION',expected_revision:r.revision,now_ms:clock+100});
});
operation('previewImport',()=>{
 const s=active(),id=currentImportId(),r=intake.getStatus({
  scope:activeActors().submit,store_id:s.store,import_id:id});
 return intake.previewSyntheticRows({scope:activeActors().submit,store_id:s.store,import_id:id,
  expected_revision:r.revision,now_ms:clock+200});
});
operation('ownerApprove',()=>{
 const s=active(),id=currentImportId(),r=intake.getStatus({
  scope:activeActors().owner,store_id:s.store,import_id:id});
 return intake.approvePreview({scope:activeActors().owner,store_id:s.store,import_id:id,
  expected_revision:r.revision,now_ms:clock+300});
});
operation('reviewImport',()=>{
 const s=active(),id=currentImportId(),r=intake.getStatus({
  scope:activeActors().reviewer,store_id:s.store,import_id:id});
 return intake.reviewSecurityMetadata({scope:activeActors().reviewer,store_id:s.store,
  import_id:id,expected_revision:r.revision,now_ms:clock+400});
});
operation('attemptCommit',()=>intake.commitCatalog());
render();

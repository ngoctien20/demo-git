/**
 * TIEN404 V16.11P - entirely synthetic local UI. No network, persistence,
 * real files or private auth. Only fixed QA identity objects are used.
 */
import {REQUIRED_PROOFS,RECOVERY_DOMAINS,prepareRecoveryRequest,
 createQaIntakeLedger,assessRecoveryPlan} from './operator-intake.mjs';
const $=id=>document.getElementById(id);
const ledger=createQaIntakeLedger();
const roles={
 A:{store:'QA_STORE_A',tenant:'QA_TENANT_1',owner:ledger.issueQaIdentity('QA_OWNER_A','QA_STORE_A'),
  operator:ledger.issueQaIdentity('QA_OPERATOR_A','QA_STORE_A'),
  reviewer:ledger.issueQaIdentity('QA_REVIEWER_A','QA_STORE_A')},
 B:{store:'QA_STORE_B',tenant:'QA_TENANT_1',owner:ledger.issueQaIdentity('QA_OWNER_B','QA_STORE_B'),
  operator:null,reviewer:null}
};
let selected='A';let counter=0;
for(const kind of REQUIRED_PROOFS){
 const o=document.createElement('option');o.value=kind;o.textContent=kind;$('kind').append(o);
}
const display=(id,value)=>{$(id).textContent=typeof value==='string'?value:JSON.stringify(value,null,2)};
function context(){return roles[selected]}
function uiResult(f,target){
 try{display(target,f())}catch(e){display(target,{status:'DENIED_QA',reason:e.message,actual_hosted_effects:0})}
 refresh();
}
function refresh(){
 const c=context();
 $('shopScope').textContent=c.tenant+'\n'+c.store+'\nHosted Store RLS: BLOCKED';
 $('evidenceMatrix').replaceChildren();
 const snapshot=ledger.snapshot({scope:c.owner,store:c.store});
 for(const x of snapshot.evidence){
  const div=document.createElement('div');div.textContent=x.kind+' — '+x.state;
  $('evidenceMatrix').append(div);
 }
 $('recoveryMatrix').replaceChildren();
 for(const item of RECOVERY_DOMAINS){
  const div=document.createElement('div');div.textContent=item+' — NOT_VERIFIED';
  $('recoveryMatrix').append(div);
 }
 display('goResult',{contract:snapshot.contract,store:c.store,
  metadata_reviewed:snapshot.metadata_reviewed,required:snapshot.total,
  verified_external:snapshot.real_evidence_count,
  recovery:assessRecoveryPlan({}).missing,
  real_jwt_rls:'NOT_RUN',allow_hosted_backup:false,
  allow_paid_resources:false,decision:'NO_GO'});
}
$('shop').addEventListener('change',e=>{
 selected=e.target.value;
 display('evidenceResult','');
 display('requestResult','');
 refresh();
});
$('draft').addEventListener('click',()=>uiResult(()=>{
 counter++;
 return prepareRecoveryRequest({
  request_id:'QA_REQUEST_UI_'+String(counter).padStart(4,'0'),
  project_ref:'ifxlvrhyjhbzbrkdsida',environment:'STAGING',
  operation:'APPROVAL_PREPARATION_ONLY',data_scope:'METADATA_AND_SYNTHETIC_ONLY',
  restore_target:'NOT_PROVISIONED',backup_destination:'NOT_CONFIGURED',
  operator_role:'RECOVERY_OPERATOR',requester_role:'PLATFORM_REQUESTER',
  reviewer_role:'INDEPENDENT_SECURITY_REVIEWER',
  window_status:'NOT_APPROVED',cost_status:'QUOTE_REQUIRED',max_cost_vnd:null,
  merchant_authority_status:'MISSING',evidence_ref:null,
  created_ms:1794800000000,expires_ms:1794803600000
 });
},'requestResult'));
$('tryBackup').addEventListener('click',()=>uiResult(
 ()=>ledger.approveBackup(),'requestResult'));
const receiptId=kind=>'QA_RECEIPT_UI_'+String(REQUIRED_PROOFS.indexOf(kind)+100);
const requestId=kind=>'QA_EVID_REQUEST_UI_'+String(REQUIRED_PROOFS.indexOf(kind)+100);
$('ask').addEventListener('click',()=>uiResult(()=>{
 const c=context();
 return ledger.requestEvidence({scope:c.owner,store:c.store,kind:$('kind').value,
  request_id:requestId($('kind').value)});
},'evidenceResult'));
$('receive').addEventListener('click',()=>uiResult(()=>{
 const c=context();
 if(!c.operator)throw Error('NO_QA_OPERATOR_ASSIGNED_TO_THIS_STORE');
 return ledger.registerOpaqueQaReceipt({scope:c.operator,store:c.store,
  kind:$('kind').value,request_id:requestId($('kind').value),
  receipt_id:receiptId($('kind').value)});
},'evidenceResult'));
$('review').addEventListener('click',()=>uiResult(()=>{
 const c=context();
 if(!c.reviewer)throw Error('NO_INDEPENDENT_QA_REVIEWER_ASSIGNED');
 return ledger.reviewQaReceipt({scope:c.reviewer,store:c.store,kind:$('kind').value});
},'evidenceResult'));
refresh();

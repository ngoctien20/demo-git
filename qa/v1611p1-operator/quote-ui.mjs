/* Offline synthetic operator/quote console. Never send/store/request real data. */
import {ROLES,compareQuoteOnlyOptions,validateQuoteOnlyRequest,
 prepareWrittenAuthorization,createQaAssignmentLedger,RELEASE} from './quote-gate.mjs';
const $=x=>document.getElementById(x);
const ledger=createQaAssignmentLedger();
const qa={
 A:{store:'QA_STORE_A',tenant:'QA_TENANT_1',
   requester:ledger.issueQaScope('QA_PLATFORM_A','QA_STORE_A'),
   reviewer:ledger.issueQaScope('QA_SECURITY_A','QA_STORE_A')},
 B:{store:'QA_STORE_B',tenant:'QA_TENANT_1',
   requester:null,reviewer:null,
   owner:ledger.issueQaScope('QA_OWNER_B','QA_STORE_B')}
};
let selected='A',counter=0;
for(const role of ROLES){const o=document.createElement('option');o.value=role;o.textContent=role;$('role').append(o);}
const show=(key,v)=>{$(key).textContent=typeof v==='string'?v:JSON.stringify(v,null,2)};
const active=()=>qa[selected];
function doQa(fn,where){
 try{show(where,fn())}catch(e){show(where,{status:'DENIED_QA',reason:e.message,real_hosted_effect:0});}
 render();
}
function render(){
 const c=active(),hours=Number($('hours').value);
 $('scope').textContent=c.tenant+' / '+c.store;
 $('quotes').replaceChildren();
 for(const item of compareQuoteOnlyOptions(hours)){
  const article=document.createElement('article');article.className='qcard';
  const title=document.createElement('b');title.textContent=item.id;
  const p=document.createElement('p');
  p.textContent=item.public_reference_compute_usd===null
   ?'Chưa có giá compute' : '$'+item.public_reference_compute_usd.toFixed(5)+' compute tham khảo';
  const note=document.createElement('small');note.textContent=item.note;
  article.append(title,p,note);$('quotes').append(article);
 }
 const roles=ledger.status({scope:c.requester??c.owner,store:c.store});
 $('roles').replaceChildren();
 for(const r of roles.nominations){
  const div=document.createElement('div');div.textContent=r.role+' — '+r.state;
  $('roles').append(div);
 }
 $('gate').textContent=RELEASE+' / REAL JWT: NOT_RUN / ACCOUNT QUOTE: NOT_OBTAINED';
}
$('shop').addEventListener('change',e=>{selected=e.target.value;show('operatorResult','');show('quoteResult','');render();});
$('hours').addEventListener('change',render);
$('draftQuote').addEventListener('click',()=>doQa(()=>{
 counter++;
 return validateQuoteOnlyRequest({request_id:'QA_QUOTE_REQ_UI_'+String(counter).padStart(4,'0'),
  project_ref:'ifxlvrhyjhbzbrkdsida',option_id:'SUPABASE_PREVIEW_BRANCH',
  estimated_hours:Number($('hours').value),requested_by:'QA_PLATFORM_REQUESTER',
  scope:'QUOTE_ONLY_NO_PROVISION',data_class:'SYNTHETIC_ONLY',
  quote_reference:null,operator_proof:null,reviewer_proof:null,
  payer_approval:false,new_resource_id:null,maintenance_window:null,signed_authorization:false});
},'quoteResult'));
$('tryProvision').addEventListener('click',()=>doQa(()=>ledger.createBranch(),'quoteResult'));
$('nominate').addEventListener('click',()=>doQa(()=>{
 const c=active();
 if(!c.requester)throw Error('NO_PLATFORM_REQUESTER_VERIFIED_FOR_THIS_QA_STORE');
 const role=$('role').value;return ledger.proposeRole({scope:c.requester,store:c.store,role,
  assignment_ref:'QA_NOM_UI_'+String(100+ROLES.indexOf(role))});
},'operatorResult'));
$('review').addEventListener('click',()=>doQa(()=>{
 const c=active();
 if(!c.reviewer)throw Error('NO_INDEPENDENT_QA_REVIEWER_FOR_STORE');
 return ledger.reviewNomination({scope:c.reviewer,store:c.store,role:$('role').value});
},'operatorResult'));
$('draftAuthorization').addEventListener('click',()=>doQa(()=>{
 counter++;
 return prepareWrittenAuthorization({approval_id:'QA_APPROVAL_UI_'+String(counter).padStart(4,'0'),
  target_project_ref:'ifxlvrhyjhbzbrkdsida',
  operation:'PREPARE_QUOTE_AND_APPROVAL_ONLY',environment:'STAGING',
  requester:'QA_PLATFORM_REQUESTER',backup_operator:null,security_reviewer:null,
  release_owner:null,budget_cap_vnd:null,budget_currency:'VND',provider_quote_ref:null,
  window_start:null,window_end:null,restore_target:null,
  data_scope:'NO_REAL_CUSTOMER_DATA',rollback_ref:'QA_ROLLBACK_UI_0001',
  approval_signature:null});
},'authorizationResult'));
render();

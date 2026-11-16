/* V16.11P.2 — browser-local QA simulation only. No I/O, storage or secrets. */
import {
 REQUIRED_ROLES,RELEASE,ACTION,PROJECT_REF,
 makeQuoteRequestDraft,prepareSingleActionAuthorization,
 createQaOperatorNominationLedger
} from './approval-gate.mjs';
const $=x=>document.getElementById(x);
const ledger=createQaOperatorNominationLedger();
const actors={
 A:{store:'QA_STORE_A',tenant:'QA_TENANT_1',
  requester:ledger.scope('QA_PLATFORM_A','QA_STORE_A'),
  reviewer:ledger.scope('QA_REVIEWER_A','QA_STORE_A')},
 B:{store:'QA_STORE_B',tenant:'QA_TENANT_1',
  requester:null,reviewer:null,owner:ledger.scope('QA_OWNER_B','QA_STORE_B')}
};
let selected='A',seq=0;
const active=()=>actors[selected];
const print=(key,val)=>{$(key).textContent=typeof val==='string'?val:JSON.stringify(val,null,2)};
const execute=(key,fn)=>{
 try{print(key,fn())}catch(e){print(key,{state:'DENIED_QA',reason:e.message,hosted_effects:0});}
 render();
};
for(const role of REQUIRED_ROLES){const o=document.createElement('option');o.value=role;o.textContent=role;$('role').append(o);}
function render(){
 const a=active();
 $('scope').textContent=a.tenant+' / '+a.store+' / Synthetic only';
 $('quotes').replaceChildren();
 for(const [title,detail] of [
  ['Preview Branch','NOT QUERIED · Account cost unknown'],
  ['Isolated Project','NOT QUERIED · Eligibility unknown']]){
  const div=document.createElement('div'),strong=document.createElement('strong');
  const p=document.createElement('p');strong.textContent=title;p.textContent=detail;
  div.append(strong,p);$('quotes').append(div);
 }
 const s=ledger.status({scope:a.requester??a.owner,store:a.store});
 $('roleList').replaceChildren();
 for(const slot of s.slots){const d=document.createElement('div');d.textContent=slot.role+' · '+slot.state;$('roleList').append(d);}
 $('release').textContent=RELEASE+' · JWT-RLS HOSTED NOT_RUN · COST QUOTE NOT_QUERIED';
}
$('store').addEventListener('change',v=>{
 selected=v.target.value;
 print('roleResult','');print('quoteResult','');render();
});
$('draft').addEventListener('click',()=>execute('quoteResult',()=>{
 seq++;
 return makeQuoteRequestDraft({
  request_id:'QA_COST_UI_'+String(seq).padStart(3,'0'),
  project_ref:PROJECT_REF,organization_confirmation:'PENDING_USER_CONFIRMATION',
  action:ACTION,environment:'STAGING',data_scope:'NO_REAL_CUSTOMER_DATA',
  requested_hours:24,quote_option:$('quoteType').value,
  quote_received:false,budget_approved:false,resource_created:false,
  approval_signature:null,operator_evidence:null
 });
}));
$('tryProvision').addEventListener('click',()=>execute('quoteResult',()=>ledger.createPaidProject()));
$('nominate').addEventListener('click',()=>execute('roleResult',()=>{
 const a=active();
 if(!a.requester)throw Error('NO_PLATFORM_REQUESTER_FOR_SHOP');
 return ledger.nominate({
  scope:a.requester,store:a.store,role:$('role').value,
  ref:'QA_NOM_UI_'+String(REQUIRED_ROLES.indexOf($('role').value)+100)
 });
}));
$('review').addEventListener('click',()=>execute('roleResult',()=>{
 const a=active();if(!a.reviewer)throw Error('NO_INDEPENDENT_QA_REVIEWER_FOR_STORE');
 return ledger.review({scope:a.reviewer,store:a.store,role:$('role').value});
}));
$('draftApproval').addEventListener('click',()=>execute('approvalResult',()=>{
 seq++;
 return prepareSingleActionAuthorization({
  approval_id:'QA_AUTH_UI_'+String(seq).padStart(3,'0'),
  target_ref:PROJECT_REF,action:ACTION,
  requester_role:'PLATFORM_REQUESTER',
  operator_role:'BACKUP_RECOVERY_OPERATOR',
  reviewer_role:'INDEPENDENT_SECURITY_REVIEWER',
  merchant_owner_A_ref:null,merchant_owner_B_ref:null,
  provider_quote_ref:null,cost_cap_vnd:null,
  starts_at:null,expires_at:null,
  data_class:'NO_REAL_CUSTOMER_DATA',restore_target:null,
  rollback_ref:'QA_ROLLBACK_UI_001',signature:null
 });
}));
render();

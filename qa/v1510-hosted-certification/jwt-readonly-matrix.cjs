'use strict';
/** READ ONLY: signed JWT Data API observation protocol.
 * Injected synthetic callbacks in CI ARE NEVER a real hosted certification.
 * Private live transport requires independent Owner approval and real Auth /user GET.
 */
const {verifyPrivateMatrixInputs}=require('./hosted-gate.cjs');
const cases=Object.freeze([
 ['A_OWN_A','A','A',true],['B_OWN_B','B','B',true],['C_OWN_C','C','C',true],
 ['A_DENIED_B','A','B',false],['B_DENIED_A','B','A',false],['C_DENIED_A','C','A',false],
 ['A_DENIED_C','A','C',false],['B_DENIED_C','B','C',false],['C_DENIED_B','C','B',false]
]);
const blocked=reason=>Object.freeze({status:'BLOCKED',reason,certified:false,tests_run:0,no_writes:true,no_provider_sends:true});
async function runJwtReadOnlyMatrix({actors,orders,transport,preflight,proofMode='SYNTHETIC_CALLBACKS'}={}){
 if(!preflight||preflight.status!=='SCHEMA_REVIEW_ONLY_NOT_CERTIFIED')return blocked('SCHEMA_PREFLIGHT_NOT_READY');
 const invalid=verifyPrivateMatrixInputs({actors,orders});if(invalid)return blocked(invalid);
 if(!transport||typeof transport.getUser!=='function'||typeof transport.readOrder!=='function')
  return blocked('READ_ONLY_AUTH_AND_GET_TRANSPORT_REQUIRED');
 if(!['SYNTHETIC_CALLBACKS','PRIVATE_AUTH_AND_REST_GET'].includes(proofMode))return blocked('INVALID_PROOF_MODE');
 const checks=[];
 try{
  for(const label of ['A','B','C']){
   const actor=actors[label],user=await transport.getUser({token:actor.token,method:'GET',path:'/auth/v1/user'});
   const pass=user?.id===actor.expectedUserId&&user?.aud==='authenticated';
   checks.push(Object.freeze({case_id:'SIGNED_AUTH_USER_'+label,pass}));
   if(!pass)return Object.freeze({status:'BLOCKED',reason:'AUTH_USER_VERIFICATION_FAILED',checks:Object.freeze(checks),
    certified:false,no_writes:true,no_provider_sends:true});
  }
  for(const [id,actorKey,targetKey,shouldSee] of cases){
   const target=orders[targetKey];
   const rows=await transport.readOrder({token:actors[actorKey].token,method:'GET',resource:'orders',
    select:'id,tenant_id,store_id,status',filter:{id:target.order_id}});
   if(!Array.isArray(rows)||rows.length>1)throw Error('NON_CANONICAL_READ_RESULT');
   const same=rows.length===1&&rows[0].id===target.order_id&&rows[0].store_id===target.store_id&&rows[0].tenant_id===target.tenant_id;
   checks.push(Object.freeze({case_id:id,pass:shouldSee?same:rows.length===0}));
  }
 }catch{return Object.freeze({status:'BLOCKED',reason:'READ_ONLY_TRANSPORT_FAILED',checks:Object.freeze(checks),
  certified:false,no_writes:true,no_provider_sends:true});}
 const pass=checks.length===12&&checks.every(x=>x.pass===true);
 return Object.freeze({version:'V15.0-10',status:pass?'EVIDENCE_CANDIDATE_NOT_CERTIFIED':'BLOCKED',proof_mode:proofMode,
  synthetic_only:proofMode==='SYNTHETIC_CALLBACKS',checks:Object.freeze(checks),
  tests_run:checks.length,passed:checks.filter(x=>x.pass).length,certified:false,
  merchant_owner_g23_certified:false,hosted_rollback_tested:false,
  requires_independent_owner_review:true,requires_private_audit_receipt:true,
  no_writes:true,no_provider_sends:true,no_auth_changes:true,
  warning:'Synthetic callbacks cannot prove signed hosted JWT; real GET receipts require independent review.'});
}
module.exports={runJwtReadOnlyMatrix,cases};

'use strict';
/**
 * Minimal multi-turn side-effect policy table grounded in QA01..QA36.
 * It controls only DISPOSABLE sandbox writes, NEVER hosted mutations.
 * A passing policy gate is NOT a passing AI answer/actual tool execution.
 */
const blocks={
 READ_ONLY:[1,2,3,4,6,9,10,12,13,14,17,18,23,24,25,26,27,28,29,36],
 ONE_SANDBOX_WRITE:[5,7,8,11,15,16,19,20,21,22,30,35],
 CONDITIONAL_LITERAL_OR_REJECT:[31,32],
 FAULT_DETECTION:[33,34]
};
const POLICY=Object.freeze(Object.fromEntries(Object.entries(blocks).flatMap(
 ([className,ids])=>ids.map(n=>['QA'+String(n).padStart(2,'0'),
   Object.freeze({className,
     maxDisposableCommittedWrites:className==='READ_ONLY'?0:1,
     requiresIndependentCommitEvidence:className!=='READ_ONLY',
     nativeProviderSendsAllowed:false,hostedWritesAllowed:false})]))));
function denied(reason){return Object.freeze({status:'BLOCKED',reason,
  noSend:true,hostedWritesAllowed:false,AIQualityCertified:false});}
function checkMultiCaseSandbox(caseId,evidence){
 if(!Object.hasOwn(POLICY,caseId))return denied('UNKNOWN_MULTI_CASE');
 const p=POLICY[caseId];
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||
    evidence.origin!=='DISPOSABLE_QA_ONLY'||evidence.externalSends!==0||
    evidence.hostedWrites!==0||evidence.hostedReads!==0||
    evidence.otherStoreAccess!==false||
    !Number.isSafeInteger(evidence.committedQaWrites)||
    evidence.committedQaWrites<0||evidence.committedQaWrites>p.maxDisposableCommittedWrites)
   return denied('INVALID_OR_UNSAFE_SIDE_EFFECT_TRACE');
 if(evidence.committedQaWrites>0&&evidence.independentCommitProof!==true)
   return denied('MISSING_DISPOSABLE_COMMIT_EVIDENCE');
 if(p.className==='FAULT_DETECTION'&&evidence.botClaimedSuccess===true)
   return denied('FAULT_INJECTION_FALSE_SUCCESS');
 if(p.className==='CONDITIONAL_LITERAL_OR_REJECT'&&evidence.committedQaWrites>0&&
    evidence.literalTextPreserved!==true)
   return denied('FORMULA_INJECTION_NOT_NEUTRALIZED');
 return Object.freeze({status:'SANDBOX_SIDE_EFFECTS_WITHIN_POLICY_NOT_MODEL_PASS',
    caseId,policy:p.className,observedQaWrites:evidence.committedQaWrites,
    independentModelOutputReviewed:false,AIQualityCertified:false,
    nativeProviderSendsAllowed:false,hostedWritesAllowed:false});
}
module.exports={POLICY,checkMultiCaseSandbox};

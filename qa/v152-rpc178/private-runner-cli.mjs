#!/usr/bin/env node
/** RPC17.8 optional PRIVATE workstation diagnostic; NEVER run inside shared GitHub Actions.
 * This script never saves or prints JWTs and never performs a write request.
 * Environment variables must be loaded by an independently approved private secret broker,
 * never pasted in shell history, GitHub issue/PR, ChatGPT, CI secrets or logs.
 */
import {evaluatePrivateReadOnlyUat} from './private-readonly-uat.mjs';

if(process.env.RPC178_LOCAL_READ_ONLY_DIAGNOSTIC!=='DISPOSABLE_DIAGNOSTIC_ONLY'){
 console.log(JSON.stringify({status:'BLOCKED',reason:'PRIVATE_DIAGNOSTIC_NOT_ADMITTED'}));
 process.exitCode=2;
}else{
 let fixture;
 try{fixture=JSON.parse(process.env.RPC178_PRIVATE_FIXTURE_JSON||'null');}
 catch{fixture=null;}
 const result=await evaluatePrivateReadOnlyUat({
   fetchImpl:fetch,
   apiBase:'https://ifxlvrhyjhbzbrkdsida.supabase.co/',
   publishableKey:process.env.RPC178_SUPABASE_PUBLISHABLE_KEY,
   tokenA:process.env.RPC178_PRIVATE_JWT_A,
   tokenB:process.env.RPC178_PRIVATE_JWT_B,
   fixture,
   operatorGate:{
     explicitPrivateNoSendMode:'DISPOSABLE_DIAGNOSTIC_ONLY',
     // This is only a diagnostic switch, NOT real independent authorization.
     independentApprovalReceiptPresent:process.env.RPC178_OPERATOR_APPROVAL_LOCALLY_VERIFIED==='yes'
   }
 });
 // Result is enumerated statuses, no token/email/order/customer/raw response values.
 console.log(JSON.stringify(result));
 if(result.status!=='DIAGNOSTIC_PASSED_HUMAN_REVIEW_REQUIRED')process.exitCode=2;
}

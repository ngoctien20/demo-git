#!/usr/bin/env node
'use strict';
// PRIVATE stdin-only structural review. No signer enrollment or live grants.
const fs=require('node:fs');
const {inspectPhaseApproval}=require('./scoped-hosted-approval-packet.cjs');
if(process.argv.length!==2){
 console.error('RPC11_PHASE_PACKET_STDIN_ONLY');process.exitCode=2;
}else{
 try{
  const s=fs.readFileSync(0,'utf8');
  if(s.length>128000)throw Error('TOO_LARGE');
  const packet=JSON.parse(s);
  const r=inspectPhaseApproval({packet});
  process.stdout.write(JSON.stringify(r,null,2)+'\n');
  if(r.status!=='STRUCTURAL_PACKET_READY_FOR_PRIVATE_ORIGINAL_EVIDENCE_REVIEW')
   process.exitCode=3;
 }catch(_e){
  console.error('RPC11_PRIVATE_PHASE_PACKET_INVALID_KEEP_CONTENT_LOCAL');
  process.exitCode=2;
 }
}

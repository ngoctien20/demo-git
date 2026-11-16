#!/usr/bin/env node
'use strict';
/*
 * RPC.11 — private operator only. Input contains protected four-row UUIDs
 * and source digests, so pipe it from a local private file via STDIN.
 * Nothing is logged except non-identifying counts and blocker codes.
 */
const fs=require('node:fs');
const {reconcilePrivateRows}=require('./private-fourrow-current-snapshot-reconcile.cjs');
if(process.argv.length!==2){
 console.error('RPC11_PRIVATE_STDIN_ONLY');process.exitCode=2;
}else{
 try{
  const input=fs.readFileSync(0,'utf8');
  if(input.length>256000)throw Error('TOO_LARGE');
  const report=reconcilePrivateRows(JSON.parse(input));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.status!=='STRUCTURAL_ROW_JOIN_READY_FOR_EXTERNAL_PRIMARY_SOURCE_REVIEW')
   process.exitCode=3;
 }catch(_err){
  console.error('RPC11_PRIVATE_EVIDENCE_INVALID_KEEP_RAW_DATA_LOCAL');
  process.exitCode=2;
 }
}

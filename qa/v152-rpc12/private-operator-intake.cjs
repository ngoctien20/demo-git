#!/usr/bin/env node
'use strict';
/*
 * RPC.12 PRIVATE OPERATOR DEVICE ONLY.
 * Accept private JSON via ABSOLUTE LOCAL FILE PATHS, never by flags/stdout.
 * No network, DB client, child process, backup, SQL or hosted action.
 * Only emits status and generic blocker codes. No row IDs or file paths.
 */
const fs=require('node:fs');
const path=require('node:path');
const {reconcilePrivateRows}=require('../v152-rpc11/private-fourrow-current-snapshot-reconcile.cjs');
const {reviewRecoveryScope}=require('./current-recovery-scope-decision.cjs');
const {inspectPhaseApproval}=require('../v152-rpc11/scoped-hosted-approval-packet.cjs');
const CONTRACT='T404_RPC12_PRIVATE_OPERATOR_INTAKE_SUMMARY_V1';
function reviewIntake({snapshot,ownerLedger,recoveryDecision,phasePacket,now=Date.now()}={}){
 const recovery=reviewRecoveryScope(recoveryDecision||{});
 const rows=snapshot&&ownerLedger?
  reconcilePrivateRows({snapshot,ownerLedger,now}):null;
 const phase=phasePacket?inspectPhaseApproval({packet:phasePacket,now}):null;
 const blockers=[];
 if(!rows)blockers.push('FOUR_ROW_PRIVATE_SNAPSHOT_AND_OWNER_LEDGER_NOT_SUPPLIED');
 else if(rows.status!=='STRUCTURAL_ROW_JOIN_READY_FOR_EXTERNAL_PRIMARY_SOURCE_REVIEW')
  blockers.push('FOUR_ROW_LEDGER_STRUCTURAL_MISMATCH');
 if(recovery.status!=='CLAIMED_CURRENT_RECOVERY_PACKET_REQUIRES_EXTERNAL_VERIFICATION')
  blockers.push('CURRENT_INDEPENDENT_RECOVERY_NOT_CERTIFIED');
 if(!phase||phase.phase!=='M1_SCHEMA_ONLY')
  blockers.push('EXACT_M1_PRIVATE_PHASE_PACKET_NOT_SUPPLIED');
 else if(phase.status!=='STRUCTURAL_PACKET_READY_FOR_PRIVATE_ORIGINAL_EVIDENCE_REVIEW')
  blockers.push('M1_PHASE_PACKET_FORMAT_NOT_READY');
 // Even when no blockers, NONE of the original evidence is independently
 // authenticated here. Never authorize actual M0/M1 from self-report.
 return Object.freeze({
  contract:CONTRACT,
  status:blockers.length?'RPC12_PRIVATE_OPERATOR_EVIDENCE_INTAKE_INCOMPLETE':
   'RPC12_PRIVATE_PACKETS_STRUCTURALLY_READY_FOR_EXTERNAL_REVIEW',
  blockers:Object.freeze(blockers),
  ownerLedgerStatus:rows?rows.status:'NOT_PROVIDED',
  ownerStructuralMatches:rows?rows.matchedSnapshotAndLedgerRows:0,
  recoverySelectionStatus:recovery.status,
  recoveryScope:recovery.scope,
  m1PrivatePacketStatus:phase?phase.status:'NOT_PROVIDED',
  historicH11rPartialApplicationQaAccepted:true,
  primarySourceAndSignersIndependentlyVerified:false,
  currentRealRestoreIndependentlyCertified:false,
  scopedM1AuthorityCryptographicallyVerified:false,
  canApplyM1:false,canApplyM2M4:false,canApplyM3:false,
  canExportBackup:false,canRevokeLegacyRpc:false,
  sensitiveRowsOrIdentifiersReturned:false,
  hostedRowsChanged:0
 });
}
function safeRead(file){
 if(typeof file!=='string'||!path.isAbsolute(file))throw Error('PRIVATE_PATH_ABSOLUTE_REQUIRED');
 const abs=path.resolve(file);
 const repository=path.resolve(__dirname,'../..');
 if(abs===repository||abs.startsWith(repository+path.sep))
  throw Error('PRIVATE_EVIDENCE_MUST_BE_OUTSIDE_REPOSITORY');
 const stat=fs.lstatSync(abs);
 if(stat.isSymbolicLink()||!stat.isFile()||stat.size>262144||stat.size<2)
  throw Error('PRIVATE_FILE_TYPE_OR_SIZE_INVALID');
 return JSON.parse(fs.readFileSync(abs,'utf8'));
}
function localMain(argv){
 try{
  const args={};
  if(argv.length%2!==0)throw Error('ARGUMENTS_INVALID');
  for(let i=0;i<argv.length;i+=2){
   const flag=argv[i],file=argv[i+1];
   if(!['--recovery','--snapshot','--ledger','--phase'].includes(flag)||
      Object.hasOwn(args,flag))throw Error('ARGUMENTS_INVALID');
   args[flag]=file;
  }
  if(!args['--recovery']||
     Boolean(args['--snapshot'])!==Boolean(args['--ledger']))
   throw Error('REQUIRED_PRIVATE_PATHS_MISSING');
  const evidence={
   recoveryDecision:safeRead(args['--recovery']),
   snapshot:args['--snapshot']?safeRead(args['--snapshot']):undefined,
   ownerLedger:args['--ledger']?safeRead(args['--ledger']):undefined,
   phasePacket:args['--phase']?safeRead(args['--phase']):undefined
  };
  const result=reviewIntake(evidence);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  return result.status==='RPC12_PRIVATE_PACKETS_STRUCTURALLY_READY_FOR_EXTERNAL_REVIEW'?0:3;
 }catch(_err){
  // Error messages/paths/raw packets must NEVER appear in GitHub logs
  // or user-visible stdout. Keep exact reasons in private investigation.
  process.stderr.write('RPC12_LOCAL_PRIVATE_INPUT_REJECTED_KEEP_FILES_PRIVATE\n');
  return 2;
 }
}
if(require.main===module)process.exitCode=localMain(process.argv.slice(2));
module.exports=Object.freeze({CONTRACT,reviewIntake,localMain});

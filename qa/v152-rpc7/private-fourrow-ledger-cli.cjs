#!/usr/bin/env node
'use strict';
/*
 * TIEN404 RPC.7: local-only four-row private ledger lint.
 * Accepts private ledger over stdin; nothing is persisted, transmitted,
 * returned or logged from its row/tenant/actor IDs. Reuses V14.4.3 linter.
 * A READY status means schema-review only, NOT proof of actual ownership.
 */
const fs=require('node:fs');
const baseline=require('../v152-rpc6/hosted-fourrow-recovery-baseline.json');
const {reviewPrivateFourRow}=require('../v152-rpc6/fourrow-recovery-migration-gate.cjs');
if(process.argv.length!==2){
 console.error('RPC7_PRIVATE_LEDGER_STDIN_ONLY');process.exit(2);
}
try{
 const input=fs.readFileSync(0,'utf8');
 if(input.length>128000)throw Error('TOO_LARGE');
 const privatePacket=JSON.parse(input);
 const out=reviewPrivateFourRow({snapshot:baseline,privatePacket});
 process.stdout.write(JSON.stringify({
  contract:out.contract,status:out.status,blockers:out.blockers,
  validatedShapeCount:out.validatedShapeCount,
  realOwnerProofCertified:false,actualStoreMappingVerified:false,
  privateRowsOrIdentifiersReturned:false,
  hostedBackfillAuthorized:false,migrationM1Authorized:false
 },null,2)+'\n');
}catch(_e){
 console.error('RPC7_PRIVATE_LEDGER_INVALID_KEEP_DATA_LOCAL');
 process.exitCode=2;
}

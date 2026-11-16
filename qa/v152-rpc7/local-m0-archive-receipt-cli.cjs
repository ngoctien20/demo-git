#!/usr/bin/env node
'use strict';
/* Receives only redacted local hash, size and classifier JSON via stdin.
 * AVOID raw archive, TOC, paths, JWTs, emails or customer IDs in input. */
const fs=require('node:fs');
const {assessLocalArchiveReceipt}=require('./local-m0-archive-receipt.cjs');
if(process.argv.length!==2){
 console.error('RPC7_RECEIPT_STDIN_ONLY');process.exit(2);
}
try{
 const s=fs.readFileSync(0,'utf8');
 if(s.length>32768)throw Error('RPC7_LOCAL_RECEIPT_TOO_LARGE');
 const receipt=assessLocalArchiveReceipt(JSON.parse(s));
 process.stdout.write(JSON.stringify(receipt,null,2)+'\n');
}catch(e){
 console.error(e?.code||'RPC7_LOCAL_RECEIPT_INVALID');
 process.exitCode=2;
}

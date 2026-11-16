#!/usr/bin/env node
'use strict';
// READ-ONLY local operator tool. Run on a trusted computer, pass the
// pg_restore --list text via STDIN. Never upload archive/TOC to GitHub.
const fs=require('node:fs');
const {inspectArchiveToc}=require('./local-archive-coverage.cjs');
if(process.argv.length>2){
 console.error('RPC7_STDIN_ONLY_NO_FILE_PATHS_OR_HOSTED_CONNECTIONS');
 process.exit(2);
}
let toc='';
try{toc=fs.readFileSync(0,'utf8');}catch(_e){
 console.error('RPC7_LOCAL_PG_RESTORE_LIST_NOT_PROVIDED');process.exit(2);
}
const x=inspectArchiveToc(toc);
console.log(JSON.stringify({
 classification:x.status,
 tableDataCoverage:x.coverage,
 tableDataPresenceOnly:x.tableDataPresenceOnly??false,
 completeRestoreProven:false,realBackupVerified:false,
 independentlyApproved:false,migrationAuthorized:false
},null,2));
if(x.status==='INVALID_OR_EMPTY_TOC'||x.status==='NO_PG_RESTORE_TOC_ENTRIES')
 process.exitCode=2;

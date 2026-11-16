'use strict';
/*
 * RPC.7: OFFLINE pg_restore --list COVERAGE REVIEW.
 * Processes only a text table-of-contents listing from existing local
 * archive; does NOT open a database, parse row content, export backups,
 * restore, verify real source consistency or attest ownership.
 * Output: grouped coverage booleans, not original lines/path/IDs.
 */
const CONTRACT='T404_RPC7_LOCAL_ARCHIVE_COVERAGE_V1';
const REQUIRED=Object.freeze({
 application:Object.freeze(['public.tenants','public.tenant_memberships',
  'public.products','public.orders','public.customers']),
 auth:Object.freeze(['auth.users','auth.identities','auth.sessions']),
 storage:Object.freeze(['storage.objects','storage.buckets'])
});
const schemaTable=x=>/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(x);
function inspectArchiveToc(toc){
 if(typeof toc!=='string'||toc.length===0||toc.length>5000000)
  return Object.freeze({contract:CONTRACT,status:'INVALID_OR_EMPTY_TOC',
   coverage:Object.freeze({}),completeRestoreProven:false,
   backupExportAuthorized:false,archiveContentsRead:false});
 const data=new Set(),defs=new Set();let entries=0;
 for(const line of toc.split(/\r?\n/)){
  if(!/^\s*\d+;\s+\d+\s+\d+\s+/.test(line))continue;
  entries++;
  // TOC lines of format "435; 0 16533 TABLE DATA public.orders postgres"
  let m=line.match(/^\s*\d+;\s+\d+\s+\d+\s+TABLE DATA\s+(\S+)\s+(\S+)(?:\s|$)/);
  if(m){const k=m[1]+'.'+m[2];if(schemaTable(k))data.add(k);continue;}
  m=line.match(/^\s*\d+;\s+\d+\s+\d+\s+TABLE\s+(\S+)\s+(\S+)(?:\s|$)/);
  if(m){const k=m[1]+'.'+m[2];if(schemaTable(k))defs.add(k);}
 }
 const coverage={};
 for(const [group,tables] of Object.entries(REQUIRED)){
  coverage[group]=Object.freeze({
   expected:tables.length,
   schemaEntriesPresent:tables.filter(t=>defs.has(t)).length,
   tableDataEntriesPresent:tables.filter(t=>data.has(t)).length,
   includesAllTableDataEntries:tables.every(t=>data.has(t))
  });
 }
 const app=coverage.application.includesAllTableDataEntries;
 const auth=coverage.auth.includesAllTableDataEntries;
 const storage=coverage.storage.includesAllTableDataEntries;
 let status;
 if(entries===0)status='NO_PG_RESTORE_TOC_ENTRIES';
 else if(!app)status='APP_RECOVERY_COVERAGE_INCOMPLETE';
 else if(!auth||!storage)status='PARTIAL_APP_ARCHIVE_NOT_FULL_SERVICE_RECOVERY';
 else status='STRUCTURAL_TOC_COVERAGE_CANDIDATE_UNVERIFIED';
 return Object.freeze({contract:CONTRACT,status,
  coverage:Object.freeze(coverage),tocEntriesInspected:entries,
  tableDataPresenceOnly:true,actualDataRowsRestored:0,
  oldArchiveFreshnessVerified:false,sourceProjectVerified:false,
  realPgRestoreSuccessVerified:false,realRestoreIsolationVerified:false,
  customerDataInspected:false,archiveContentsRead:false,
  independentlyApprovedArchive:false,backupExportAuthorized:false,
  completeRestoreProven:false,canAuthorizeM1:false});
}
module.exports=Object.freeze({CONTRACT,REQUIRED,inspectArchiveToc});

// RPC10.1 — GitHub Actions integrity regression, offline only.
// No subprocess, network, database or provider API. Checks shape of the exact
// source that caused a zero-job failure due to duplicate jobs and broken run:.
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const PATH='.github/workflows/v152-rpc10-six-surface-nohost.yml';
const EXPECT=['rpc10-offline-gate','rpc10-disposable-pg17','rpc10-concurrent-reader-blackout'];
const exactCount=(str,fragment)=>str.split(fragment).length-1;
export function verifyWorkflowIntegrity(s){
 const faults=[];
 const jobs=[...s.matchAll(/^  (rpc10-[a-z0-9-]+):\s*$/gm)].map(m=>m[1]);
 if(JSON.stringify(jobs)!==JSON.stringify(EXPECT))faults.push('JOB_IDS_MISSING_DUPLICATED_OR_REORDERED');
 if(!s.includes('on:\n  pull_request:')||!s.includes('  workflow_dispatch:')||
    !s.includes('permissions:\n  contents: read'))faults.push('WORKFLOW_TRIGGER_OR_PERMISSIONS_CHANGED');
 for (const x of [
  'BEGIN\\s+TRANSACTION\\s+READ\\s+ONLY',
  "assert re.search(r'COMMIT\\s*;\\s*$',no_comments,re.I)",
  'originalMerchantEvidenceAuthenticatedHere:false',
  "RPC10_DISPOSABLE_ONLY",
  "RPC10_CONCURRENT_DISPOSABLE_ONLY",
  "t404_rpc8_ci",
  'PUBLISHED_COMMERCE_STORE_CUTOVER_NO_GO',
  'HOSTED_ORIGINAL_STORE_OWNER_NO_GO'
 ])if(!s.includes(x))faults.push('SECURITY_GATE_MISSING:'+x);
 for (const [opening,closing,n] of [
  ["python3 - <<'PY'","\n          PY",4],
  ["node - <<'NODE'","\n          NODE",3]
 ])if(exactCount(s,opening)!==n||exactCount(s,closing)!==n)faults.push('HERE_DOC_IMBALANCE:'+opening);
 if(exactCount(s,'bash qa/v152-rpc10/ci-pg17-six-surface-rehearsal.sh')!==1 ||
    exactCount(s,'bash qa/v152-rpc10/ci-pg17-concurrent-reader-blackout.sh')!==1)
    faults.push('DUPLICATED_OR_REMOVED_PG17_EXECUTION');
 if(/^\s*,no_comments,re\.I\)/m.test(s)||/assert re\.search\(r'COMMIT\\s\*;\\s\*\s*\n\s*run: \|/m.test(s))
    faults.push('BROKEN_SQL_ASSERTION_OR_ORPHAN_YAML_BLOCK');
 const lines=s.split('\n');
 for(let i=0;i<lines.length;i++){
  if(!/<<'(?<tag>PY|NODE)'/.test(lines[i]))continue;
  const tag=lines[i].match(/<<'(PY|NODE)'/)[1];
  const indentation=lines[i].match(/^\s*/)[0].length;
  let found=false;
  for(let j=i+1;j<lines.length;j++){
   const line=lines[j];
   if(line.trim()===tag && line.match(/^\s*/)[0].length===indentation){found=true;break;}
   if(line.trim() && line.match(/^\s*/)[0].length<indentation){
    faults.push('HERE_DOC_ESCAPES_RUN_BLOCK_LINE_'+(i+1));break;
   }
  }
  if(!found)faults.push('UNTERMINATED_HEREDOC_LINE_'+(i+1));
 }
 return {valid:faults.length===0,faults};
}

test('repaired workflow has exactly three original jobs and all protective gates',()=>{
 const s=readFileSync(PATH,'utf8');
 const result=verifyWorkflowIntegrity(s);
 assert.deepEqual(result.faults,[]);
});
test('detector rejects repeated PG17 job block',()=>{
 const s=readFileSync(PATH,'utf8');
 const mod=s+'\n  rpc10-disposable-pg17:\n    runs-on: ubuntu-24.04\n';
 assert.equal(verifyWorkflowIntegrity(mod).valid,false);
});
test('detector rejects truncated SQL COMMIT Python assertion',()=>{
 const s=readFileSync(PATH,'utf8');
 const broken=s.replace("assert re.search(r'COMMIT\\s*;\\s*$',no_comments,re.I)", "assert re.search(r'COMMIT\\s*;\\s*\n        run: |");
 assert.equal(verifyWorkflowIntegrity(broken).valid,false);
});
test('detector rejects removal of hosted NO-GO',()=>{
 const s=readFileSync(PATH,'utf8');
 const mod=s.replaceAll('RPC10_DISPOSABLE_ONLY','UNSAFE_MIGRATION');
 assert.equal(verifyWorkflowIntegrity(mod).valid,false);
});

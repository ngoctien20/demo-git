'use strict';
/*
 * Read-only P0 release decision report.
 *   node qa/v152-pre6c-security/p0-release-gate-cli.cjs --report
 *   node qa/v152-pre6c-security/p0-release-gate-cli.cjs --require-release
 *
 * It never reads secrets, calls APIs, or performs any rollout. The --require
 * flag intentionally always exits non-zero: no independent signed controller
 * approval or production CD enforcement has been integrated in this Draft.
 */
const baseline=require('./p0-release-baseline.readonly.json');
const {evaluateRelease,assertReleaseAllowed}=require('./p0-release-gate.cjs');
const args=process.argv.slice(2);
if(args.length!==1||!['--report','--require-release'].includes(args[0])){
  process.stderr.write('Usage: --report | --require-release\n');
  process.exitCode=2;
}else{
  const outcome=evaluateRelease(baseline);
  process.stdout.write(JSON.stringify({
    contract:outcome.contract,
    result:outcome.status,
    gateCount:outcome.gates.length,
    blocked:outcome.gates.filter(g=>g.status==='BLOCKED')
      .map(g=>({code:g.code,reasons:g.blockers})),
    p1Open:outcome.p1Open,
    releaseAuthorized:outcome.releaseAuthorized,
    reason:outcome.reason
  },null,2)+'\n');
  if(args[0]==='--require-release'){
    try{assertReleaseAllowed();}catch(e){
      process.stderr.write(e.code+'\n');
      process.exitCode=3;
    }
  }
}
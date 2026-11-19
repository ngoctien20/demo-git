'use strict';
/* V18.6.16: Windows-only offline smoke. Fake CLI project marker, no Supabase connection. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const kit = require('./owner-linked-export.cjs');
if (process.platform !== 'win32' || process.env.GITHUB_ACTIONS !== 'true') {
  throw Error('WINDOWS_CI_ONLY_NO_LIVE_EXPORT');
}
const base=fs.mkdtempSync(path.join(os.homedir(),'t404-v18616-win-smoke-'));
try {
  const project=path.join(base,'linked-project');
  const output=path.join(base,'private-backup');
  fs.mkdirSync(path.join(project,'supabase','.temp'),{recursive:true});
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(project,'supabase','config.toml'),'project_id = "offline-only"\n');
  fs.writeFileSync(path.join(project,'supabase','.temp','project-ref'),kit.EXPECTED_REF+'\n');
  // Only invoke the offline validation function, with explicit synthetic environment.
  const preflight=kit.preflight({projectRoot:project,outputDir:output},{env:{}});
  assert.equal(preflight.linkedCorrect,true);
  assert.equal(fs.readdirSync(output).length,0);
  // Actual entrypoint, including --execute, MUST fail closed under CI.
  for (const extra of [[],['--execute']]) {
    const run=cp.spawnSync(process.execPath,[path.join(__dirname,'owner-linked-export.cjs'),
      '--project-root',project,'--output-dir',output,...extra],
      {encoding:'utf8',shell:false,timeout:10000,env:{...process.env,CI:'true',GITHUB_ACTIONS:'true'}});
    assert.equal(run.status,2,'CI invocation must be refused');
    assert.match(run.stderr,/EXPORT_NO_GO:CI_EXPORT_FORBIDDEN/);
    assert.equal(fs.readdirSync(output).length,0);
  }
  console.log(JSON.stringify({status:'WINDOWS_OFFLINE_PREFLIGHT_PASS',
    noSupabaseNetwork:true,privateExportExecuted:false,realBackupDone:false,
    realRestoreDone:false,productionReady:false}));
} finally {fs.rmSync(base,{recursive:true,force:true});}

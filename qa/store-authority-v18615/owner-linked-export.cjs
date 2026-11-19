'use strict';
/* TIEN404 V18.6.15 — owner-operated linked CLI export.
 * No live connection at import, during preflight, or without explicit console confirmation.
 * This program must never be used from CI. It never restores, deploys or writes to Supabase.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const EXPECTED_REF = 'ifxlvrhyjhbzbrkdsida'; // project ID is not a credential
const ACK = 'TIEN404_APPROVE_PRIVATE_EXPORT_STAGING_ONLY';
const DUMP_FILES = Object.freeze(['roles.sql', 'schema.sql', 'data.sql']);
// Block common cloud-sync, downloads, temporary and OS-managed locations; these names
// are only a conservative screen, not proof of drive encryption or no sync agents.
const BLOCKED_SEGMENT = /^(?:onedrive(?:[- _].*)?|dropbox(?:[- _].*)?|google ?drive(?:[- _].*)?|icloud ?drive(?:[- _].*)?|appdata|programdata|downloads|windows|system32|temp|tmp|\.git|node_modules)$/i;
function isWithin(child,parent,platform=process.platform) {
  const platformPath=platform==='win32'?path.win32:path;
  const normalize=x=>{const v=platformPath.normalize(x);return platform==='win32'?v.toLowerCase():v;};
  const a=normalize(child),b=normalize(parent);
  return a===b || a.startsWith(b.endsWith(platformPath.sep)?b:b+platformPath.sep);
}
function blockedPathSegment(target) {
  // Split only canonical resolved paths; never assume a clear-looking alias is safe.
  return target.split(/[\\/]+/).some(part=>BLOCKED_SEGMENT.test(part));
}
function isGitCheckoutOrWorktree(target,fsApi=fs) {
  let current=target;
  while(true){
    // Handles a normal checkout (.git folder) and Git worktrees (.git file).
    if(fsApi.existsSync(path.join(current,'.git')))return true;
    const parent=path.dirname(current);
    if(parent===current)return false;
    current=parent;
  }
}

function parseArgs(args) {
  const out = { execute: false, help: false };
  for (let i=0;i<args.length;i++) {
    const key=args[i];
    if (key==='--execute') { out.execute=true; continue; }
    if (key==='--help') { out.help=true; continue; }
    if (key==='--project-root'||key==='--output-dir') {
      if (!args[i+1] || args[i+1].startsWith('--')) throw Error('MISSING_PATH_ARGUMENT');
      out[key==='--project-root'?'projectRoot':'outputDir']=args[++i]; continue;
    }
    throw Error('UNKNOWN_ARGUMENT');
  }
  return out;
}
function preflight(opts,{fsApi=fs, env=process.env}={}) {
  if (!opts || !opts.projectRoot || !opts.outputDir) throw Error('PROJECT_ROOT_AND_OUTPUT_REQUIRED');
  if (!path.isAbsolute(opts.projectRoot)||!path.isAbsolute(opts.outputDir)) throw Error('ABSOLUTE_PATHS_REQUIRED');
  // Refuse symlink/junction on the selected destination to reduce swap/redirect risk.
  if(fsApi.lstatSync(opts.outputDir).isSymbolicLink())throw Error('OUTPUT_LINK_NOT_ALLOWED');
  const project=fsApi.realpathSync(opts.projectRoot), output=fsApi.realpathSync(opts.outputDir);
  if (isWithin(output,project)||isWithin(project,output)) throw Error('EXPORT_MUST_BE_OUTSIDE_PROJECT');
  if (blockedPathSegment(output)) throw Error('SYNC_OR_SYSTEM_FOLDER_FORBIDDEN');
  if (output===path.parse(output).root)throw Error('VOLUME_ROOT_EXPORT_FORBIDDEN');
  if (isGitCheckoutOrWorktree(output,fsApi))throw Error('GIT_CHECKOUT_FORBIDDEN');
  if (!fsApi.statSync(project).isDirectory()||!fsApi.statSync(output).isDirectory())throw Error('NOT_DIRECTORIES');
  const marker=path.join(project,'supabase','.temp','project-ref');
  if (!fsApi.existsSync(path.join(project,'supabase','config.toml')))throw Error('SUPABASE_LOCAL_CONFIG_NOT_FOUND');
  if (!fsApi.existsSync(marker))throw Error('LINKED_PROJECT_MARKER_NOT_FOUND');
  const linked=fsApi.readFileSync(marker,'utf8').trim();
  if (linked!==EXPECTED_REF)throw Error('WRONG_LINKED_PROJECT');
  if (fsApi.readdirSync(output).length!==0) throw Error('OUTPUT_MUST_BE_EMPTY_NO_OVERWRITE');
  if (env.CI || env.GITHUB_ACTIONS || env.T404_V18615_TEST_MODE==='true') throw Error('CI_EXPORT_FORBIDDEN');
  if (env.SUPABASE_DB_PASSWORD || env.DATABASE_URL || env.PGPASSWORD) throw Error('SECRET_ENV_VARIABLES_NOT_ALLOWED_IN_EXPORT_RUN');
  return {project,output,linkedCorrect:true};
}
function dumpCommands(output) {
  return Object.freeze([
    ['db','dump','--linked','-f',path.join(output,DUMP_FILES[0]),'--role-only'],
    ['db','dump','--linked','-f',path.join(output,DUMP_FILES[1])],
    ['db','dump','--linked','-f',path.join(output,DUMP_FILES[2]),'--use-copy','--data-only','-x','storage.buckets_vectors','-x','storage.vector_indexes']
  ]);
}
function sha256(file,fsApi=fs) {
  // Constant-memory SHA256: avoid fs.readFileSync for GB-scale SQL backups.
  const hash=crypto.createHash('sha256'),chunk=Buffer.allocUnsafe(1024*1024);
  const fd=fsApi.openSync(file,fs.constants.O_RDONLY);
  try{
    while(true){const n=fsApi.readSync(fd,chunk,0,chunk.length,null);if(n===0)break;hash.update(chunk.subarray(0,n));}
  } finally {fsApi.closeSync(fd);}
  return hash.digest('hex');
}
function verifyOutputs(output,fsApi=fs) {
  return DUMP_FILES.map(name=>{
    const file=path.join(output,name);
    if (!fsApi.existsSync(file))throw Error('DUMP_FILE_MISSING');
    const st=fsApi.lstatSync(file);
    if (!st.isFile()||st.isSymbolicLink()||st.size===0)throw Error('DUMP_FILE_INVALID');
    return {name,bytes:st.size,sha256:sha256(file,fsApi)};
  });
}
function publicResult(results) {return {version:'V18.6.15',kind:'PRIVATE_EXPORT_METADATA_ONLY',projectRef:EXPECTED_REF,files:results,liveBackupVerified:false,isolatedRestoreVerified:false,productionReady:false,warning:'DB_DUMP_EXCLUDES_SUPABASE_MANAGED_AUTH_STORAGE_SCHEMAS_AND_STORAGE_OBJECT_BYTES'};}
function commandSafety(args) {
  if (!Array.isArray(args) || args[0]!=='db' || args[1]!=='dump'||!args.includes('--linked')||args.includes('--db-url'))throw Error('DUMP_ONLY_LINKED_CLI');
  if (args.some(x=>/^(db push|db reset|migration|restore|apply|deploy)$/i.test(x)))throw Error('MUTATING_CLI_TOKEN');
  if (args.some(x=>x.includes('postgresql://')||x.includes('supabase.co')))throw Error('CREDENTIAL_OR_URL_ARGUMENT_FORBIDDEN');
  return true;
}
async function main(argv=process.argv.slice(2),deps={}) {
  let options;
  try {options=parseArgs(argv);} catch(e){ console.error('EXPORT_NO_GO:',e.message);return 2; }
  if(options.help){console.log('Usage: node owner-linked-export.cjs --project-root <absolute-linked-CLI-project> --output-dir <absolute-empty-private-folder> [--execute]');return 0;}
  let conf;
  try {conf=preflight(options); }catch(e){console.error('EXPORT_NO_GO:',e.message);return 2;}
  if (!options.execute) {console.log(JSON.stringify({status:'PREFLIGHT_ONLY_PASS',correctLinkedRef:true,exportExecuted:false,restoreExecuted:false,productionReady:false}));return 0;}
  if (!process.stdin.isTTY || !process.stdout.isTTY){console.error('EXPORT_NO_GO:INTERACTIVE_TERMINAL_REQUIRED');return 2;}
  console.log('PRIVATE STAGING EXPORT ONLY. Exported SQL may contain PII, credentials or secrets.');
  console.log('Proceed ONLY if the destination drive is encrypted and you have explicitly approved B-00 export.');
  const rl=(deps.createInterface||readline.createInterface)({input:stdin,output:stdout});let a;
  try{a=await rl.question('Type the exact approval phrase to export: ');}finally{rl.close();}
  if(a.trim()!==ACK){console.error('EXPORT_NO_GO:APPROVAL_NOT_GIVEN');return 2;}
  // Last recheck of current linked project and empty destination, after approval.
  try{conf=preflight(options);}catch(e){console.error('EXPORT_NO_GO:',e.message);return 2;}
  const commands=dumpCommands(conf.output);
  for(const args of commands){
    commandSafety(args);
    const run=(deps.spawnSync||cp.spawnSync)('supabase',args,{cwd:conf.project,encoding:'utf8',shell:false,timeout:600000,stdio:['ignore','pipe','pipe'],windowsHide:true});
    // No stdout/stderr printed: may contain client configuration or credentials.
    if(run.error||run.status!==0){console.error('EXPORT_NO_GO:DUMP_FAILED_PARTIAL_FILES_MUST_BE_REVIEWED_PRIVATELY');return 1;}
  }
  let results;try{results=verifyOutputs(conf.output);}catch(e){console.error('EXPORT_NO_GO:'+e.message);return 1;}
  const report=publicResult(results);
  // Manifest is local, outside Git. No source URL, password or customer records are written.
  const dest=path.join(conf.output,'backup-manifest.json');
  fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PRIVATE_EXPORT_CREATED_NOT_RESTORED',files:results.map(({name,bytes})=>({name,bytes})),manifestLocalOnly:true,backupRecoveryApproved:false,productionReady:false}));
  return 0;
}
if(require.main===module)main().then(c=>{process.exitCode=c}).catch(()=>{console.error('EXPORT_NO_GO:UNEXPECTED_ERROR');process.exitCode=2;});
module.exports={EXPECTED_REF,ACK,DUMP_FILES,parseArgs,preflight,dumpCommands,verifyOutputs,publicResult,commandSafety,main,isWithin,isGitCheckoutOrWorktree,blockedPathSegment};

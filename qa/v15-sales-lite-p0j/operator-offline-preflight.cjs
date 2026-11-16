'use strict';
/**
 * TIEN404 V15 P0-J — PRIVATE OPERATOR WORKSTATION PREFLIGHT (OFFLINE).
 *
 * The operator runs this on their OWN machine; never in GitHub Actions with a
 * real backup. This tool only inspects an existing LOCAL file and local
 * executable versions/help. NO DATABASE CONNECTION, NO SUPABASE REMOTE DUMP,
 * NO RESTORE, NO NETWORK, NO TOKEN ACCESS, NO FILE WRITES.
 *
 * A checksum and pg_restore table-of-contents review DO NOT prove successful
 * independent restoration, project identity, encryption or adequate coverage.
 */
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process');

const OPERATIONS=Object.freeze([
 ['supabase',['--version']],['supabase',['db','dump','--help']],
 ['pg_restore',['--version']]
]);
const safeRun=(exe,args,timeout=6500)=>{
 const r=spawnSync(exe,args,{encoding:'utf8',timeout,maxBuffer:1024*1024,windowsHide:true,shell:false});
 return {ok:!r.error&&r.status===0,text:(r.stdout||'').slice(0,8192)};
};
const archiveDigest=async(file)=>{
 const sum=createHash('sha256');
 const stream=fs.createReadStream(file);
 for await (const chunk of stream)sum.update(chunk);
 return sum.digest('hex');
};
const forbiddenFlags=Object.freeze([
 'can_export','can_restore_hosted','can_apply_migration',
 'can_publish','can_send_provider','actual_restore_verified',
 'actual_project_provenance_verified','independent_review_complete',
 'auth_data_restoration_verified','storage_object_restoration_verified'
]);
function classifyLocalArchive({exists=false,bytes=0,hash=null,tocReadable=false,
 tocContent='',cliVersion=null,cliDumpHelpOk=false,pgRestoreInstalled=false}={}){
 const toc=typeof tocContent==='string'?tocContent:'';
 const auth=/(?:^|\n)[^\n]{0,256}\bTABLE DATA\s+auth\s+users\b/im.test(toc);
 const authSchema=/(?:^|\n)[^\n]{0,256}\bSCHEMA\s+-\s+auth\b/im.test(toc);
 const appRows=/(?:^|\n)[^\n]{0,256}\bTABLE DATA\s+public\s+(?:products|orders)\b/im.test(toc);
 const result={
  contract:'T404_P0J_OFFLINE_ARCHIVE_PREFLIGHT_V1',
  evidence_kind:'LOCAL_ARCHIVE_STRUCTURE_ONLY_NOT_INDEPENDENT_ATTESTATION',
  status:'NO_GO_REAL_BACKUP_AND_RESTORE_NOT_CERTIFIED',
  archive_present:!!exists&&bytes>0,
  archive_bytes:!!exists&&Number.isSafeInteger(bytes)&&bytes>0?bytes:null,
  archive_sha256:typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash)?hash:null,
  toc_readable:!!tocReadable,
  auth_users_table_data_listed:tocReadable&&auth,
  auth_schema_listed:tocReadable&&authSchema,
  public_products_or_orders_table_data_listed:tocReadable&&appRows,
  supabase_cli_version:typeof cliVersion==='string'&&/^[0-9]+\.[0-9]+\.[0-9]+/.test(cliVersion)
   ?cliVersion:null,
  supabase_cli_help_readable:!!cliDumpHelpOk,
  cli_v3_remote_selection_requires_explicit_review:!!cliVersion&&/^3\./.test(cliVersion),
  pg_restore_installed:!!pgRestoreInstalled,
  storage_object_bytes_included:false,
  roles_and_privileges_recovery_certified:false,
  archive_encryption_verified:false,
  complete_schema_data_roles_auth_coverage_verified:false,
  ...Object.fromEntries(forbiddenFlags.map(k=>[k,false])),
  operator_action:'PRIVATE_CONTROLLER_AND_REVIEWER_MUST_VERIFY_ARCHIVE_SCOPE_AND_AUTHORIZE_INDEPENDENT_RESTORE'
 };
 return Object.freeze(result);
}
const safeArgError='USAGE: node operator-offline-preflight.cjs [--archive ABSOLUTE_LOCAL_BACKUP_PATH]';
function parseArgs(argv){
 if(!Array.isArray(argv))throw Error(safeArgError);
 if(argv.length===0)return{archive:null};
 if(argv.length!==2||argv[0]!=='--archive'||typeof argv[1]!=='string'||
   !path.isAbsolute(argv[1])||argv[1].length>4000)
  throw Error(safeArgError);
 return {archive:argv[1]};
}
async function inspectOffline({archive=null,run=safeRun}={}){
 // fixed allowlist of local commands only; NEVER execute supabase db dump,
 // restore, link, --remote, pg_dump, docker, psql or network APIs.
 const commandResults=OPERATIONS.map(([exe,args])=>run(exe,args));
 const versionText=commandResults[0].ok?commandResults[0].text.trim():null;
 const ver=versionText&&(versionText.match(/\b\d+\.\d+\.\d+\b/)||[])[0]||null;
 const hasPg=commandResults[2].ok;
 if(archive===null)return classifyLocalArchive({
  cliVersion:ver,cliDumpHelpOk:commandResults[1].ok,pgRestoreInstalled:hasPg
 });
 if(!path.isAbsolute(archive))throw Error(safeArgError);
 let st;
 try{st=fs.statSync(archive);}catch{
  return classifyLocalArchive({
   cliVersion:ver,cliDumpHelpOk:commandResults[1].ok,pgRestoreInstalled:hasPg
  });
 }
 if(!st.isFile()||st.size===0||!Number.isSafeInteger(st.size)){
  return classifyLocalArchive({
   cliVersion:ver,cliDumpHelpOk:commandResults[1].ok,pgRestoreInstalled:hasPg
  });
 }
 const hash=await archiveDigest(archive);
 const tocResult=hasPg?run('pg_restore',['-l',archive],12000):{ok:false,text:''};
 return classifyLocalArchive({
  exists:true,bytes:st.size,hash,
  tocReadable:tocResult.ok,tocContent:tocResult.ok?tocResult.text:'',
  cliVersion:ver,cliDumpHelpOk:commandResults[1].ok,pgRestoreInstalled:hasPg
 });
}
async function main(){
 let args;try{args=parseArgs(process.argv.slice(2));}catch{
  console.error(safeArgError);process.exitCode=2;return;
 }
 const result=await inspectOffline(args);
 // stdout has no local path, archive contents, SQL, credentials or TOC.
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(require.main===module)main().catch(()=>{
 // Deliberately suppress private file paths and runtime error internals.
 console.error('OFFLINE_PREFLIGHT_ERROR — inspect local file access privately; no operation performed');
 process.exitCode=2;
});
module.exports={OPERATIONS,forbiddenFlags,classifyLocalArchive,parseArgs,inspectOffline};

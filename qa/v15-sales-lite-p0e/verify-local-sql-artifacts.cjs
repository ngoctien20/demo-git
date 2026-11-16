'use strict';
/**
 * V15 P0-E -- LOCAL-ONLY SQL artifact SHA-256 verifier.
 * No network/API, no upload, no output of file bytes, names, contents or hashes.
 * The manifest and SQL files MUST stay in a PRIVATE encrypted workspace.
 * Even checksum PASS cannot prove that an actual hosted database was dumped,
 * that Auth/Storage were covered, or that the backup can be restored.
 */
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const crypto=require('node:crypto');
const path=require('node:path');
const REQUIRED=Object.freeze(['roles.sql','schema.sql','data.sql']);
const HEX=/^[0-9a-f]{64}$/;
const empty=reason=>Object.freeze({status:'BLOCKED',reason,checked:0,
  sha256_matched:false, real_restore_verified:false,
  hosted_backup_certified:false, full_project_coverage_verified:false,
  may_apply_migration:false});
const good=()=>Object.freeze({
 status:'LOCAL_INTEGRITY_ONLY_NOT_RESTORE_CERTIFICATION',
 checked:3,sha256_matched:true,real_restore_verified:false,
 hosted_backup_certified:false,full_project_coverage_verified:false,
 may_apply_migration:false
});
async function digestFile(filename){
 const h=crypto.createHash('sha256');
 const stream=fs.createReadStream(filename);
 for await(const chunk of stream)h.update(chunk);
 return h.digest('hex');
}
function safeManifest(m){
 if(!m||typeof m!=='object'||Array.isArray(m)||Object.getPrototypeOf(m)!==Object.prototype||
    Object.keys(m).sort().join(',')!=='artifacts,contract,project'||
    m.contract!=='TIEN404_V15_P0E_LOCAL_INTEGRITY_V1'||
    m.project!=='ifxlvrhyjhbzbrkdsida'||
    !m.artifacts||typeof m.artifacts!=='object'||Array.isArray(m.artifacts)||
    Object.getPrototypeOf(m.artifacts)!==Object.prototype||
    Object.keys(m.artifacts).sort().join(',')!==REQUIRED.slice().sort().join(','))return false;
 for(const name of REQUIRED){
  const a=m.artifacts[name];
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.getPrototypeOf(a)!==Object.prototype||
     Object.keys(a).sort().join(',')!=='sha256'||
     typeof a.sha256!=='string'||!HEX.test(a.sha256))return false;
 }
 return true;
}
async function verifyLocalSqlArtifacts({privateDirectory,manifest}={}){
 if(!safeManifest(manifest)||typeof privateDirectory!=='string'||!path.isAbsolute(privateDirectory))
   return empty('INVALID_LOCAL_PRIVATE_MANIFEST');
 try{
  const dirStat=await fsp.lstat(privateDirectory);
  if(!dirStat.isDirectory()||dirStat.isSymbolicLink())return empty('DIRECTORY_NOT_PRIVATE');
  // POSIX only, fail closed if group/other can read/execute the source files.
  if(process.platform==='win32')return empty('POSIX_PRIVATE_PERMISSIONS_REQUIRED');
  if((dirStat.mode&0o077)!==0)return empty('DIRECTORY_NOT_PRIVATE');
  let checked=0;
  for(const name of REQUIRED){
   const filename=path.join(privateDirectory,name);
   const st=await fsp.lstat(filename);
   if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size<1||
      (st.mode&0o077)!==0)return empty('UNSAFE_FILE_PERMISSIONS_OR_EMPTY_FILE');
   const observed=await digestFile(filename);
   const supplied=manifest.artifacts[name].sha256;
   const same=crypto.timingSafeEqual(Buffer.from(observed,'hex'),Buffer.from(supplied,'hex'));
   if(!same)return empty('LOCAL_ARTIFACT_INTEGRITY_MISMATCH');
   checked++;
  }
  if(checked!==3)return empty('INCOMPLETE_LOCAL_ARTIFACT_SET');
  return good();
 }catch{
  return empty('LOCAL_FILE_CHECK_FAILED');
 }
}
module.exports={REQUIRED,verifyLocalSqlArtifacts};
if(require.main===module){
 // Execute only with operator-supplied PRIVATE filesystem paths after separate
 // approval/authorization. Never reads from remote or creates a backup.
 (async()=>{
  if(process.argv.length!==4||process.argv[2]!=='--manifest'){
   process.stderr.write('Usage: node verify-local-sql-artifacts.cjs --manifest /private/backup/manifest.json\n');
   process.exitCode=2;return;
  }
  const mp=path.resolve(process.argv[3]);
  let manifest;
  try{
   const info=await fsp.lstat(mp);
   if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)!==0)throw Error('unsafe manifest');
   manifest=JSON.parse(await fsp.readFile(mp,'utf8'));
  }catch{
   process.stderr.write('BLOCKED: private local manifest inaccessible or invalid\n');
   process.exitCode=2;return;
  }
  const r=await verifyLocalSqlArtifacts({privateDirectory:path.dirname(mp),manifest});
  process.stdout.write(r.status+'\n');
  if(!r.sha256_matched)process.exitCode=3;
 })().catch(()=>{process.stderr.write('BLOCKED: local verification failed\n');process.exitCode=3;});
}

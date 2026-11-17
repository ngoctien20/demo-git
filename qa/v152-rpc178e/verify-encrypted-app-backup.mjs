/**
 * RPC17.8E — read-only age encrypted application backup integrity verifier.
 * Streams decrypted bytes to memory in bounded chunks and discards them:
 * NO decrypted dump file, NO pg_restore, NO SQL connection, NO hosted action.
 * Checks age authentication + PostgreSQL archive PGDMP header only.
 * NOT a restore drill or a complete Supabase backup.
 */
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream,existsSync,readFileSync,statSync} from 'node:fs';
import {isAbsolute,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROJECT,SCHEMAS,REPO_ROOT} from './stream-encrypted-app-backup.mjs';

const deny=reason=>Object.freeze({
 status:'BLOCKED',reason,
 can_restore_live:false,can_migrate:false,can_send:false,
 backup_restorable_verified:false
});
const wait=p=>new Promise(done=>{
 let finished=false;
 const end=code=>{if(!finished){finished=true;done(code)}};
 p.once('error',()=>end(127));
 p.once('close',code=>end(code===null?127:code));
});
const fileHash=path=>new Promise((done,fail)=>{
 const hash=createHash('sha256'),s=createReadStream(path);
 s.on('data',chunk=>hash.update(chunk));s.on('error',fail);
 s.on('end',()=>done(hash.digest('hex')));
});
export function validateArchiveLocation(input={}){
 const {archive,identity,repoRoot=REPO_ROOT}=input||{};
 if(typeof archive!=='string'||!isAbsolute(archive)||!archive.endsWith('.age')||
    typeof identity!=='string'||!isAbsolute(identity))
   return deny('ABSOLUTE_AGE_ARCHIVE_AND_PRIVATE_IDENTITY_REQUIRED');
 const home=resolve(repoRoot),a=resolve(archive),i=resolve(identity);
 if(a===home||a.startsWith(home+sep)||i===home||i.startsWith(home+sep))
   return deny('REPOSITORY_BACKUP_OR_IDENTITY_FORBIDDEN');
 if(!existsSync(a)||!statSync(a).isFile()||
    !existsSync(i)||!statSync(i).isFile())
   return deny('PRIVATE_ARCHIVE_OR_IDENTITY_MISSING');
 if(!existsSync(a+'.manifest.json'))return deny('ARCHIVE_MANIFEST_MISSING');
 return Object.freeze({status:'READY',archive:a,identity:i});
}
export async function verifyEncryptedArchive(input={}){
 const {archive,identity,repoRoot=REPO_ROOT,spawnImpl=spawn,
   tools={age:'age'}}=input||{};
 const x=validateArchiveLocation({archive,identity,repoRoot});
 if(x.status!=='READY')return x;
 try{
  if(statSync(x.archive+'.manifest.json').size>15000)
    return deny('MANIFEST_TOO_LARGE');
  const m=JSON.parse(readFileSync(x.archive+'.manifest.json','utf8'));
  if(m.format!=='TIEN404_APP_SCOPE_AGE_V1'||m.project!==PROJECT||
     m.backup_scope!=='APPLICATION_SCHEMAS_ONLY_NOT_FULL_SUPABASE'||
     m.encrypted!==true||m.verified_restorable!==false||
     m.includes_platform_auth_storage_data!==false||
     m.includes_database_roles_or_acl!==false||
     !['schema-only','app-data'].includes(m.mode)||
     !Array.isArray(m.schemas)||m.schemas.join('|')!==SCHEMAS.join('|')||
     !Number.isSafeInteger(m.file_size_bytes)||m.file_size_bytes<100||
     typeof m.sha256!=='string'||!/^[a-f0-9]{64}$/.test(m.sha256))
     return deny('MANIFEST_SCOPE_OR_FORMAT_MISMATCH');
  if(statSync(x.archive).size!==m.file_size_bytes||
     await fileHash(x.archive)!==m.sha256)
     return deny('ENCRYPTED_ARCHIVE_INTEGRITY_FAILED');

  const decrypt=spawnImpl(tools.age,['-d','-i',x.identity,x.archive],
    {shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
  decrypt.stderr?.on('data',()=>{});
  let prefix=Buffer.alloc(0),byteCount=0;
  decrypt.stdout.on('data',chunk=>{
   byteCount+=chunk.length;
   if(prefix.length<5)prefix=Buffer.concat([prefix,chunk.subarray(0,5-prefix.length)]);
  });
  const ageExit=await wait(decrypt);
  if(ageExit!==0)return deny('AGE_DECRYPTION_OR_AUTHENTICATION_FAILED');
  if(byteCount<16||prefix.toString('ascii')!=='PGDMP')
    return deny('POSTGRESQL_CUSTOM_ARCHIVE_HEADER_INVALID');
  return Object.freeze({
   status:'ENCRYPTED_ARCHIVE_DECRYPT_HEADER_VERIFIED_NOT_RESTORED',
   backup_restorable_verified:false,
   scope:'APPLICATION_SCHEMAS_ONLY',
   mode:m.mode,
   can_restore_live:false,can_migrate:false,can_send:false
  });
 }catch{return deny('ARCHIVE_VERIFY_FAILED_CLOSED')}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 if(process.argv.length!==5||process.argv[2]!=='--verify'){
  console.log(JSON.stringify(deny('EXPLICIT_PRIVATE_ARCHIVE_VERIFY_REQUIRED')));
  process.exitCode=2;
 }else{
  const r=await verifyEncryptedArchive({archive:process.argv[3],identity:process.argv[4]});
  console.log(JSON.stringify(r));
  if(r.status!=='ENCRYPTED_ARCHIVE_DECRYPT_HEADER_VERIFIED_NOT_RESTORED')process.exitCode=2;
 }
}

/**
 * TIEN404 RPC17.8E — Docker-free Windows/Linux ENCRYPTED application-scope backup.
 *
 * Uses native PostgreSQL 17 pg_dump stdout -> age stdin, with NO plaintext
 * .dump file created on disk. Does not connect or modify any hosted database
 * unless the human explicitly runs --execute from a private workstation.
 *
 * IMPORTANT: app schemas only. NOT a complete Supabase backup / restore proof.
 * Requires Node 22+, pg_dump 17+, age CLI, preconfigured libpq credentials,
 * and an age X25519 recipient whose PRIVATE key is kept OFF this workstation.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  createReadStream, existsSync, renameSync, rmSync, statSync,
  writeFileSync, openSync, closeSync
} from 'node:fs';
import { isAbsolute, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT = 'ifxlvrhyjhbzbrkdsida';
export const SCHEMAS = Object.freeze([
  'public', 'app_private', 'factory_private',
  'tien404_dialogue_private', 'tien404_r1_qa', 'tien404_v175_qa'
]);
const ALLOWED_DIRECT = `db.${PROJECT}.supabase.co`;
const ALLOWED_POOLER = /^[a-z0-9-]+\.pooler\.supabase\.com$/;
export const PASSKEY_PATTERN = /^age1[0-9a-z]{35,100}$/;

const result = (status, reason, additional={}) => Object.freeze({
  status, reason, can_apply_migration:false, can_send:false, can_restore_live:false,
  ...additional
});
export function validateRemoteEnv(env={}) {
  if (!env || typeof env !== 'object') return result('BLOCKED','DB_ENV_MISSING');
  const host=env.PGHOST, user=env.PGUSER;
  const direct=host===ALLOWED_DIRECT, pooler=typeof host==='string'&&ALLOWED_POOLER.test(host);
  if(!direct&&!pooler)return result('BLOCKED','SUPABASE_HOST_NOT_ALLOWLISTED');
  if(env.PGPORT!=='5432'||env.PGDATABASE!=='postgres')return result('BLOCKED','DB_PORT_OR_NAME_UNEXPECTED');
  if((direct&&user!=='postgres')||(pooler&&user!==`postgres.${PROJECT}`))
    return result('BLOCKED','DATABASE_USER_WRONG_PROJECT');
  if(env.PGSSLMODE!=='verify-full')return result('BLOCKED','TLS_VERIFY_FULL_REQUIRED');
  if(!(typeof env.PGPASSWORD==='string'&&env.PGPASSWORD.length>0) &&
     !(typeof env.PGPASSFILE==='string'&&env.PGPASSFILE.length>0))
    return result('BLOCKED','PRIVATE_PASSWORD_SOURCE_MISSING');
  return result('READY','REMOTE_READ_ONLY_PLAN_READY');
}
export function buildDumpArgs(mode='schema-only') {
  if(!['schema-only','app-data'].includes(mode))throw new Error('INVALID_MODE');
  const args=['--format=custom','--no-owner','--no-acl','--no-password',
    '--lock-wait-timeout=5000','--verbose=0'];
  // --verbose=0 is not accepted by all pg_dump versions: avoid it entirely.
  args.pop();
  if(mode==='schema-only')args.push('--schema-only');
  for(const name of SCHEMAS)args.push('--schema='+name);
  return args;
}
export function validateBackupPlan(plan,env={},cwd=process.cwd()) {
  const opts=plan||{};
  if(opts.execute!==true)return result('BLOCKED','EXPLICIT_EXECUTE_REQUIRED');
  if(!['schema-only','app-data'].includes(opts.mode))return result('BLOCKED','BACKUP_MODE_REQUIRED');
  if(opts.mode==='app-data'&&opts.acceptSensitive!==true)
    return result('BLOCKED','SENSITIVE_DATA_CONSENT_REQUIRED');
  if(typeof opts.recipient!=='string'||!PASSKEY_PATTERN.test(opts.recipient))
    return result('BLOCKED','AGE_RECIPIENT_INVALID');
  if(typeof opts.output!=='string'||!isAbsolute(opts.output)||!opts.output.endsWith('.age'))
    return result('BLOCKED','ABSOLUTE_ENCRYPTED_OUTPUT_REQUIRED');
  const dest=resolve(opts.output),repo=resolve(cwd);
  if(dest===repo||dest.startsWith(repo+sep))
    return result('BLOCKED','REPOSITORY_OUTPUT_FORBIDDEN');
  if(existsSync(dest)||existsSync(dest+'.manifest.json'))
    return result('BLOCKED','BACKUP_ALREADY_EXISTS');
  if(!existsSync(dirname(dest))||!statSync(dirname(dest)).isDirectory())
    return result('BLOCKED','BACKUP_DIRECTORY_MISSING');
  const safe=validateRemoteEnv(env);
  return safe.status==='READY'?result('READY','ENCRYPTED_STREAM_BACKUP_ELIGIBLE'):safe;
}
const toolVersion=(name)=>{
  try{
    const r=spawnSync(name,['--version'],{encoding:'utf8',shell:false,windowsHide:true,
      timeout:10000,stdio:['ignore','pipe','ignore']});
    return r.status===0?String(r.stdout).trim().slice(0,100):null;
  }catch{return null;}
};
export function checkTooling(versions={}) {
 const v=versions;
 if(typeof v.pg_dump!=='string'||!/^pg_dump \(PostgreSQL\) (1[7-9]|[2-9]\d)\./.test(v.pg_dump))
   return result('BLOCKED','POSTGRESQL_17_PLUS_PG_DUMP_REQUIRED');
 if(typeof v.age!=='string'||!/\bv?\d+\.\d+/.test(v.age))
   return result('BLOCKED','AGE_ENCRYPTION_CLI_REQUIRED');
 return result('READY','LOCAL_TOOLING_AVAILABLE');
}
async function sha256File(path) {
 return await new Promise((done,fail)=>{
  const stream=createReadStream(path),hash=createHash('sha256');
  stream.on('data',b=>hash.update(b));stream.on('error',fail);
  stream.on('end',()=>done(hash.digest('hex')));
 });
}
const waitFor=(proc)=>new Promise(resolve=>{
 let settled=false;
 const finish=(code)=>{if(!settled){settled=true;resolve(code)}};
 proc.once('error',()=>finish(127));
 proc.once('close',code=>finish(code===null?127:code));
});
export async function runEncryptedBackup({plan,env=process.env,cwd=process.cwd(),
  spawnImpl=spawn,tools={pg_dump:'pg_dump',age:'age'}}={}) {
 const approval=validateBackupPlan(plan,env,cwd);
 if(approval.status!=='READY')return approval;
 const output=resolve(plan.output);
 const partial=output+'.partial-'+randomUUID();
 let dump,age;
 try {
  const pgEnv={...env,PGOPTIONS:'-c default_transaction_read_only=on',PGCONNECT_TIMEOUT:'15'};
  dump=spawnImpl(tools.pg_dump,buildDumpArgs(plan.mode),
    {env:pgEnv,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
  age=spawnImpl(tools.age,['-r',plan.recipient,'-o',partial],
    {env,shell:false,windowsHide:true,stdio:['pipe','ignore','pipe']});
  dump.stderr?.on('data',()=>{});age.stderr?.on('data',()=>{});
  // Pipes remain binary-safe on Windows, unlike PowerShell 5.1 native pipelines.
  dump.stdout.pipe(age.stdin);
  age.stdin.on('error',()=>{}); // fail closed on early-exit EPIPE
  const [pgExit,ageExit]=await Promise.all([waitFor(dump),waitFor(age)]);
  if(pgExit!==0||ageExit!==0)return result('BLOCKED','BACKUP_PROCESS_FAILED');
  if(!existsSync(partial)||statSync(partial).size<100)
    return result('BLOCKED','ENCRYPTED_ARCHIVE_EMPTY');
  const header=Buffer.alloc(22);
  const fd=openSync(partial,'r');
  try{const {readSync}=await import('node:fs');readSync(fd,header,0,22,0)}
  finally{closeSync(fd)}
  if(!header.toString('ascii').startsWith('age-encryption.org/v1'))
    return result('BLOCKED','AGE_ARCHIVE_HEADER_INVALID');
  const size=statSync(partial).size;
  const sha256=await sha256File(partial);
  renameSync(partial,output);
  const manifest={
   format:'TIEN404_APP_SCOPE_AGE_V1',
   project:PROJECT,
   backup_scope:'APPLICATION_SCHEMAS_ONLY_NOT_FULL_SUPABASE',
   schemas:SCHEMAS,
   mode:plan.mode,
   encrypted:true,
   includes_platform_auth_storage_data:false,
   includes_database_roles_or_acl:false,
   verified_restorable:false,
   file_size_bytes:size,
   sha256,
   collected_at_utc:new Date().toISOString()
  };
  writeFileSync(output+'.manifest.json',JSON.stringify(manifest,null,2)+'\n',
    {encoding:'utf8',flag:'wx',mode:0o600});
  return result('ENCRYPTED_BACKUP_CREATED_RESTORE_NOT_VERIFIED',
    'LOCAL_PRIVATE_ARCHIVE_ONLY',{manifest});
 }catch{
  return result('BLOCKED','BACKUP_FAILED_CLOSED');
 }finally{
  try{dump?.kill()}catch{}
  try{age?.kill()}catch{}
  try{rmSync(partial,{force:true})}catch{}
 }
}
function parseCli(argv){
 const out={execute:false,mode:'schema-only',acceptSensitive:false};
 for(let i=0;i<argv.length;i++){
  const arg=argv[i];
  if(arg==='--execute')out.execute=true;
  else if(arg==='--accept-sensitive')out.acceptSensitive=true;
  else if(['--recipient','--output','--mode'].includes(arg))out[arg.slice(2).replace(/-([a-z])/g,(_,b)=>b.toUpperCase())]=argv[++i];
  else throw new Error('UNKNOWN_OPTION');
 }
 return out;
}
async function main(argv=process.argv.slice(2)){
 try{
  const opts=parseCli(argv);
  if(!opts.execute){
   const versions={pg_dump:toolVersion('pg_dump'),age:toolVersion('age')};
   const tools=checkTooling(versions);
   console.log(JSON.stringify({status:tools.status,reason:tools.reason,
     mode:'DRY_RUN_NO_DB_CONTACT',schema_count:SCHEMAS.length,
     requires:'PostgreSQL 17+ client, age CLI and local private credentials',
     can_apply_migration:false}));
   if(tools.status!=='READY')process.exitCode=2;
   return;
  }
  const tools=checkTooling({pg_dump:toolVersion('pg_dump'),age:toolVersion('age')});
  if(tools.status!=='READY'){console.log(JSON.stringify(tools));process.exitCode=2;return}
  const answer=await runEncryptedBackup({plan:opts});
  console.log(JSON.stringify(answer));
  if(answer.status!=='ENCRYPTED_BACKUP_CREATED_RESTORE_NOT_VERIFIED')process.exitCode=2;
 }catch{
  console.log(JSON.stringify(result('BLOCKED','BAD_ARGS_OR_RUNTIME')));
  process.exitCode=2;
 }
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))await main();

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {
 SCHEMAS,validateRemoteEnv,validateBackupPlan,buildDumpArgs,
 checkTooling,runEncryptedBackup
} from './stream-encrypted-app-backup.mjs';
const ref='ifxlvrhyjhbzbrkdsida';
const goodEnv={PGHOST:`db.${ref}.supabase.co`,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:'postgres',PGSSLMODE:'verify-full',PGPASSWORD:'TEST_ONLY_SECRET_NEVER_USE'};
const recipient='age1'+'x'.repeat(58);
const dir=mkdtempSync(join(tmpdir(),'tien404-app-backup-'));
const cwd=join(dir,'repo');mkdirSync(cwd);
const destination=join(dir,'encrypted.age');
const base=()=>({execute:true,mode:'schema-only',recipient,output:destination,acceptSensitive:false});
const assertLocked=v=>{assert.equal(v.can_apply_migration,false);assert.equal(v.can_send,false);assert.equal(v.can_restore_live,false);assert.equal(JSON.stringify(v).includes(goodEnv.PGPASSWORD),false)};
test.after(()=>rmSync(dir,{recursive:true,force:true}));
test('only app schemas, not managed auth/storage',()=>{assert.equal(SCHEMAS.length,6);assert.ok(SCHEMAS.includes('public'));assert.equal(SCHEMAS.includes('auth'),false);assert.equal(SCHEMAS.includes('storage'),false)});
test('schema-only default disables data copying',()=>{const a=buildDumpArgs('schema-only');assert.ok(a.includes('--schema-only'));assert.ok(a.includes('--no-password'));assert.ok(a.includes('--format=custom'));assert.equal(a.filter(x=>x.startsWith('--schema=')).length,6);assert.equal(a.includes('--clean'),false)});
test('app-data requires explicit consent but never mutates hosted database',()=>{const a=buildDumpArgs('app-data');assert.equal(a.includes('--schema-only'),false);assert.equal(a.includes('--clean'),false);assert.ok(a.includes('--no-owner'))});
test('reject unexpected dump mode',()=>assert.throws(()=>buildDumpArgs('all-supabase')));
test('correct database credentials only produce read-only readiness',()=>{const x=validateRemoteEnv(goodEnv);assert.equal(x.status,'READY');assertLocked(x)});
test('pooler with project user supported',()=>{const x=validateRemoteEnv({...goodEnv,PGHOST:'aws-0-ap-southeast-1.pooler.supabase.com',PGUSER:'postgres.'+ref});assert.equal(x.status,'READY');assertLocked(x)});
for(const [label,k,v] of [
 ['wrong project hostname','PGHOST','db.evilproject.supabase.co'],
 ['typosquatting pooler','PGHOST','aws-0.pooler.supabase.com.evil.example'],
 ['wrong port','PGPORT','6543'],['wrong DB','PGDATABASE','merchant'],
 ['wrong DB user','PGUSER','postgres.other'],
 ['TLS require only','PGSSLMODE','require'],
 ['TLS disabled','PGSSLMODE','disable'],
 ['password missing','PGPASSWORD',undefined]
])test('reject '+label,()=>{const x=validateRemoteEnv({...goodEnv,[k]:v});assert.equal(x.status,'BLOCKED');assertLocked(x)});
test('null env fails closed',()=>{const x=validateRemoteEnv(null);assert.equal(x.status,'BLOCKED');assertLocked(x)});
test('missing execute guard',()=>{const x=validateBackupPlan({...base(),execute:false},goodEnv,cwd);assert.equal(x.reason,'EXPLICIT_EXECUTE_REQUIRED')});
test('missing age recipient denied',()=>{const x=validateBackupPlan({...base(),recipient:'notage'},goodEnv,cwd);assert.equal(x.status,'BLOCKED')});
test('refuse path inside source repo',()=>{const x=validateBackupPlan({...base(),output:join(cwd,'backup.age')},goodEnv,cwd);assert.equal(x.reason,'REPOSITORY_OUTPUT_FORBIDDEN')});
test('refuse plaintext extension',()=>{const x=validateBackupPlan({...base(),output:join(dir,'backup.dump')},goodEnv,cwd);assert.equal(x.reason,'ABSOLUTE_ENCRYPTED_OUTPUT_REQUIRED')});
test('refuse unknown parent dir',()=>{const x=validateBackupPlan({...base(),output:join(dir,'missing','backup.age')},goodEnv,cwd);assert.equal(x.reason,'BACKUP_DIRECTORY_MISSING')});
test('app data needs extra private acceptance',()=>{const x=validateBackupPlan({...base(),mode:'app-data'},goodEnv,cwd);assert.equal(x.reason,'SENSITIVE_DATA_CONSENT_REQUIRED')});
test('reject present output instead of overwriting',()=>{const p=join(dir,'preexisting.age');writeFileSync(p,'SENSITIVE');const x=validateBackupPlan({...base(),output:p},goodEnv,cwd);assert.equal(x.reason,'BACKUP_ALREADY_EXISTS');assert.equal(readFileSync(p,'utf8'),'SENSITIVE')});
test('pg_dump and age versions enforce minimum compatible tooling',()=>{
 assert.equal(checkTooling({pg_dump:'pg_dump (PostgreSQL) 17.11',age:'v1.2.0'}).status,'READY');
 assert.equal(checkTooling({pg_dump:'pg_dump (PostgreSQL) 16.3',age:'v1.2.0'}).status,'BLOCKED');
 assert.equal(checkTooling({pg_dump:'pg_dump (PostgreSQL) 17.11',age:null}).status,'BLOCKED');
});
function mockSpawns({ageCode=0,pgCode=0,makeArchive=true}={}){
 const calls=[];
 const spawnImpl=(command,args,options)=>{
  const proc=new EventEmitter();
  proc.stdout=new PassThrough();proc.stdin=new PassThrough();proc.stderr=new PassThrough();
  proc.kill=()=>{};
  calls.push({command,args,options});
  if(calls.length===1){
   setImmediate(()=>{proc.stdout.end(Buffer.from('SYNTHETIC_PG_DUMP_NEVER_REAL'));proc.emit('close',pgCode)});
  }else{
   proc.stdin.on('end',()=>{
     if(makeArchive)writeFileSync(args[args.indexOf('-o')+1],'age-encryption.org/v1\n'+'.'.repeat(150));
     setImmediate(()=>proc.emit('close',ageCode));
   });
   proc.stdin.resume();
  }
  return proc;
 };
 return {spawnImpl,calls};
}
test('mocked binary stream writes only age-labelled archive and a redacted manifest',async()=>{
 const x=mockSpawns();const p={...base(),output:join(dir,'mock-success.age')};
 const r=await runEncryptedBackup({plan:p,env:goodEnv,cwd,spawnImpl:x.spawnImpl});
 assert.equal(r.status,'ENCRYPTED_BACKUP_CREATED_RESTORE_NOT_VERIFIED');
 assert.equal(r.manifest.verified_restorable,false);
 assert.equal(r.manifest.includes_platform_auth_storage_data,false);
 assert.equal(r.manifest.includes_database_roles_or_acl,false);
 assert.equal(existsSync(p.output),true);
 assert.equal(existsSync(p.output+'.manifest.json'),true);
 assert.equal(x.calls.length,2);
 assert.ok(x.calls[0].args.includes('--schema-only'));
 assert.ok(x.calls[0].options.env.PGOPTIONS.includes('default_transaction_read_only=on'));
 assert.equal(JSON.stringify(r).includes(goodEnv.PGPASSWORD),false);
 assertLocked(r);
});
test('mocked encryption failure cannot leave trusted backup',async()=>{
 const x=mockSpawns({ageCode:1});const p={...base(),output:join(dir,'mock-failed.age')};
 const r=await runEncryptedBackup({plan:p,env:goodEnv,cwd,spawnImpl:x.spawnImpl});
 assert.equal(r.status,'BLOCKED');
 assert.equal(existsSync(p.output),false);assertLocked(r);
});
test('mocked dump failure cannot leave trusted backup',async()=>{
 const x=mockSpawns({pgCode:1});const p={...base(),output:join(dir,'mock-pg-failed.age')};
 const r=await runEncryptedBackup({plan:p,env:goodEnv,cwd,spawnImpl:x.spawnImpl});
 assert.equal(r.status,'BLOCKED');
 assert.equal(existsSync(p.output),false);assertLocked(r);
});
test('missing archive rejected even with false process success',async()=>{
 const x=mockSpawns({makeArchive:false});const p={...base(),output:join(dir,'mock-missing.age')};
 const r=await runEncryptedBackup({plan:p,env:goodEnv,cwd,spawnImpl:x.spawnImpl});
 assert.equal(r.status,'BLOCKED');assertLocked(r);
});

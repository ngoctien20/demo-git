import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
import {SCHEMAS,PROJECT} from './stream-encrypted-app-backup.mjs';
import {validateArchiveLocation,verifyEncryptedArchive} from './verify-encrypted-app-backup.mjs';
const dir=mkdtempSync(join(tmpdir(),'tien404-archive-check-'));
const repo=join(dir,'repo');mkdirSync(repo);
const key=join(dir,'id-qa.txt');writeFileSync(key,'FAKE_TEST_ONLY_PRIVATE_KEY');
const archive=join(dir,'app.age');
const bytes=Buffer.from('age-encryption.org/v1\n'+'.'.repeat(150));
const manifest={
 format:'TIEN404_APP_SCOPE_AGE_V1',project:PROJECT,
 backup_scope:'APPLICATION_SCHEMAS_ONLY_NOT_FULL_SUPABASE',
 schemas:SCHEMAS,mode:'schema-only',encrypted:true,
 includes_platform_auth_storage_data:false,
 includes_database_roles_or_acl:false,verified_restorable:false,
 file_size_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')
};
const reset=()=>{writeFileSync(archive,bytes);writeFileSync(archive+'.manifest.json',JSON.stringify(manifest))};
const safe=x=>{assert.equal(x.can_restore_live,false);assert.equal(x.can_migrate,false);assert.equal(x.can_send,false);assert.equal(x.backup_restorable_verified,false)};
test.after(()=>rmSync(dir,{recursive:true,force:true}));
test('default validation cannot touch live DB',()=>{reset();const x=validateArchiveLocation({archive,identity:key,repoRoot:repo});assert.equal(x.status,'READY')});
test('backup or private key in repository is rejected',()=>{reset();const x=validateArchiveLocation({archive:join(repo,'data.age'),identity:key,repoRoot:repo});assert.equal(x.status,'BLOCKED')});
test('missing private identity fails closed',()=>{reset();const x=validateArchiveLocation({archive,identity:join(dir,'missing'),repoRoot:repo});assert.equal(x.status,'BLOCKED')});
test('null validation input fails closed',()=>{const x=validateArchiveLocation(null);assert.equal(x.status,'BLOCKED')});
test('tampered encrypted archive checksum fails before decrypt',async()=>{
 reset();writeFileSync(archive,Buffer.concat([bytes,Buffer.from('TAMPERED')]));
 const x=await verifyEncryptedArchive({archive,identity:key,repoRoot:repo,spawnImpl:()=>{throw Error('should not spawn')}});
 assert.equal(x.reason,'ENCRYPTED_ARCHIVE_INTEGRITY_FAILED');safe(x);
});
test('tampered manifest scope rejected',async()=>{
 reset();writeFileSync(archive+'.manifest.json',JSON.stringify({...manifest,project:'another'}));
 const x=await verifyEncryptedArchive({archive,identity:key,repoRoot:repo,spawnImpl:()=>{throw Error('should not spawn')}});
 assert.equal(x.reason,'MANIFEST_SCOPE_OR_FORMAT_MISMATCH');safe(x);
});
test('manifest cannot claim real restore or platform full backup',async()=>{
 reset();writeFileSync(archive+'.manifest.json',JSON.stringify({...manifest,verified_restorable:true}));
 const x=await verifyEncryptedArchive({archive,identity:key,repoRoot:repo,spawnImpl:()=>{throw Error('should not spawn')}});
 assert.equal(x.reason,'MANIFEST_SCOPE_OR_FORMAT_MISMATCH');safe(x);
});
test('invalid fake age decrypt fails and reveals no content',async()=>{
 reset();
 const fake=()=>{
  const p=new EventEmitter();p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=()=>{};
  setImmediate(()=>{p.stdout.end();p.emit('close',1)});
  return p;
 };
 const x=await verifyEncryptedArchive({archive,identity:key,repoRoot:repo,spawnImpl:fake});
 assert.equal(x.reason,'AGE_DECRYPTION_OR_AUTHENTICATION_FAILED');safe(x);
});
test('decryption with wrong binary header is rejected',async()=>{
 reset();
 const fake=()=>{
  const p=new EventEmitter();p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=()=>{};
  setImmediate(()=>{p.stdout.end(Buffer.from('NOT_A_VALID_PG_DUMP_ARCHIVE'));p.emit('close',0)});
  return p;
 };
 const x=await verifyEncryptedArchive({archive,identity:key,repoRoot:repo,spawnImpl:fake});
 assert.equal(x.reason,'POSTGRESQL_CUSTOM_ARCHIVE_HEADER_INVALID');safe(x);
});
test('mocked age valid authenticated stream still NOT restore acceptance',async()=>{
 reset();const calls=[];
 const fake=(command,args)=>{
  calls.push({command,args});
  const p=new EventEmitter();p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=()=>{};
  setImmediate(()=>{p.stdout.end(Buffer.from('PGDMP_SYNTHETIC_BACKUP_STREAM_NO_REAL_DATA'));p.emit('close',0)});
  return p;
 };
 const x=await verifyEncryptedArchive({archive,identity:key,repoRoot:repo,spawnImpl:fake});
 assert.equal(x.status,'ENCRYPTED_ARCHIVE_DECRYPT_HEADER_VERIFIED_NOT_RESTORED');safe(x);
 assert.equal(calls.length,1);assert.equal(calls[0].command,'age');assert.ok(calls[0].args.includes('-d'));
 assert.equal(JSON.stringify(x).includes('PRIVATE_KEY'),false);
});

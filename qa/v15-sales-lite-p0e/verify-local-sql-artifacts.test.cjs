'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {verifyLocalSqlArtifacts}=require('./verify-local-sql-artifacts.cjs');
const sh=s=>crypto.createHash('sha256').update(s).digest('hex');
async function temp(){
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'tien404-p0e-synthetic-'));
 await fsp.chmod(dir,0o700);
 const artifacts={};
 for(const name of ['roles.sql','schema.sql','data.sql']){
  const bytes='-- SYNTHETIC TEST ONLY \nSELECT '+String(name.length)+';';
  await fsp.writeFile(path.join(dir,name),bytes,{mode:0o600});
  await fsp.chmod(path.join(dir,name),0o600);
  artifacts[name]={sha256:sh(bytes)};
 }
 return {dir,manifest:{contract:'TIEN404_V15_P0E_LOCAL_INTEGRITY_V1',
  project:'ifxlvrhyjhbzbrkdsida',artifacts}};
}
const rm=x=>fsp.rm(x.dir,{recursive:true,force:true});
const blocked=v=>{assert.equal(v.status,'BLOCKED');assert.equal(v.hosted_backup_certified,false);assert.equal(v.may_apply_migration,false);};
test('local-only synthetic three-file SHA matches but NOT a real backup certificate',async()=>{
 const a=await temp();try{
  const r=await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest});
  assert.equal(r.status,'LOCAL_INTEGRITY_ONLY_NOT_RESTORE_CERTIFICATION');
  assert.equal(r.sha256_matched,true);assert.equal(r.checked,3);
  assert.equal(r.hosted_backup_certified,false);assert.equal(r.real_restore_verified,false);
 }finally{await rm(a);}
});
test('tampered artifact fails SHA256 review',async()=>{
 const a=await temp();try{
  await fsp.appendFile(path.join(a.dir,'data.sql'),'-- corrupt');
  blocked(await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest}));
 }finally{await rm(a);}
});
test('empty artifact fails closed',async()=>{
 const a=await temp();try{
  await fsp.truncate(path.join(a.dir,'data.sql'),0);
  blocked(await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest}));
 }finally{await rm(a);}
});
test('missing artifact fails closed',async()=>{
 const a=await temp();try{
  await fsp.unlink(path.join(a.dir,'roles.sql'));
  blocked(await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest}));
 }finally{await rm(a);}
});
test('world-readable SQL file fails closed',async()=>{
 const a=await temp();try{
  await fsp.chmod(path.join(a.dir,'schema.sql'),0o644);
  blocked(await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest}));
 }finally{await rm(a);}
});
test('group-readable backup directory fails closed',async()=>{
 const a=await temp();try{
  await fsp.chmod(a.dir,0o750);
  blocked(await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest}));
 }finally{await rm(a);}
});
test('SQL symlinks are forbidden',async()=>{
 const a=await temp();try{
  await fsp.rename(path.join(a.dir,'schema.sql'),path.join(a.dir,'schema-real.sql'));
  await fsp.symlink('schema-real.sql',path.join(a.dir,'schema.sql'));
  blocked(await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest}));
 }finally{await rm(a);}
});
test('wrong project or fraudulent field is forbidden',async()=>{
 const a=await temp();try{
  a.manifest.project='another-database';
  blocked(await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest}));
  a.manifest.project='ifxlvrhyjhbzbrkdsida';
  a.manifest.authorized=true;
  blocked(await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest}));
 }finally{await rm(a);}
});
test('path traversal in manifest key cannot select arbitrary files',async()=>{
 const a=await temp();try{
  a.manifest.artifacts['../secrets.json']={sha256:sh('fake')};
  blocked(await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest}));
 }finally{await rm(a);}
});
test('duplicate hard-linked artifact fails closed',async()=>{
 const a=await temp();try{
  await fsp.unlink(path.join(a.dir,'roles.sql'));
  await fsp.link(path.join(a.dir,'schema.sql'),path.join(a.dir,'roles.sql'));
  blocked(await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest}));
 }finally{await rm(a);}
});
test('malformed manifest cannot promote a real restore',async()=>{
 const a=await temp();try{
  a.manifest.artifacts['data.sql'].sha256='PASS';
  blocked(await verifyLocalSqlArtifacts({privateDirectory:a.dir,manifest:a.manifest}));
 }finally{await rm(a);}
});

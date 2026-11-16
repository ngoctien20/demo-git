'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {OPERATIONS,forbiddenFlags,classifyLocalArchive,parseArgs,inspectOffline}=
 require('./operator-offline-preflight.cjs');
const expectedAllBlocked=r=>{
 for(const k of forbiddenFlags)assert.equal(r[k],false,k);
 assert.equal(r.status,'NO_GO_REAL_BACKUP_AND_RESTORE_NOT_CERTIFIED');
 assert.equal(r.complete_schema_data_roles_auth_coverage_verified,false);
 assert.equal(r.archive_encryption_verified,false);
 assert.equal(r.storage_object_bytes_included,false);
 assert.equal(r.roles_and_privileges_recovery_certified,false);
};
const safeMock=(exe,args)=>{
 if(exe==='supabase'&&args.join(' ')==='--version')
   return{ok:true,text:'3.0.0\n'};
 if(exe==='supabase'&&args.join(' ')==='db dump --help')
   return{ok:true,text:'Usage: supabase db dump [flags]\n  --remote\n'};
 if(exe==='pg_restore'&&args.join(' ')==='--version')
   return{ok:true,text:'pg_restore (PostgreSQL) 17.0'};
 if(exe==='pg_restore'&&args[0]==='-l')
   return{ok:false,text:''};
 throw Error('PROHIBITED_COMMAND');
};
test('allowlisted local commands never include dump, restore, login, link, remote or network',()=>{
 assert.deepEqual(OPERATIONS,[
  ['supabase',['--version']],['supabase',['db','dump','--help']],
  ['pg_restore',['--version']]
 ]);
});
test('empty CLI args are safe metadata inspection only',()=>{
 assert.deepEqual(parseArgs([]),{archive:null});
});
test('invalid CLI flags or relative paths cannot lead to commands',()=>{
 for(const args of [['--remote'],['--execute'],['--archive','secret.backup'],
  ['--archive','/tmp/dump','--send'],['--archive'],['--archive',2],['-h']]){
  assert.throws(()=>parseArgs(args),/USAGE/);
 }
});
test('archive not supplied never implies a dump or restore was run',async()=>{
 const v=await inspectOffline({run:safeMock});
 expectedAllBlocked(v);
 assert.equal(v.archive_present,false);
 assert.equal(v.supabase_cli_version,'3.0.0');
 assert.equal(v.cli_v3_remote_selection_requires_explicit_review,true);
 assert.equal(v.supabase_cli_help_readable,true);
});
test('CLI v2 has no v3 marker but still cannot authorize export',()=>{
 const r=classifyLocalArchive({cliVersion:'2.81.3'});
 expectedAllBlocked(r);
 assert.equal(r.cli_v3_remote_selection_requires_explicit_review,false);
});
test('present archive with SHA and readable TOC remains NOT RESTORED',()=>{
 const sum='a'.repeat(64);
 const r=classifyLocalArchive({exists:true,bytes:217287,hash:sum,
  tocReadable:true,cliVersion:'3.0.0',cliDumpHelpOk:true,pgRestoreInstalled:true,
  tocContent:'1; 0 1 TABLE DATA public products postgres\n2; 0 2 TABLE DATA public orders postgres'});
 expectedAllBlocked(r);
 assert.equal(r.archive_present,true);
 assert.equal(r.archive_sha256,sum);
 assert.equal(r.public_products_or_orders_table_data_listed,true);
 assert.equal(r.auth_users_table_data_listed,false);
 assert.equal(r.actual_restore_verified,false);
});
test('even archive listing Auth users data cannot certify actual Auth restore',()=>{
 const r=classifyLocalArchive({exists:true,bytes:123,hash:'b'.repeat(64),
 tocReadable:true,tocContent:'3; 0 3 SCHEMA - auth postgres\n4; 0 4 TABLE DATA auth users postgres'});
 expectedAllBlocked(r);
 assert.equal(r.auth_users_table_data_listed,true);
 assert.equal(r.auth_schema_listed,true);
 assert.equal(r.auth_data_restoration_verified,false);
});
test('fake hash and broken TOC do not pass',()=>{
 const r=classifyLocalArchive({exists:true,bytes:123,
  hash:'not_a_hash',tocReadable:false,
  tocContent:'1; TABLE DATA auth users'});
 expectedAllBlocked(r);
 assert.equal(r.archive_sha256,null);
 assert.equal(r.auth_users_table_data_listed,false);
});
test('all fake excellent preflight claims still cannot grant hosted operations',()=>{
 const r=classifyLocalArchive({exists:true,bytes:999,hash:'f'.repeat(64),
 tocReadable:true,tocContent:'3; TABLE DATA auth users\n4; TABLE DATA public orders',
 cliVersion:'3.0.0',cliDumpHelpOk:true,pgRestoreInstalled:true});
 expectedAllBlocked(r);
});
test('test with real local dummy bytes computes checksum without looking up credentials',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p0j-private-'));
 try{
  const archive=path.join(dir,'synthetic-only.backup');
  fs.writeFileSync(archive,Buffer.from('FAKE_ARCHIVE_NOT_ACTUAL_PG_DUMP'));
  const r=await inspectOffline({archive,run:safeMock});
  expectedAllBlocked(r);
  assert.equal(r.archive_present,true);
  assert.equal(r.archive_bytes,31);
  assert.equal(r.archive_sha256,createHash('sha256').update('FAKE_ARCHIVE_NOT_ACTUAL_PG_DUMP').digest('hex'));
  assert.equal(r.toc_readable,false);
  assert.equal(JSON.stringify(r).includes(archive),false);
 } finally{fs.rmSync(dir,{force:true,recursive:true});}
});
test('unavailable archive path is NO-GO, not silently reported as a verified dump',async()=>{
 const pathAbsent=path.join(os.tmpdir(),'p0j-does-not-exist-830192.backup');
 const r=await inspectOffline({archive:pathAbsent,run:safeMock});
 expectedAllBlocked(r);
 assert.equal(r.archive_present,false);
 assert.equal(r.archive_sha256,null);
});
test('operator preflight does not log the private backup path',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p0j-private-'));
 try{
  const file=path.join(dir,'no-pii.backup');fs.writeFileSync(file,'fake');
  const r=await inspectOffline({archive:file,run:safeMock});
  assert.equal(JSON.stringify(r).includes(dir),false);
  assert.equal(JSON.stringify(r).includes('no-pii.backup'),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('source contains no hosted exporter invocation or secrets reads',()=>{
 const src=fs.readFileSync(path.join(__dirname,'operator-offline-preflight.cjs'),'utf8');
 const executable=src.replace(/\/\*[\s\S]*?\*\//g,'');
 for(const bad of ['process.env.',"['--remote']", "'--remote'","['db','dump','--remote']",
  "'pg_dump'","'psql'","'docker'","'pg_restore',['-d'","fetch(",
  "writeFileSync(","createWriteStream(","SUPABASE_SERVICE_ROLE_KEY"])
  assert.equal(executable.includes(bad),false,bad);
});
test('operator cannot turn CLI help status into an approval',()=>{
 const r=classifyLocalArchive({cliVersion:'3.0.0',cliDumpHelpOk:true,pgRestoreInstalled:true});
 expectedAllBlocked(r);
});

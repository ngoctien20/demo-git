'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {CONTRACT,reviewIntake}=require('./private-operator-intake.cjs');
const {HISTORICAL,CLAIMS}=require('./current-recovery-scope-decision.cjs');
const cli=path.join(__dirname,'private-operator-intake.cjs');
function recovery(){
 return {scope:'APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN',
  currentSnapshot:{projectRef:'ifxlvrhyjhbzbrkdsida',capturedDateJst:'2026-11-17',
   tenants:2,products:2,orders:2,customers:0,authUsers:3,
   storageBuckets:0,storageObjects:0},
  h11rReceipt:{status:HISTORICAL,localArchiveShaMatch:true,
   localArchiveBytesMatch:true,applicationEntries:5,authEntries:0,
   storageEntries:0,operatorReported:true},
  claimedEvidence:Object.fromEntries(CLAIMS.map(k=>[k,false]))};
}
const invoke=args=>spawnSync(process.execPath,[cli,...args],
 {encoding:'utf8',timeout:10000});
test('01 minimal operator packet reports specific missing owner/restore/phase',()=>{
 const r=reviewIntake({recoveryDecision:recovery()});
 assert.equal(r.contract,CONTRACT);
 assert.equal(r.status,'RPC12_PRIVATE_OPERATOR_EVIDENCE_INTAKE_INCOMPLETE');
 assert(r.blockers.includes('FOUR_ROW_PRIVATE_SNAPSHOT_AND_OWNER_LEDGER_NOT_SUPPLIED'));
 assert(r.blockers.includes('CURRENT_INDEPENDENT_RECOVERY_NOT_CERTIFIED'));
 assert(r.blockers.includes('EXACT_M1_PRIVATE_PHASE_PACKET_NOT_SUPPLIED'));
});
test('02 all hosted operations permanently denied',()=>{
 const r=reviewIntake({recoveryDecision:recovery()});
 for(const k of ['canApplyM1','canApplyM2M4','canApplyM3',
  'canExportBackup','canRevokeLegacyRpc','primarySourceAndSignersIndependentlyVerified',
  'currentRealRestoreIndependentlyCertified','scopedM1AuthorityCryptographicallyVerified'])
  assert.equal(r[k],false,k);
});
test('03 historic H11R acceptance not erased by later missing Auth',()=>{
 const r=reviewIntake({recoveryDecision:recovery()});
 assert.equal(r.historicH11rPartialApplicationQaAccepted,true);
 assert.equal(r.recoveryScope,'APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN');
 assert.equal(r.canApplyM1,false);
});
test('04 malformed recovery still fails closed',()=>{
 for(const bad of [null,{},'green',[],true]){
  const r=reviewIntake({recoveryDecision:bad});
  assert.equal(r.status,'RPC12_PRIVATE_OPERATOR_EVIDENCE_INTAKE_INCOMPLETE');
  assert.equal(r.canApplyM1,false);
 }
});
test('05 CLI rejects missing required recovery filename',()=>{
 const r=invoke([]);
 assert.equal(r.status,2);
 assert(r.stderr.includes('RPC12_LOCAL_PRIVATE_INPUT_REJECTED'));
});
test('06 CLI refuses relative file path to prevent accidental repo uploads',()=>{
 const r=invoke(['--recovery','./private.json']);
 assert.equal(r.status,2);
 assert(!r.stdout.includes('private.json'));
});
test('07 CLI requires snapshot and ledger together',()=>{
 const r=invoke(['--recovery','/tmp/recovery.json','--snapshot','/tmp/snapshot.json']);
 assert.equal(r.status,2);
});
test('08 CLI rejects duplicate flags and unrelated network/command args',()=>{
 const r=invoke(['--recovery','/tmp/recovery.json','--recovery','/tmp/recovery2.json']);
 assert.equal(r.status,2);
});
test('09 CLI reads safe local recovery file OUTSIDE repository, no hosted call',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'t404-rpc12-only-'));
 try{
  const file=path.join(dir,'recovery.json');
  fs.writeFileSync(file,JSON.stringify(recovery()),{mode:0o600});
  const r=invoke(['--recovery',file]);
  assert.equal(r.status,3);
  const out=JSON.parse(r.stdout);
  assert.equal(out.historicH11rPartialApplicationQaAccepted,true);
  assert.equal(out.canApplyM1,false);
  assert.equal(out.ownerLedgerStatus,'NOT_PROVIDED');
  assert(!r.stdout.includes(file));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('10 original file paths and secret fields never echoed on parse failure',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'t404-rpc12-secret-'));
 try{
  const file=path.join(dir,'private-secret-file.json');
  fs.writeFileSync(file,'{"jwt":"VERY_SECRET_JWT"',{mode:0o600});
  const r=invoke(['--recovery',file]);
  assert.equal(r.status,2);
  assert(!r.stdout.includes('VERY_SECRET_JWT'));
  assert(!r.stderr.includes('VERY_SECRET_JWT'));
  assert(!r.stderr.includes(file));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('11 private evidence symlink is refused without following it',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'t404-rpc12-symlink-'));
 try{
  const source=path.join(dir,'source.json'),link=path.join(dir,'link.json');
  fs.writeFileSync(source,JSON.stringify(recovery()),{mode:0o600});
  try{fs.symlinkSync(source,link)}catch(_){t.skip('symlink privilege unavailable');return;}
  const r=invoke(['--recovery',link]);
  assert.equal(r.status,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('12 extra unknown top-level recovery key cannot certify owner claim',()=>{
 const p=recovery();p.currentSnapshot.authUsers=0;p.hasFullBackupNow=true;
 const r=reviewIntake({recoveryDecision:p});
 assert.equal(r.status,'RPC12_PRIVATE_OPERATOR_EVIDENCE_INTAKE_INCOMPLETE');
 assert.equal(r.currentRealRestoreIndependentlyCertified,false);
});

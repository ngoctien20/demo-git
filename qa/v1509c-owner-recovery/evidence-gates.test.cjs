'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspectG23Intake,inspectRecoveryIntake,ROLES,SYNTHETIC}=require('./evidence-gates.cjs');
const NOW=Date.parse('2026-11-16T10:20:00+09:00');
const scope=()=>({tenantRef:'QA_TENANT_A',storeRef:'QA_STORE_A',ownerRef:'QA_OWNER_A',
 providerAccountRef:'QA_PROVIDER_A',botRef:'QA_BOT_A',channel:'zalo_bot',
 eventRef:'QA_EVENT_01',challengeRef:'QA_CHALLENGE_01'});
function proof(key,index){
 return {source:ROLES[key],receiptRef:'QA_RECEIPT_'+index,
  issuerRef:'QA_ISSUER_'+index,tenantRef:'QA_TENANT_A',storeRef:'QA_STORE_A',
  ownerRef:'QA_OWNER_A',botRef:'QA_BOT_A',providerAccountRef:'QA_PROVIDER_A',
  eventRef:'QA_EVENT_01',challengeRef:'QA_CHALLENGE_01',
  observedAtMs:NOW-1000,expiresAtMs:NOW+60000,
  ...(key==='consent'?{decision:'EXPLICIT_QA_CONSENT_FIXTURE'}:{})};
}
function base(){
 return {mode:SYNTHETIC,scope:scope(),
  proofs:Object.fromEntries(Object.keys(ROLES).map((key,i)=>[key,proof(key,i+1)]))};
}
function g23(e){return inspectG23Intake(e,{now:()=>NOW});}
function recovery(){return {mode:SYNTHETIC,source:'DISPOSABLE_POSTGRESQL_17',
 backupMethod:'pg_dump_custom',restoreMethod:'pg_restore',hostedDatabaseTouched:false,
 targetIsDisposable:true,dumpSha256:'a'.repeat(64),verifiedDumpSha256:'a'.repeat(64),
 backupAtMs:NOW-50000,restoredAtMs:NOW-10000,restoreExitCode:0,
 originalCounts:{tenants:2,stores:3,store_memberships:4,products:3,orders:2,order_items:0},
 restoredCounts:{tenants:2,stores:3,store_memberships:4,products:3,orders:2,order_items:0},
 restoredRlsEnabled:true,restoredForceRlsEnabled:true,restoredStorePolicyPresent:true,
 restoredCompositeFkPresent:true,restoredCrossStoreDenied:true};}
function rec(e){return inspectRecoveryIntake(e,{now:()=>NOW});}
function blocked(name,mutate,reason){
 test(name,()=>{let e=base();mutate(e);let r=g23(e);
  assert.equal(r.status,'BLOCKED');assert.equal(r.reason,reason);
  assert.equal(r.independent_owner_certified,false);
  assert.equal(r.can_send,false);assert.equal(r.can_migrate,false);
 });}
test('5 synthetic independent issuer fixtures pass structure but NEVER real G2.3',()=>{
 const r=g23(base());assert.equal(r.status,'SYNTHETIC_INDEPENDENCE_SHAPE_READY_NOT_CERTIFIED');
 assert.equal(r.expected_proofs,5);assert.equal(r.provider_g23_certified,false);
 assert.equal(r.independent_owner_certified,false);assert.equal(r.hosted_backup_verified,false);
 assert.equal(r.can_migrate,false);assert.equal(r.can_send,false);
 assert.match(r.scope_fingerprint,/^[a-f0-9]{64}$/);
});
blocked('non-synthetic real claim refused',e=>{e.mode='REAL_HOSTED_CERTIFIED'},'PRIVATE_HOSTED_VERIFICATION_REQUIRED');
blocked('missing owner consent refused',e=>{delete e.proofs.consent},'MISSING_INDEPENDENT_PROOF');
blocked('missing ingress proof refused',e=>{delete e.proofs.ingress},'MISSING_INDEPENDENT_PROOF');
blocked('missing canonical Store proof refused',e=>{delete e.proofs.store},'MISSING_INDEPENDENT_PROOF');
blocked('missing provider account proof refused',e=>{delete e.proofs.provider},'MISSING_INDEPENDENT_PROOF');
blocked('missing Auth proof refused',e=>{delete e.proofs.auth},'MISSING_INDEPENDENT_PROOF');
blocked('missing store ref refused',e=>{e.scope.storeRef=''},'INVALID_SCOPE');
blocked('wrong channel refused',e=>{e.scope.channel='telegram'},'INVALID_SCOPE');
blocked('stale receipt refused',e=>{e.proofs.provider.expiresAtMs=NOW-1},'PROOF_EXPIRED_FORGED_OR_NOT_INDEPENDENT');
blocked('unsigned issuer role refused',e=>{e.proofs.provider.source='CLIENT_SUPPLIED'},'PROOF_EXPIRED_FORGED_OR_NOT_INDEPENDENT');
blocked('two proofs from same issuer refused',e=>{e.proofs.provider.issuerRef=e.proofs.auth.issuerRef},'PROOF_EXPIRED_FORGED_OR_NOT_INDEPENDENT');
blocked('cross tenant proof refused',e=>{e.proofs.store.tenantRef='QA_TENANT_B'},'CROSS_STORE_PROOF');
blocked('cross store proof refused',e=>{e.proofs.store.storeRef='QA_STORE_B'},'CROSS_STORE_PROOF');
blocked('foreign owner consent refused',e=>{e.proofs.consent.ownerRef='QA_OWNER_B'},'CROSS_STORE_PROOF');
blocked('provider account mismatch refused',e=>{e.proofs.provider.providerAccountRef='QA_PROVIDER_B'},'PROVIDER_BINDING_MISMATCH');
blocked('bot reference mismatch refused',e=>{e.proofs.ingress.botRef='QA_BOT_B'},'PROVIDER_BINDING_MISMATCH');
blocked('replayed inbound event refused',e=>{e.proofs.ingress.eventRef='QA_EVENT_REPLAY'},'UNTRUSTED_EVENT_BINDING');
blocked('mismatched challenge refused',e=>{e.proofs.ingress.challengeRef='QA_CHALLENGE_OTHER'},'UNTRUSTED_EVENT_BINDING');
blocked('QA paired state not independent proof',e=>{e.proofs.consent.decision='PAIRED'},'CONSENT_NOT_ESTABLISHED');
blocked('QA confirmed status not independent proof',e=>{e.proofs.consent.decision='CONFIRMED'},'CONSENT_NOT_ESTABLISHED');
blocked('JWT input rejected',e=>{e.raw_jwt='dummy'},'INVALID_OR_SENSITIVE_INPUT');
blocked('owner phone metadata rejected',e=>{e.scope.phone='fake'},'INVALID_OR_SENSITIVE_INPUT');
blocked('provider token metadata rejected',e=>{e.proofs.provider.access_token='fake'},'INVALID_OR_SENSITIVE_INPUT');
blocked('future observation rejected',e=>{e.proofs.provider.observedAtMs=NOW+1},'PROOF_EXPIRED_FORGED_OR_NOT_INDEPENDENT');
test('independent Store scope hashes do not collide',()=>{
 const a=base(),b=base();b.scope.storeRef='QA_STORE_B';
 for(const p of Object.values(b.proofs))p.storeRef='QA_STORE_B';
 assert.notEqual(g23(a).scope_fingerprint,g23(b).scope_fingerprint);
});
test('synthetic recovery shape PASS never means hosted backup',()=>{
 const r=rec(recovery());assert.equal(r.status,'SYNTHETIC_RESTORE_RECEIPT_READY_NOT_HOSTED');
 assert.equal(r.hosted_backup_verified,false);assert.equal(r.hosted_restore_rehearsed,false);
 assert.equal(r.can_migrate,false);assert.equal(r.can_send,false);assert.equal(r.checksum_verified,true);
});
function rblock(name,patch,reason){
 test(name,()=>{let e=recovery();patch(e);let r=rec(e);
  assert.equal(r.status,'BLOCKED');assert.equal(r.reason,reason);
  assert.equal(r.hosted_backup_verified,false);assert.equal(r.can_migrate,false);
 });}
rblock('production target refused',e=>{e.mode='HOSTED'},'NOT_EPHEMERAL_RECOVERY_EVIDENCE');
rblock('hosted touched refused',e=>{e.hostedDatabaseTouched=true},'NOT_EPHEMERAL_RECOVERY_EVIDENCE');
rblock('non-disposable target refused',e=>{e.targetIsDisposable=false},'NOT_EPHEMERAL_RECOVERY_EVIDENCE');
rblock('backup method mismatch refused',e=>{e.backupMethod='snapshot_assumed'},'NOT_EPHEMERAL_RECOVERY_EVIDENCE');
rblock('restore method mismatch refused',e=>{e.restoreMethod='none'},'NOT_EPHEMERAL_RECOVERY_EVIDENCE');
rblock('missing checksum refused',e=>{e.dumpSha256=''},'BACKUP_INTEGRITY_MISMATCH');
rblock('different checksum refused',e=>{e.verifiedDumpSha256='b'.repeat(64)},'BACKUP_INTEGRITY_MISMATCH');
rblock('restore predates dump refused',e=>{e.restoredAtMs=NOW-60000},'RESTORE_TIMELINE_INVALID');
rblock('future restore timestamp refused',e=>{e.restoredAtMs=NOW+1000},'RESTORE_TIMELINE_INVALID');
rblock('restore command failed refused',e=>{e.restoreExitCode=1},'RESTORE_ROW_COUNT_MISMATCH');
rblock('row-count mismatch refused',e=>{e.restoredCounts.products=2},'RESTORE_ROW_COUNT_MISMATCH');
rblock('missing table count refused',e=>{delete e.restoredCounts.orders},'RESTORE_ROW_COUNT_MISMATCH');
rblock('RLS disabled refused',e=>{e.restoredRlsEnabled=false},'RESTORED_SECURITY_CONTRACT_MISMATCH');
rblock('FORCE RLS disabled refused',e=>{e.restoredForceRlsEnabled=false},'RESTORED_SECURITY_CONTRACT_MISMATCH');
rblock('missing Store policy refused',e=>{e.restoredStorePolicyPresent=false},'RESTORED_SECURITY_CONTRACT_MISMATCH');
rblock('missing composite FK refused',e=>{e.restoredCompositeFkPresent=false},'RESTORED_SECURITY_CONTRACT_MISMATCH');
rblock('cross-store isolation not retested refused',e=>{e.restoredCrossStoreDenied=false},'RESTORED_SECURITY_CONTRACT_MISMATCH');
rblock('credential field in recovery metadata rejected',e=>{e.secret='fake'},'INVALID_OR_SENSITIVE_INPUT');

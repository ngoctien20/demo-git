import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectBackupInventory, defaultRecoveryDecision } from './backup-inventory.mjs';
const endpoint = 'https://api.supabase.com/v1/projects/ifxlvrhyjhbzbrkdsida/database/backups';
const token = 'PRIVATE_TEST_TOKEN_WITH_NO_REAL_CREDENTIALS';
const okBody = { region:'ap-southeast-1', pitr_enabled:false,
  backups:[{id:321,is_physical_backup:true,status:'COMPLETED',inserted_at:'2026-11-17T01:00:00Z'},
           {id:322,is_physical_backup:true,status:'PENDING',inserted_at:'2026-11-17T02:00:00Z'}] };
const fixture = (overrides={}) => {
  const calls = [];
  const fetchImpl = async (url,opts) => {
    calls.push({url,opts});
    if (overrides.throws) throw new Error('SECRET:'+token);
    return {status:overrides.status??200,json:async()=>overrides.body??okBody};
  };
  return {calls, params:{fetchImpl,token,endpoint}};
};
const deny = r => {
  assert.equal(r.can_migrate,false);assert.equal(r.can_restore,false);
  assert.equal(r.can_accept_real_jwt,false);assert.equal(r.can_send,false);
  assert.equal(JSON.stringify(r).includes(token),false);
};
test('private backup list GET returns metadata only and never authenticates restore',async()=>{
 const x=fixture();const r=await inspectBackupInventory(x.params);
 assert.equal(r.status,'INVENTORY_OBSERVED_RESTORE_UNVERIFIED');
 assert.equal(r.completed_backup_count,1);assert.equal(r.pitr_enabled,false);
 assert.equal(r.latest_completed_utc,'2026-11-17T01:00:00.000Z');
 assert.equal(x.calls.length,1);assert.equal(x.calls[0].opts.method,'GET');
 assert.equal(x.calls[0].opts.redirect,'error');
 assert.equal(x.calls[0].opts.cache,'no-store');
 assert.equal(x.calls[0].url,endpoint);deny(r);
 assert.equal(JSON.stringify(r).includes('321'),false);
});
test('empty backup list is not a restore proof',async()=>{const x=fixture({body:{backups:[],pitr_enabled:false}});const r=await inspectBackupInventory(x.params);assert.equal(r.completed_backup_count,0);deny(r)});
test('PITR enabled is still not restore proof',async()=>{const x=fixture({body:{...okBody,pitr_enabled:true}});const r=await inspectBackupInventory(x.params);assert.equal(r.pitr_enabled,true);deny(r)});
for(const [reason,status]of [['UNAUTHORIZED',401],['FORBIDDEN',403],['RATE_LIMIT',429],['SERVER_ERROR',500]])test('HTTP '+reason+' is blocked',async()=>{const x=fixture({status});const r=await inspectBackupInventory(x.params);assert.equal(r.status,'BLOCKED');deny(r)});
for(const uri of [
 'http://api.supabase.com/v1/projects/ifxlvrhyjhbzbrkdsida/database/backups',
 'https://api.supabase.com.evil.example/v1/projects/ifxlvrhyjhbzbrkdsida/database/backups',
 'https://api.supabase.com/v1/projects/other/database/backups',
 'https://api.supabase.com/v1/projects/ifxlvrhyjhbzbrkdsida/database/backups?token=a',
])test('reject non-allowlisted backup endpoint',async()=>{const x=fixture();x.params.endpoint=uri;const r=await inspectBackupInventory(x.params);assert.equal(r.reason,'MANAGEMENT_ENDPOINT_NOT_ALLOWLISTED');assert.equal(x.calls.length,0);deny(r)});
for(const bad of [null,'','a','Bearer spaces are bad','newline\nattack','carriage\rreturn'])test('reject malformed or missing token',async()=>{const x=fixture();x.params.token=bad;const r=await inspectBackupInventory(x.params);assert.equal(r.status,'BLOCKED');assert.equal(x.calls.length,0);deny(r)});
test('reject malformed backup list',async()=>{const x=fixture({body:{backups:'fake',pitr_enabled:false}});const r=await inspectBackupInventory(x.params);assert.equal(r.status,'BLOCKED');deny(r)});
test('reject unvalidated backup status',async()=>{const x=fixture({body:{backups:[{id:42,status:'MAGIC',is_physical_backup:true,inserted_at:'2026-11-17T01:00:00Z'}],pitr_enabled:false}});const r=await inspectBackupInventory(x.params);assert.equal(r.status,'BLOCKED');deny(r)});
test('reject malformed inserted_at',async()=>{const x=fixture({body:{backups:[{id:42,status:'COMPLETED',is_physical_backup:true,inserted_at:'not-a-date'}],pitr_enabled:false}});const r=await inspectBackupInventory(x.params);assert.equal(r.status,'BLOCKED');deny(r)});
test('network errors never expose secrets',async()=>{const x=fixture({throws:true});const r=await inspectBackupInventory(x.params);assert.equal(r.reason,'PRIVATE_BACKUP_READ_FAILED_CLOSED');deny(r)});
test('null input rejected',async()=>{const r=await inspectBackupInventory(null);assert.equal(r.status,'BLOCKED');deny(r)});
test('unconditional restoration decision denied',()=>deny(defaultRecoveryDecision()));

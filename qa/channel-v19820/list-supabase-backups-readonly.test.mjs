import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeBackupResponse,listBackupInventoryReadonly,API_URL,STAGING_PROJECT_REF}
 from './list-supabase-backups-readonly.mjs';

const NOW='2026-11-21T10:00:00.000Z';
const response=()=>({
 region:'ap-southeast-1',pitr_enabled:false,walg_enabled:false,
 backups:[
  {id:88001,is_physical_backup:true,status:'COMPLETED',inserted_at:'2026-11-20T05:00:00Z'},
  {id:88002,is_physical_backup:true,status:'FAILED',inserted_at:'2026-11-21T05:00:00Z'},
  {id:88003,is_physical_backup:true,status:'COMPLETED',inserted_at:'2026-11-19T05:00:00Z'}
 ],
 physical_backup_data:{earliest_physical_backup_date_unix:1790000000,latest_physical_backup_date_unix:1794000000},
 url:'https://sensitive.invalid/download?signature=secret'
});
const deny=x=>{
 assert.equal(x.decision,'NO_GO');
 assert.equal(x.can_restore_or_migrate,false);
 assert.equal(x.independent_restore_verified,false);
 assert.equal(x.real_owner_a_b_verified,false);
 assert.equal(x.artifact_digest_verified,false);
};
test('synthetic official API schema normalized, no restoration permission',()=>{
 const r=summarizeBackupResponse(response(),NOW);
 assert.equal(r.schema_recognized,true);
 assert.equal(r.project_ref,STAGING_PROJECT_REF);
 assert.equal(r.api_listed_backup_count,3);
 assert.equal(r.completed_backup_count,2);
 assert.equal(r.latest_completed_backup_at,'2026-11-20T05:00:00.000Z');
 deny(r);
 const text=JSON.stringify(r);
 assert.ok(!text.includes('88001')&&!text.includes('sensitive.invalid')&&!text.includes('signature=secret'));
});
test('PITR is information, not backup or restore proof',()=>{
 const a=response();a.pitr_enabled=true;a.walg_enabled=true;a.backups=[];
 const r=summarizeBackupResponse(a,NOW);
 assert.equal(r.pitr_enabled,true);
 assert.equal(r.api_listed_backup_count,0);
 deny(r);
});
test('no backups listed must not claim a backup exists',()=>{
 const a=response();a.backups=[];
 const r=summarizeBackupResponse(a,NOW);
 assert.equal(r.completed_backup_count,0);
 assert.equal(r.latest_completed_backup_at,null);deny(r);
});
for(const [name,mutate] of [
 ['null',()=>null],
 ['array',()=>[]],
 ['no region',()=>{const a=response();delete a.region;return a}],
 ['no PITR flag',()=>{const a=response();delete a.pitr_enabled;return a}],
 ['no WAL flag',()=>{const a=response();delete a.walg_enabled;return a}],
 ['missing backups list',()=>{const a=response();delete a.backups;return a}],
 ['malformed backups',()=>{const a=response();a.backups={};return a}],
 ['missing physical metadata',()=>{const a=response();delete a.physical_backup_data;return a}],
 ['unknown status',()=>{const a=response();a.backups[0].status='READY';return a}],
 ['malformed backup id',()=>{const a=response();a.backups[0].id='secret';return a}],
 ['malformed backup date',()=>{const a=response();a.backups[0].inserted_at='not-a-date';return a}],
 ['malformed backup physical type',()=>{const a=response();a.backups[0].is_physical_backup='yes';return a}],
 ['excessive backup array',()=>{const a=response();a.backups=new Array(1001).fill(a.backups[0]);return a}]
])test('reject malformed source format: '+name,()=>{
 const r=summarizeBackupResponse(mutate(),NOW);
 assert.equal(r.schema_recognized,false);
 assert.equal(r.api_listed_backup_count,null);deny(r);
});
test('reject invalid physical window timestamps but retain inventory',()=>{
 const a=response();a.physical_backup_data.earliest_physical_backup_date_unix=-4;
 const r=summarizeBackupResponse(a,NOW);
 assert.equal(r.physical_window_earliest_unix,null);
 assert.equal(r.schema_recognized,true);deny(r);
});
test('GET uses exact authenticated Management API endpoint, no fallback hosts',async()=>{
 let called=0;
 const result=await listBackupInventoryReadonly({token:'sensitive-token-123456789',observedAt:NOW,
  fetchImpl:async(url,opts)=>{
    called++;
    assert.equal(url,'https://api.supabase.com/v1/projects/'+STAGING_PROJECT_REF+'/database/backups');
    assert.equal(url,API_URL);
    assert.equal(opts.method,'GET');
    assert.equal(opts.redirect,'error');
    assert.equal(opts.headers.Authorization,'Bearer sensitive-token-123456789');
    return {ok:true,status:200,json:async()=>response()};
  }});
 assert.equal(called,1);
 assert.equal(result.source,'UNSIGNED_OPERATOR_LOCAL_MANAGEMENT_API_GET');
 assert.equal(result.api_listed_backup_count,3);
 assert.ok(!JSON.stringify(result).includes('sensitive-token'));
 deny(result);
});
for(const status of [401,403,429,500])test('HTTP status '+status+' is opaque fail closed',async()=>{
 await assert.rejects(
  listBackupInventoryReadonly({token:'abcdefghijklmnop',fetchImpl:async()=>({
   ok:false,status,json:async()=>{throw Error('raw secret must not be read')}
  })}),
  new RegExp('BACKUP_READ_ONLY_API_STATUS_'+status));
});
test('missing token blocks request before network',async()=>{
 let called=false;
 await assert.rejects(
   listBackupInventoryReadonly({token:'',fetchImpl:async()=>{called=true}}),
   /BACKUP_READ_ONLY_TOKEN_REQUIRED/);
 assert.equal(called,false);
});
test('short token blocks request',async()=>{
 await assert.rejects(listBackupInventoryReadonly({token:'abc',fetchImpl:async()=>{throw Error('called')}}),
 /BACKUP_READ_ONLY_TOKEN_REQUIRED/);
});
test('no direct provider sends or database writes are represented',()=>{
 const output=summarizeBackupResponse(response(),NOW);
 assert.equal('provider_send' in output,false);
 assert.equal('order_write' in output,false);
 assert.equal(output.decision,'NO_GO');
});

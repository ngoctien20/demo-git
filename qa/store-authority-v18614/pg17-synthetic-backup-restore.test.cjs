'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const api=require('./pg17-synthetic-backup-restore.cjs');
const good={...api.REQUIRED_ENV};

test('strict CI-only local PostgreSQL fixture acceptance',()=>assert.equal(api.assertDisposable(good),true));
for(const [name,value] of Object.entries(api.REQUIRED_ENV)) {
 test(`refuse non-ephemeral or missing ${name}`,()=>{
  const e={...good,[name]:name==='PGPORT'?'5433':''};
  assert.throws(()=>api.assertDisposable(e),/NO_GO/);
 });
}
for(const name of api.BANNED_ENV) {
 test(`refuse external secret variable ${name}`,()=>{
  assert.throws(()=>api.assertDisposable({...good,[name]:'NOT_A_REAL_SECRET'}),/NO_GO/);
 });
}
test('fixture includes duplicate Store-local SKU with divergent prices',()=>{
 assert(api.FIXTURE.includes("'STORE_A','SKU-001',159000"));
 assert(api.FIXTURE.includes("'STORE_B','SKU-001',189000"));
 assert(api.FIXTURE.includes('PRIMARY KEY (tenant_id,store_id,sku)'));
});
test('fixtures include exact composite order and product foreign keys',()=>{
 assert(api.FIXTURE.includes('FOREIGN KEY (tenant_id,store_id,order_id)'));
 assert(api.FIXTURE.includes('FOREIGN KEY (tenant_id,store_id,sku)'));
});
test('fixture enables AND-check restrictive RLS',()=>{
 assert(api.FIXTURE.includes('ENABLE ROW LEVEL SECURITY'));
 assert(api.FIXTURE.includes('FORCE ROW LEVEL SECURITY'));
 assert(api.FIXTURE.includes('AS RESTRICTIVE'));
 assert(api.FIXTURE.includes("current_setting('t404.store_id',true)"));
});
test('schema fingerprint preserves constraint, policy and RLS info',()=>{
 assert(api.STRUCTURE_SNAPSHOT.includes('pg_get_constraintdef'));
 assert(api.STRUCTURE_SNAPSHOT.includes('pg_policies'));
 assert(api.STRUCTURE_SNAPSHOT.includes('relforcerowsecurity'));
});
test('deterministic SHA256 for synthetic fixture only',()=>{
 assert.equal(api.sha256('synthetic'),api.sha256(Buffer.from('synthetic')));
 assert.notEqual(api.sha256('synthetic'),api.sha256('synthetic-changed'));
});
test('no production authorization or claimed live restore',()=>{
 for(const s of ['LIVE_SUPABASE_BACKUP','LIVE_SUPABASE_RESTORE','REAL_STORE_RLS','PRODUCTION_READINESS'])assert(api.OUTSIDE_SCOPE.includes(s));
});
test('explicit source/restore names contain disposable marker',()=>{
 assert.match(api.DB_SOURCE,/^t404_v18614_/);
 assert.match(api.DB_RESTORE,/^t404_v18614_/);
 assert.notEqual(api.DB_SOURCE,api.DB_RESTORE);
});
test('script hardcodes local Docker postgres:17 and has no external network URLs',()=>{
 const fs=require('node:fs'),source=fs.readFileSync(require.resolve('./pg17-synthetic-backup-restore.cjs'),'utf8');
 assert(source.includes("'--network=host'"));
 assert(source.includes("'postgres:17'"));
 assert(!source.includes('supabase.co'));
 assert(!source.includes('onrender.com'));
 assert(!source.includes('cloudflare.com'));
 assert(!source.includes('api.github.com'));
});

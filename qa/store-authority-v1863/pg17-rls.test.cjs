'use strict';
// PostgreSQL 17 disposable CI only. This intentionally does NOT connect to Supabase.
const {test,before} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const BASE = path.join(__dirname,'pg17-fixture.sql');
const users = Object.freeze({
 a:'30000000-0000-4000-8000-000000000001',
 b:'30000000-0000-4000-8000-000000000002',
 c:'30000000-0000-4000-8000-000000000003',
 manager:'30000000-0000-4000-8000-000000000004',
 staff:'30000000-0000-4000-8000-000000000005',
 revoked:'30000000-0000-4000-8000-000000000006'
});
function psql({sql='',file}={}){
 const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1'];
 if(file)args.push('-f',file);else args.push('-c',sql);
 const r=spawnSync('psql',args,{encoding:'utf8',timeout:15000,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'postgres',PGDATABASE:'tien404_v1863_qa',PGPASSWORD:'v1863-disposable-only'}});
 if(r.error)throw r.error;
 return {exit:r.status,stdout:r.stdout.trim(),stderr:r.stderr.trim()};
}
function asActor(id,query){
 // Only fixed synthetic IDs used here. In production, auth JWT/session validation MUST be performed server side.
 const identity=id ? `SET LOCAL request.jwt.claim.sub = '${users[id]}';` : '';
 return psql({sql:`BEGIN; SET LOCAL ROLE v1863_authenticated; ${identity} ${query}; ROLLBACK;`});
}
function expectCount(actor,table,count){
 const result=asActor(actor,`SELECT count(*) FROM v1863_qa.${table}`);
 assert.equal(result.exit,0,result.stderr);
 assert.equal(result.stdout,String(count),`actor=${actor} table=${table} result=${result.stdout}`);
}
function expectedError(query,pattern){
 const result=psql({sql:query});
 assert.notEqual(result.exit,0,`Expected failure, got: ${result.stdout}`);
 assert.match(result.stderr,pattern);
}
before(()=>{if(process.env.V1863_DISPOSABLE_POSTGRES!=='true')throw new Error('REFUSE: this suite requires V1863_DISPOSABLE_POSTGRES=true'); const r=psql({file:BASE});assert.equal(r.exit,0,r.stderr);});
test('Owner A sees only one same-tenant store',()=>expectCount('a','stores',1));
test('Owner B sees only its same-tenant store',()=>expectCount('b','stores',1));
test('Owner C sees only another tenant',()=>expectCount('c','stores',1));
test('A sees only A order',()=>expectCount('a','orders',1));
test('B sees only B order',()=>expectCount('b','orders',1));
test('C cannot read A/B orders',()=>expectCount('c','orders',1));
test('A sees only A product',()=>expectCount('a','products',1));
test('B sees only B product',()=>expectCount('b','products',1));
test('manager A reads A order',()=>expectCount('manager','orders',1));
test('staff A cannot read private orders',()=>expectCount('staff','orders',0));
test('staff A can read only A product',()=>expectCount('staff','products',1));
test('revoked membership sees no orders',()=>expectCount('revoked','orders',0));
test('revoked membership sees no product',()=>expectCount('revoked','products',0));
test('no JWT subject fails closed',()=>expectCount(null,'orders',0));
test('anonymous store membership unauthorized',()=>expectCount(null,'stores',0));
test('Page A visible to owner A only',()=>expectCount('a','page_connections',1));
test('Page B visible to owner B only',()=>expectCount('b','page_connections',1));
test('staff cannot manage Page by SELECT',()=>expectCount('staff','page_connections',0));
test('Owner A cannot directly write orders',()=>{
 const r=asActor('a',`INSERT INTO v1863_qa.orders VALUES ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','forged')`);
 assert.notEqual(r.exit,0); assert.match(r.stderr,/permission denied/);
});
test('Owner A cannot directly update orders',()=>{
 const r=asActor('a',`UPDATE v1863_qa.orders SET description='forged'`);
 assert.notEqual(r.exit,0); assert.match(r.stderr,/permission denied/);
});
test('cross-tenant/store FK blocks malformed order tuple',()=>{
 expectedError(`INSERT INTO v1863_qa.orders VALUES ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','invalid')`,/foreign key constraint/);
});
test('unique active Page blocks cross-store takeover',()=>{
 expectedError(`INSERT INTO v1863_qa.page_connections VALUES ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','messenger','mock-page-a','connected')`,/duplicate key value violates unique constraint/);
});
test('same Page cannot be reauthorized in competing store',()=>{
 expectedError(`INSERT INTO v1863_qa.page_connections VALUES ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','messenger','mock-page-a','reauthorization_required')`,/duplicate key value violates unique constraint/);
});
test('all RLS tables enabled and test role has no write privileges',()=>{
 const r=psql({sql:"SELECT (SELECT count(*) FROM pg_class WHERE relnamespace='v1863_qa'::regnamespace AND relname IN ('stores','store_memberships','orders','products','page_connections') AND relrowsecurity)=5 AND NOT has_table_privilege('v1863_authenticated','v1863_qa.orders','INSERT,UPDATE,DELETE')"});
 assert.equal(r.exit,0,r.stderr);assert.equal(r.stdout,'t');
});

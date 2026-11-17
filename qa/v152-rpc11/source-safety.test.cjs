'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,sql=fs.readFileSync(path.join(root,'pg17-store-writer-v2-disposable-only.sql'),'utf8');
const sh=fs.readFileSync(path.join(root,'ci-pg17-store-writer-v2-rehearsal.sh'),'utf8');
const ci=fs.readFileSync(path.join(root,'../../.github/workflows/v152-rpc11-store-writer-disposable-nosend.yml'),'utf8');
const docs=fs.readFileSync(path.join(root,'../../docs/ai-handoff/T404_RPC11_STORE_WRITER_DISPOSABLE_CHECKPOINT.md'),'utf8');
for(const [name,s] of [['SQL',sql],['shell',sh],['workflow',ci]]){
 test(`${name}: no Supabase project ref or hosted url`,()=>{assert.doesNotMatch(s,/ifxlvrhyjhbzbrkdsida|\.supabase\.co|ngoctien20\.app\.n8n\.cloud/);});
 test(`${name}: no hosted deploy tool`,()=>{assert.doesNotMatch(s,/\bcurl\s|\bwget\s|\bpg_dump\b|\bpg_restore\b|\bsupabase db push\b/);});
}
for(const k of ['t404_rpc8_ci','RPC8_DISPOSABLE','postgres']){
 test(`SQL synthetic guard requires ${k}`,()=>assert.ok(sql.includes(k)));
 test(`shell synthetic guard requires ${k}`,()=>assert.ok(sh.includes(k)));
}
test('SQL explicitly refuses hosted',()=>assert.match(sql,/RPC11_REFUSES_HOSTED_OR_INCOMPLETE_SIX_SURFACE_CUTOVER/));
test('SQL checks 6 scoped tables',()=>assert.match(sql,/\('products','orders','customers','order_items','conversations','messages'\)/));
test('SQL checks all six Store IDs are required',()=>assert.match(sql,/column_name='store_id' AND is_nullable='NO'/));
test('SQL confirms all six old tenant policies absent',()=>assert.match(sql,/messages_manager_read'\)\)<>0/));
test('writer is limited to private QA schema',()=>assert.doesNotMatch(sql,/\bCREATE FUNCTION public\./));
test('both functions are definer with empty search path',()=>{
 assert.equal((sql.match(/SECURITY DEFINER SET search_path = ''/g)||[]).length,2);
});
for(const name of ['create_product_store_v2','update_product_price_store_v2']){
 test(`${name} restricts public execution`,()=>assert.match(sql,new RegExp(`REVOKE ALL ON FUNCTION qa_rpc8\\.${name}\\(`)));
 test(`${name} grants only synthetic role`,()=>assert.match(sql,new RegExp(`GRANT EXECUTE ON FUNCTION qa_rpc8\\.${name}\\([^;]+TO qa_rpc8_user;`)));
}
for(const s of ['stores s','store_memberships sm','tenant_memberships tm']){
 test(`both writers use ${s}`,()=>assert.equal((sql.split(s).length-1)>=2,true));
}
test('both writers use share row locks to avoid revoke race',()=>assert.equal((sql.match(/FOR SHARE OF s,sm,tm/g)||[]).length,2));
test('both writers require store active',()=>assert.equal((sql.match(/s\.active/g)||[]).length>=2,true));
test('both writers require active store and tenant memberships',()=>{
 assert.equal((sql.match(/sm\.active AND sm\.role IN \('owner','manager'\)/g)||[]).length,2);
 assert.equal((sql.match(/tm\.active AND tm\.role IN \('owner','manager'\)/g)||[]).length,2);
});
test('SQL restricts every product write to tenant+store',()=>{
 assert.match(sql,/VALUES\(new_id,p_tenant,p_store,p_sku,p_price,p_stock\)/);
 assert.match(sql,/WHERE tenant_id=p_tenant AND store_id=p_store AND sku=p_sku/);
});
test('price update protects against stale data',()=>assert.match(sql,/AND price_vnd=p_expected_price/));
test('runner starts from existing base fixture',()=>{
 for(const file of ['qa/v152-rpc8/pg17-synthetic-legacy-fixture.sql','qa/v152-rpc8/pg17-m1-expand-disposable-only.sql','qa/v152-rpc9/pg17-prepare-synthetic-three-store.sql','qa/v152-rpc10/pg17-six-surface-fixture.sql','qa/v152-rpc10/pg17-six-surface-atomic-cutover-disposable-only.sql'])
 assert.ok(sh.includes(file),file);
});
for(const phrase of ['creates same SKU Store B','cannot create product in Store B','cannot update Store B price','cannot create for Tenant C','direct INSERT denied','direct UPDATE denied','stale expected price denied','disabled Store cannot write','revoked membership blocks insert','revoked membership blocks price edit','Store B unchanged after revoke']){
 test(`negative/positive scenario present: ${phrase}`,()=>assert.ok(sh.includes(phrase)));
}
test('runner does not require or use JWT or real credentials',()=>assert.doesNotMatch(sh,/\bauth\.users\b|\bservice_role\b|\baccess_token\b|\bauth\.jwt\b/));
test('docs warn synthetic_actor is not real authentication',()=>assert.match(docs,/intentionally \*\*insecure for production\*\*/));
test('CI read-only github permissions',()=>assert.match(ci,/permissions:\s*\n\s*contents: read/));
test('CI isolated Postgres 17',()=>assert.match(ci,/image: postgres:17/));
test('CI never applies hosted migration',()=>assert.doesNotMatch(ci,/supabase\/setup-cli|supabase db push|apply_migration|deploy-production|service_role/));
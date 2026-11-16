import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const here=new URL('.',import.meta.url);
const fixture=readFileSync(new URL('postgres-fixture.sql',here),'utf8');
const assertions=readFileSync(new URL('test-store-rls.sql',here),'utf8');
const shell=readFileSync(new URL('run-disposable.sh',here),'utf8');
const doc=readFileSync(new URL('../../docs/ai-handoff/V16_10_REAL_OWNER_DISPOSABLE_RECOVERY_JWT_RLS_PREFLIGHT_CHECKPOINT.md',here),'utf8');
const evidence=JSON.parse(readFileSync(new URL('../../docs/ai-handoff/V16_10_PRIVATE_OPERATOR_AUTHORITY_EVIDENCE_MANIFEST.json',here),'utf8'));
test('01 evidence contract source-only',()=>assert.equal(evidence.source_only,true));
test('02 11 evidence types absent',()=>{
 assert.equal(evidence.security_gates.length,11);
 assert(evidence.security_gates.every(x=>x.status==='MISSING'&&x.private_evidence_locator===null));
});
test('03 final hosted release explicitly NO_GO',()=>assert.equal(evidence.release_decision,'NO_GO'));
test('04 no hosted migration or backup represented',()=>{
 assert.equal(evidence.hosted_sql_applied,false);
 assert.equal(evidence.hosted_backup_downloaded,false);
});
test('05 no real JWT or hosted RLS represented',()=>{
 assert.equal(evidence.real_jwt_verified,false);
 assert.equal(evidence.hosted_rls_certified,false);
});
test('06 SQL fixture refuses non-disposable DB',()=>assert.match(fixture,/current_database\(\) <> 't404_v1610_disposable'/));
test('07 SQL fixture roles are not privileged',()=>assert.match(fixture,/NOBYPASSRLS/));
test('08 fixture is not actual Supabase auth',()=>{
 assert.match(fixture,/CREATE FUNCTION qa_auth\.uid\(\)/);
 assert.doesNotMatch(fixture,/CREATE FUNCTION auth\.uid\(\)/);
});
test('09 fixture same Tenant A and B membership scope',()=>assert.match(fixture,/PRIMARY KEY\(tenant_id,store_id,user_id\)/));
test('10 Store FK and composite SKU uniqueness in fixture',()=>{
 assert.match(fixture,/UNIQUE\(tenant_id,store_id,sku\)/);
 assert.match(fixture,/FOREIGN KEY\(tenant_id,store_id\) REFERENCES qa\.stores/);
});
test('11 order/customer Store FK exists',()=>assert.match(fixture,/FOREIGN KEY\(tenant_id,store_id,customer_id\) REFERENCES qa\.customers/));
test('12 products READ and WRITE RLS policy both present',()=>{
 assert.match(fixture,/CREATE POLICY products_view_store/);
 assert.match(fixture,/CREATE POLICY products_add_store/);
 assert.match(fixture,/CREATE POLICY products_update_store/);
 assert.match(fixture,/WITH CHECK/);
});
test('13 tests impersonate non-bypass RLS role',()=>assert.match(assertions,/SET LOCAL ROLE t404_authenticated/g));
test('14 tests deny Shop A reading Shop B',()=>{
 assert.match(assertions,/A sees cross Store products/);
 assert.match(assertions,/A updated Shop B/);
});
test('15 tests deny Shop B reading Shop A and Shop C',()=>{
 assert.match(assertions,/B cross Store products/);
 assert.match(assertions,/cross tenant product/);
});
test('16 tests include revoked membership and missing claim',()=>{
 assert.match(assertions,/revoked B still sees products/);
 assert.match(assertions,/anonymous claim exposed product/);
});
test('17 tests block cross-Store customer order association',()=>assert.match(assertions,/cross-store Customer FK accepted/));
test('18 restore does not overwrite existing database',()=>assert.match(shell,/preexisting database/));
test('19 local test enforced by host and runner gating',()=>{
 assert.match(shell,/PGHOST.*127\.0\.0\.1/);
 assert.match(shell,/GITHUB_REPOSITORY.*ngoctien20\/demo-git/);
 assert.match(shell,/T404_DISPOSABLE_QA_ONLY/);
});
test('20 backup and restore are synthetic local only',()=>{
 assert.match(shell,/pg_dump/);
 assert.match(shell,/sha256sum/);
 assert.match(shell,/pg_restore/);
 assert.match(shell,/t404_v1610_restored/);
});
test('21 no cross cloud remote SQL endpoint in scripts',()=>{
 for(const s of [fixture,assertions,shell]){
  assert.doesNotMatch(s,/supabase\.co|postgresql:\/\/|api\.openai\.com|graph\.facebook\.com/);
 }
});
test('22 hosted proof and private operator stay missing',()=>{
 assert.match(doc,/Real Store Authority/);
 assert.match(doc,/BLOCKED/);
 assert.match(doc,/not signed\/authenticated JWT/i);
});
test('23 no production credentials in new files',()=>{
 const all=fixture+assertions+shell+doc;
 assert.doesNotMatch(all,/sk-[A-Za-z0-9]{20}|BEGIN PRIVATE KEY|Bearer [A-Za-z0-9]{20}/);
});
test('24 user-facing evidence file contains no verified real claims',()=>{
 for(const v of ['hosted_sql_applied','hosted_backup_downloaded','real_jwt_verified','hosted_rls_certified'])
 assert.equal(evidence[v],false);
});

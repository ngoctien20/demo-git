'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.resolve(__dirname,'pg17-store-product-invoker-rehearsal.sql'),'utf8');
const strip=sql.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n');
test('disposable PostgreSQL 17 schema is transactional and rolled back',()=>{
 assert.match(strip,/^\s*BEGIN\s*;/m);
 assert.match(strip,/\bROLLBACK\s*;/);
 assert.match(sql,/CREATE SCHEMA qa_p0f;/);
 assert.match(sql,/PASS_DISPOSABLE_PG17_SECURITY_INVOKER_STORE_PRODUCT_FK_RLS_NO_HOSTED/);
});
test('least privilege function uses security invoker, not privileged definer',()=>{
 assert.match(strip,/SECURITY INVOKER SET search_path=''/);
 assert.doesNotMatch(strip,/\bSECURITY DEFINER\b/);
 assert.match(strip,/REVOKE ALL ON FUNCTION.*FROM PUBLIC/);
 assert.match(strip,/GRANT EXECUTE ON FUNCTION.*TO authenticated/);
});
test('store and tenant are bound for price updates and composite key',()=>{
 assert.match(strip,/WHERE tenant_id=p_tenant AND store_id=p_store AND sku=p_sku/);
 assert.match(strip,/FOREIGN KEY\(tenant_id,store_id\) REFERENCES qa_p0f\.stores/);
 assert.match(strip,/UNIQUE\(tenant_id,store_id,sku\)/);
});
test('read and write policies include store ownership and WITH CHECK',()=>{
 assert.match(strip,/CREATE POLICY product_member_read/);
 assert.match(strip,/CREATE POLICY product_owner_manager_update/);
 assert.match(strip,/WITH CHECK\(/);
 assert.match(strip,/auth\.uid\(\)/);
});
test('direct update grant excludes store_id and stock_on_hand',()=>{
 assert.match(strip,/GRANT UPDATE\(name,price_vnd,updated_at\) ON qa_p0f\.products TO authenticated/);
 assert.doesNotMatch(strip,/GRANT UPDATE\(.*store_id/);
 assert.doesNotMatch(strip,/GRANT UPDATE\(.*stock_on_hand/);
});
test('synthetic test includes same Tenant Store A/B, cross Tenant C and revocation',()=>{
 assert.match(sql,/WRONG_STORE_WRITE_ALLOWED/);
 assert.match(sql,/CROSS_TENANT_WRITE_ALLOWED/);
 assert.match(sql,/PAUSED_STORE_CHANGED_PRICE/);
 assert.match(sql,/REVOKED_STORE_CHANGED_PRICE/);
 assert.match(sql,/STORE_REASSIGN_PERMISSION_ALLOWED/);
 assert.match(sql,/STALE_TIMESTAMP_ALLOWED/);
});
test('review-only source has no hosted connection, secret or real provider call',()=>{
 for(const s of ['ifxlvrhyjhbzbrkdsida','SUPABASE_SERVICE_ROLE_KEY',
 'https://', 'api.supabase.com', 'ZALO_BOT_TOKEN']){
  assert.equal(strip.includes(s),false,s);
 }
});

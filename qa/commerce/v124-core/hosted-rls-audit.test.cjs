'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const sql=readFileSync(join(__dirname,'hosted-rls-readonly-audit.sql'),'utf8');
const proposal=readFileSync(join(__dirname,'../../../docs/ai-handoff/V12_4R_3_CUSTOMER_HOSTED_RLS_APPROVAL_PROPOSAL.md'),'utf8');
test('Hosted SQL is read-only with four explicit rolled-back role simulations',()=>{
 const body=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 assert.equal((body.match(/BEGIN READ ONLY;/g)||[]).length,4);
 assert.equal((body.match(/ROLLBACK;/g)||[]).length,4);
 assert.equal((body.match(/SET LOCAL ROLE authenticated;/g)||[]).length,3);
 assert.equal((body.match(/SET LOCAL ROLE anon;/g)||[]).length,1);
 for(const x of [/INSERTs+INTO/i,/UPDATEs+w+s+SET/i,/DELETEs+FROM/i,
   /CREATEs+(?:ROLE|TABLE|POLICY)/i,/ALTERs+TABLE/i,/GRANTs+w+/i,/DROPs+w+/i])
  assert.ok(!x.test(body),String(x));
 assert.ok(body.includes('OFFSET 1 LIMIT 1'));
 assert.ok(body.includes('cross_shop_products'));
 assert.ok(body.includes('11111111-1111-4111-8111-111111111111'));
 assert.ok(body.includes('has_schema_privilege'));
});
test('Hosted catalog authorization proposal cannot be mistaken for approved migration',()=>{
 assert.ok(proposal.includes('NOT APPLIED'));
 assert.ok(proposal.includes('DO NOT RUN UNTIL EXPLICIT APPROVAL'));
 assert.ok(proposal.includes('NOLOGIN NOINHERIT NOBYPASSRLS'));
 assert.ok(proposal.includes('credential_ref'));
 assert.ok(proposal.includes('tenant_key='));
 assert.ok(proposal.includes('store_key='));
 assert.ok(proposal.includes('bot_key='));
 assert.ok(proposal.includes('PR #41'));
 assert.ok(proposal.includes('Rollback plan'));
 assert.ok(!proposal.includes('GRANT SELECT ON tien404_r1_qa.shop_bots'));
});

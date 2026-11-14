import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Pilot Google binding is RLS gated and never editable by browser',()=>{
 const s=read('qa/tester_portal/V12_4_1_TESTER_GOOGLE_SHEETS_BINDING_STAGING.sql');
 for(const required of [
  'REFERENCES auth.users(id)','ENABLE ROW LEVEL SECURITY','FORCE ROW LEVEL SECURITY',
  'FOR SELECT TO authenticated','user_id = (SELECT auth.uid())',
  "a.access_status='approved'","a.expires_at>now()",
  "t.module_id='sheets' AND t.active",'GRANT SELECT ON',
  'REVOKE ALL ON','access_status IN']) assert.ok(s.includes(required),required);
 assert.equal((s.match(/CREATE POLICY /g)||[]).length,1);
 assert.ok(!s.includes('GRANT INSERT'));
 assert.ok(!s.includes('GRANT UPDATE'));
 assert.ok(!s.includes('GRANT DELETE'));
 assert.ok(!s.includes('SECURITY DEFINER'));
});
test('Browser only links to bound private Google Sheet after verified RLS access',()=>{
 const s=read('assets/tester-qa-writable-sandbox.mjs');
 for(const required of [
  "state.client.auth.getUser()","state.access?.access_status==='approved'",
  "state.client.from('tien404_tester_google_sheets')",
  ".eq('user_id',uid).maybeSingle()",
  "record?.access_status==='ready'","Date.parse(record.expires_at)>Date.now()",
  "record.model_workflow_id==='8HtaQAJuZWKyNhXu'",
  "a.target='_blank'","a.rel='noopener noreferrer'",
  "tp-qa-sheet-link","tp-qa-local-details","Chưa tự đồng bộ"])assert.ok(s.includes(required),required);
 assert.ok(!s.includes("const target='https://docs.google.com/spreadsheets/d/17rjk"));
 assert.ok(!s.includes('service_role'));
 assert.ok(!s.includes('innerHTML'));
});
test('Four QA model tools point exclusively to the single tester workbook',()=>{
 const s=read('qa/n8n/AI_SALES_QA_SANDBOX_V12_4_TESTER_PILOT01.sdk.ts');
 assert.equal(s.split('17rjkZV_u9ye17BLimCePYC7EyZML2GlXSHfX8dFVTgM').length-1,4);
 assert.ok(!s.includes('1flbUFHb6ybJVLnnXTf3FQD70YNtd6MneL_xVpPYsscE'));
 assert.ok(!s.includes('KrSn4DNR9ALX5ng4'));
 assert.ok(s.includes("public:false"));
 const m=read('qa/n8n/TIEN404_QA_TESTER_PILOT01_SHEET_HEALTH_V12_4.sdk.ts');
 assert.ok(m.includes('17rjkZV_u9ye17BLimCePYC7EyZML2GlXSHfX8dFVTgM'));
 assert.ok(m.includes("operation:'read'"));
 assert.ok(!m.includes("operation:'append'"));
});

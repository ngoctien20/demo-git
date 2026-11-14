import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildTesterCsv} from '../assets/tester-report-csv.mjs';

test('CSV export preserves Vietnamese and quotes while blocking formula injection',()=>{
 const csv=buildTesterCsv([{
  created_at:'2026-11-14T11:00:00Z',run_id:'qa-run-1',user_id:'tester-1',
  case_id:'SQA01',outcome:'self_fail',
  feedback:'  =HYPERLINK("https://evil.example","click") và sai giá',self_reported:true
 }]);
 assert.ok(csv.startsWith('\uFEFF'));
 assert.ok(csv.includes('Tự đánh giá'));
 assert.ok(csv.includes('"\'  =HYPERLINK(""https://evil.example"",""click"") và sai giá"'));
 assert.ok(csv.includes('self_fail'));
 assert.ok(!csv.includes('qa_verified'));
});
test('CSV export rejects invalid input and does not export secret sources',()=>{
 assert.throws(()=>buildTesterCsv(null),/INVALID_ROWS/);
 const one=buildTesterCsv([{feedback:'-2+2',outcome:'blocked',self_reported:true}]);
 assert.ok(one.includes('"\'-2+2"'));
 assert.equal(one.trim().split('\r\n').length,2);
 const js=fs.readFileSync(new URL('../assets/tester-admin.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../tester-admin.html',import.meta.url),'utf8');
 assert.ok(html.includes('id="ta-export"'));
 assert.ok(html.includes('id="ta-case-readiness"'));
 assert.ok(js.includes("from('tien404_tester_staff')"));
 assert.ok(js.includes('activeStaff.data.staff_role'));
 assert.ok(js.includes('buildTesterCsv(rows)'));
 assert.ok(js.includes(".limit(500)"));
 assert.ok(!js.includes('service_role_key'));
 assert.ok(!js.includes('supabase.auth.admin'));
});

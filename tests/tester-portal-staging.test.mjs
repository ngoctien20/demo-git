import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const file=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Tester and Admin are locked by default and noindexed',()=>{
 for(const name of ['tester.html','tester-admin.html']){
  const html=file(name);
  assert.ok(html.includes('noindex,nofollow'));
  assert.ok(html.includes('name="viewport"'));
 }
 assert.ok(file('tester.html').includes('id="tp-workspace" class="tp-workspace" hidden'));
 assert.ok(file('tester.html').includes('id="tp-locked" class="tp-locked" hidden'));
 assert.ok(file('tester-admin.html').includes('id="ta-protected" hidden'));
});

test('Supabase user and tester access are checked before data loading',()=>{
 const js=file('assets/tester-portal.js');
 for(const value of ["from './auth-client.js'","auth.getUser()","from('tien404_tester_access')",
  "from('tien404_tester_staff')",'Date.parse(state.access.expires_at)>Date.now()',
  'workspace.hidden=true','isApproved()','tien404_tester_assignments',
  'tien404_tester_cases','tien404_tester_runs']){
  assert.ok(js.includes(value),value);
 }
 assert.ok(!js.includes('innerHTML'));
 assert.ok(!js.includes('supabase.auth.admin.'));
 assert.ok(!js.includes('sb_secret_'));
});

test('Tester results are self-reported and saved through Supabase RLS',()=>{
 const js=file('assets/tester-portal.js');
 for(const token of ['self_pass','self_fail','blocked','needs_review',
  "from('tien404_tester_runs').insert(","user_id:state.user.id",
  "self_reported:true","environment:'staging'"]){
  assert.ok(js.includes(token),token);
 }
 assert.ok(js.includes('QA tự động'));
 assert.ok(!js.includes('https://graph.facebook.com'));
});

test('QA admin is gated by tester staff role, not merchant ownership',()=>{
 const js=file('assets/tester-admin.js');
 for(const token of ["from('tien404_tester_staff')","staff_role==='super_admin'",
 "client.auth.getUser()","'tien404_tester_access'","'tien404_tester_assignments'"]){
  assert.ok(js.includes(token),token);
 }
 assert.ok(!js.includes("from('tenant_memberships')"));
 assert.ok(!js.includes('supabase.auth.admin.'));
 assert.ok(!js.includes('service_role_key'));
 assert.ok(!js.includes('innerHTML'));
});

test('No secret or messaging endpoint in Tester public bundle',()=>{
 for(const name of ['assets/tester-portal.js','assets/tester-admin.js','tester.html','tester-admin.html']){
  const val=file(name);
  for(const word of ['sb_secret_','service_role_key','PRIVATE_KEY','Authorization: Bearer','/webhook/'])
   assert.ok(!val.includes(word),name+': '+word);
 }
});

test('SQL only creates isolated RLS QA tables and no auto-admin',()=>{
 const sql=file('qa/tester_portal/supabase_tester_portal_v1_candidate.sql');
 for(const name of ['staff','access','modules','assignments','cases','runs','audit']){
  assert.ok(sql.includes('CREATE TABLE public.tien404_tester_'+name));
  assert.ok(sql.includes('ALTER TABLE public.tien404_tester_'+name+' ENABLE ROW LEVEL SECURITY'));
 }
 assert.ok(sql.includes('tester_runs_insert_only_assigned'));
 assert.ok(sql.includes('tester_access_admin_insert'));
 assert.ok(sql.includes('a.module_id=tien404_tester_modules.module_id'));
 assert.ok(!sql.includes('REVOKE ALL ON ALL TABLES IN SCHEMA public'));
 assert.ok(!sql.includes('public.orders'));
});

test('Only tester allowed files enter Render Auth preview',()=>{
 const build=file('scripts/build-auth-preview.mjs');
 for(const name of ['tester.html','tester-admin.html','assets/tester-portal.css',
  'assets/tester-portal.js','assets/tester-admin.js',
  'login.html','account.html','merchant-portal.html','register-staging.html']){
   assert.ok(build.includes("'"+name+"'"),name);
 }
});

test('Built preview excludes private SQL and QA fixtures',()=>{
 const output=new URL('../auth-preview-dist/',import.meta.url);
 if(!fs.existsSync(output))return;
 for(const name of ['tester.html','tester-admin.html','assets/tester-portal.js',
  'assets/tester-admin.js','assets/tester-portal.css']){
   assert.ok(fs.existsSync(new URL(name,output)),name);
 }
 for(const name of ['qa','docs','.env','.github','data']){
   assert.ok(!fs.existsSync(new URL(name,output)),name);
 }
});

test('Guidance labels unverified channels, data and images',()=>{
 const js=file('assets/tester-portal.js');
 assert.ok(js.includes('Kill Switch'));
 assert.ok(js.includes('Chỉ thử trong môi trường và kênh đã được xác minh'));
 assert.ok(js.includes('không phải giá hoặc tồn kho của cửa hàng thật'));
 assert.ok(js.includes('Ảnh lỗi: chưa có kho lưu ảnh riêng đã nghiệm thu'));
});


test('Guided playbooks cover six modules with no unsafe live links',()=>{
 const guides=file('assets/tester-guides.mjs');
 const js=file('assets/tester-portal.js');
 for(const id of ['messenger','telegram','zalo','sheets','ai_sales','commerce']){
  assert.ok(guides.includes('  '+id+': {'),id);
 }
 for(const term of ['chưa xác nhận','Bị chặn','Google Sheets','đơn thật']){
  assert.ok(guides.toLowerCase().includes(term.toLowerCase()),term);
 }
 assert.ok(js.includes('guideForModule'));
 assert.ok(js.includes('renderGuidedSteps(m.module_id)'));
 for(const banned of ['https://graph.facebook.com','/webhook/','service_role','sb_secret_']){
  assert.ok(!guides.includes(banned),'unsafe test guide: '+banned);
 }
});

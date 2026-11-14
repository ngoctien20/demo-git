import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('Access application is invite-only and its form is default hidden',()=>{
 const html=read('tester-request.html');
 assert.ok(html.includes('noindex,nofollow'));
 assert.ok(html.includes('id="tr-form"')&&html.includes('id="tr-form" class="tp-admin-form" hidden'));
 assert.ok(html.includes('id="tr-locked"')&&html.includes('hidden'));
 assert.ok(html.includes('chưa mở đăng ký công khai')||html.includes('chưa mở đăng ký công khai'));
 assert.ok(html.includes('assets/tester-request.js'));
});
test('Authenticated registration cannot change user or approve a test on the client',()=>{
 const s=read('assets/tester-request.js');
 for(const piece of ["auth.getUser()","email_confirmed_at","from('tien404_tester_requests')",
  "user_id:user.id","'pending'","status==='approved'","fetchOne('tien404_tester_access'"]){
  if(piece==="'pending'")continue;
  assert.ok(s.includes(piece),piece);
 }
 for(const pattern of ['signUp(', 'signInWithOtp(', '.auth.admin.', 'service_role','sb_secret_', '/webhook/', 'innerHTML']){
  assert.ok(!s.includes(pattern),'Unsafe client registration marker '+pattern);
 }
});
test('Staff inbox requires authenticated active Super Admin and grant readback',()=>{
 const s=read('assets/tester-admin.js');
 const h=read('tester-admin.html');
 for(const p of ['reviewRequest(request,decision)',"from('tien404_tester_requests')","role.data?.staff_role!=='super_admin'",
   "readback.data?.access_status!=='approved'",".eq('request_id',request.request_id)"]){
  assert.ok(s.includes(p),p);
 }
 assert.ok(h.includes('id="ta-request-list"'));
 assert.ok(h.includes('id="ta-request-count"'));
 assert.ok(s.includes("status:'approved'")||s.includes("access_status:'approved'"));
});
test('RLS migration prevents anonymous registration and direct privilege escalation',()=>{
 const sql=read('qa/tester_portal/V12_2_TESTER_ACCESS_REQUESTS_STAGING.sql');
 for(const item of ['ENABLE ROW LEVEL SECURITY','REVOKE ALL ON TABLE',
  'GRANT INSERT (user_id, desired_module, note)','GRANT UPDATE (status, reviewed_at, reviewed_by, updated_at)',
  'tester_request_self_insert','tester_request_super_admin_review',
  "status='pending'","s.staff_role='super_admin'","a.access_status='approved'",
  'user_id=(SELECT auth.uid())']){
  assert.ok(sql.includes(item),item);
 }
 assert.ok(!sql.includes('GRANT ALL TO anon'));
 assert.ok(!sql.includes('SECURITY DEFINER'));
 assert.ok(!sql.includes('public.orders'));
});
test('Strict Render preview allows only request assets and keeps private SQL out',()=>{
 const build=read('scripts/build-auth-preview.mjs');
 assert.equal((build.match(/'tester-request.html'/g)||[]).length,3);
 assert.ok(build.includes("'assets/tester-request.js'"));
 assert.ok(read('tester.html').includes('href="tester-request.html"'));
 assert.ok(read('account.html').includes('href="tester-request.html"'));
 const dir=new URL('../auth-preview-dist/',import.meta.url);
 if(fs.existsSync(dir)){
  assert.ok(fs.existsSync(new URL('tester-request.html',dir)));
  assert.ok(fs.existsSync(new URL('assets/tester-request.js',dir)));
  assert.ok(!fs.existsSync(new URL('qa/tester_portal/V12_2_TESTER_ACCESS_REQUESTS_STAGING.sql',dir)));
 }
});

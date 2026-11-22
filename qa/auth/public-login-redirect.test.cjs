'use strict';
// V23 contract (supersedes V13.4): public "Đăng nhập" opens the owner App (/app/, Supabase Auth, PKCE)
// on the same origin. The old Render staging entrypoint is no longer linked from the public site.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const redirects=read('_redirects'),login=read('login.html');
const target='/app/#/dang-nhap';
const entries=redirects.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')).map(s=>s.split(/\s+/));
test('Cloudflare Pages redirect covers clean /login and /login.html → owner App login',()=>{
 assert.deepEqual(entries.filter(e=>e[0].startsWith('/login')),[['/login',target,'302'],['/login.html',target,'302']]);
});
test('Every redirect is same-origin (no external host, no token query, no open redirect)',()=>{
 for(const [,to] of entries){assert.ok(to.startsWith('/'),to);assert.ok(!to.startsWith('//'),to);assert.doesNotMatch(to,/token|code=|redirect=/i);}
 assert.doesNotMatch(redirects,/onrender\.com|https?:\/\//);
});
test('No demo login form on login.html',()=>{
 for(const forbidden of ['<form','type="email"','type="password"','demo@example.com','saas-auth','<script','localStorage','sessionStorage'])
  assert.ok(!login.includes(forbidden),forbidden);
});
test('Browser fallback redirects to the App login, no referrer, not indexed',()=>{
 assert.ok(login.includes('http-equiv="refresh" content="0; url=app/#/dang-nhap"'));
 assert.ok(login.includes('href="app/#/dang-nhap"'));
 assert.match(login,/name="referrer" content="no-referrer"/);
 assert.match(login,/name="robots" content="noindex,nofollow"/);
});
test('Public navigation points login and sign-up at the owner App',()=>{
 for(const file of ['index.html','pricing.html','demo.html','contact.html']){
  const content=read(file);assert.ok(content.includes('href="app/#/dang-nhap"'),file);assert.ok(content.includes('href="app/#/dang-ky"'),file);
 }
 assert.ok(fs.existsSync(path.join(root,'app','index.html')),'owner App build missing');
});
test('No credential material in redirect contract',()=>{
 assert.doesNotMatch(login+redirects,/(service_role|secret_key|access_token|api_key|password\s*=|Bearer )/i);
});
test('Safe fallback is accessible without JavaScript',()=>{
 assert.match(login,/lang="vi"/);assert.match(login,/<main>/);assert.match(login,/<h1>/);
});

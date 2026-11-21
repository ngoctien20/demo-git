'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const redirects=read('_redirects'),login=read('login.html');
const real='https://tien404-auth-staging.onrender.com/login.html';
const entries=redirects.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')).map(s=>s.split(/\s+/));
test('Cloudflare Pages redirect covers clean /login and /login.html',()=>{
 assert.deepEqual(entries,[['/login',real,'302'],['/login.html',real,'302']]);
});
test('Redirect URL is static HTTPS Render Auth entrypoint, no token query or open redirect',()=>{
 for(const entry of entries){const url=new URL(entry[1]);
 assert.equal(url.protocol,'https:');assert.equal(url.hostname,'tien404-auth-staging.onrender.com');
 assert.equal(url.pathname,'/login.html');assert.equal(url.search,'');assert.equal(url.hash,'');
 }});
test('Public demo login form removed from login.html',()=>{
 for(const forbidden of ['<form','type="email"','demo@example.com','saas-auth','dashboard.html',
 'Tạo hồ sơ demo','<script','localStorage','sessionStorage'])assert.ok(!login.includes(forbidden),forbidden);
});
test('Browser fallback redirects to same verified HTTPS staging auth host',()=>{
 assert.ok(login.includes('http-equiv="refresh" content="0;url='+real+'"'));
 assert.ok(login.includes('href="'+real+'"'));
 assert.match(login,/name="referrer" content="no-referrer"/);
 assert.match(login,/name="robots" content="noindex,nofollow"/);
});
test('Public navigation login link remains supported without bulk changes',()=>{
 for(const file of ['index.html','pricing.html','demo.html','contact.html']){
 const content=read(file);assert.ok(content.includes('href="login.html"'),file);
 }
});
test('Demo dashboard / signup / checkout still separate, not auto-upgraded',()=>{
 const sources=entries.map(x=>x[0]);
 for(const unrequested of ['/dashboard','/register','/checkout','/billing','/account','/demo'])
 assert.ok(!sources.includes(unrequested));
});
test('No credential, API endpoint or production changes in login redirect contract',()=>{
 assert.doesNotMatch(login+redirects,/(service_role|secret_key|access_token|api_key|password\s*=|Bearer )/i);
 assert.ok(!redirects.includes('ngoctien20.github.io'));
});
test('Safe fallback is accessible without JavaScript',()=>{
 assert.match(login,/lang="vi"/);assert.match(login,/<main>/);assert.match(login,/<h1>/);
 assert.match(login,/Mở trang đăng nhập TIEN404/);
});

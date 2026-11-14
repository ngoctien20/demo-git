import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'auth-preview-dist');
const file=(name)=>fs.readFileSync(path.join(output,name),'utf8');
test('preview build contains only allowlisted login assets',()=>{
  assert.ok(fs.existsSync(path.join(output,'index.html')));
  assert.ok(fs.existsSync(path.join(output,'login.html')));
  assert.ok(fs.existsSync(path.join(output,'account.html')));
  assert.ok(fs.existsSync(path.join(output,'assets/auth-client.js')));
  assert.ok(fs.existsSync(path.join(output,'assets/auth-runtime.mjs')));
  assert.ok(fs.existsSync(path.join(output,'assets/auth-bootstrap.js')));
  assert.equal(fs.existsSync(path.join(output,'dashboard.html')),false);
  assert.equal(fs.existsSync(path.join(output,'package.json')),false);
  assert.equal(fs.existsSync(path.join(output,'.env')),false);
  assert.equal(fs.existsSync(path.join(output,'docs')),false);
  assert.equal(fs.existsSync(path.join(output,'ops')),false);
  assert.equal(fs.existsSync(path.join(output,'data')),false);
  assert.equal(fs.existsSync(path.join(output,'.github')),false);
});
test('staging pages show safe UX and use relative auth routes',()=>{
  const login=file('login.html'),account=file('account.html');
  for(const html of [login,account]){
    assert.match(html,/noindex/);
    assert.match(html,/assets\/auth\.css/);
    assert.match(html,/href="https:\/\/ngoctien20\.github\.io\/demo-git\/index\.html"/);
  }
  assert.match(login,/id="auth-login"/);
  assert.match(login,/id="auth-retry"/);
  assert.match(login,/auth-bootstrap\.js/);
  assert.match(login,/id="auth-forgot-password" disabled/);
  assert.match(login,/<span id="auth-recovery-note">Khôi phục qua email đang tạm khóa/);
  assert.doesNotMatch(login,/qua email đã cấu hình/);
  assert.match(account,/id="account-protected" hidden/);
  assert.match(account,/href="login\.html"/);
  assert.doesNotMatch(login,/assets\/saas\.js/);
});
test('preview public content contains no privileged configuration',()=>{
  for(const asset of ['assets/auth-config.js','assets/auth-client.js','assets/auth-login.js','assets/auth-account.js']){
    const s=file(asset);
    assert.doesNotMatch(s,/sb_secret_[a-zA-Z0-9]+/);
    assert.doesNotMatch(s,/service_role_key\s*[:=]\s*[^\s]+/);
  }
  assert.match(file('robots.txt'),/Disallow: \//);
});

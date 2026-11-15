import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('account.html'),build=read('scripts/build-auth-preview.mjs');
test('the account entry has one exact same-origin canonical target',()=>{
  assert.match(html,/<meta http-equiv="refresh" content="0;url=merchant-portal\.html">/);
  assert.match(html,/href="merchant-portal\.html"/);
  assert.doesNotMatch(html,/http-equiv="refresh"[^>]*https?:/);
  assert.doesNotMatch(html,/\?access_token|\?refresh_token|\?tenant_id|\?role|#access_token/);
});
test('no legacy merchant CRM, Bot, Orders editor or Supabase request runs on entry',()=>{
  assert.doesNotMatch(html,/<script\b|<form\b|auth-account\.js|merchant-lists\.mjs|owner-pairing\.mjs|id="account-tenants"|id="account-protected"/);
  assert.match(html,/không quản lý bot, giá, tồn kho/i);
  assert.doesNotMatch(html,/data-panel="bots"|data-panel="products"/);
});
test('private Tester and safe login routes remain reachable separately',()=>{
  for(const path of ['tester.html','tester-request.html','login.html','merchant-portal.html'])
    assert.ok(html.includes('href="'+path+'"'),path);
  assert.match(html,/noindex,nofollow/);
});
test('retired technical controller is preserved in source but NOT shipped in preview',()=>{
  assert.match(read('assets/auth-account.js'),/mountOwnerPairing/);
  assert.doesNotMatch(build,/'assets\/auth-account\.js'/);
  for(const safe of ["'assets/merchant-account-only.js'","'assets/merchant-order-readonly.mjs'","'tester.html'","'tester-request.html'"])
    assert.ok(build.includes(safe),safe);
});
test('canonical portal is still Supabase Auth/RLS scoped and no write is enabled',()=>{
  const c=read('assets/merchant-account-only.js');
  for(const token of ['auth.getUser()', "from('tenant_memberships')", "eq('active',true)", "from('tenants')"])
    assert.ok(c.includes(token),token);
  assert.ok(c.includes('loadShopOrders('));
  assert.ok(c.includes("disabled(c,'Xác nhận / thay đổi trạng thái đơn'"));
  assert.doesNotMatch(c,/\.insert\(|\.upsert\(|\.delete\(|\.update\(/);
});
test('no hard-coded service session, secrets or opaque platform roles',()=>{
 assert.doesNotMatch(html,/sb_secret_|service_role|Bearer\s+|Authorization:|CLIENT_SECRET|\bplatform_owner\b/i);
 assert.doesNotMatch(html,/target="_blank"/);
});

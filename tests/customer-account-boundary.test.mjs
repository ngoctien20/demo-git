import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mayOpenPanel} from '../assets/merchant-portal-policy.mjs';
const load=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=load('merchant-portal.html'),js=load('assets/merchant-account-only.js'),build=load('scripts/build-auth-preview.mjs');
test('Account portal has only profile, plan, billing, support and overview',()=>{
  const tabs=[...html.matchAll(/data-panel="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(tabs,['overview','profile','subscription','billing','support']);
});
test('Account portal does not expose Bot/CRM/Orders UI',()=>{
  for(const name of ['data-panel="bots"','data-panel="orders"','data-panel="products"','data-panel="customers"','data-panel="reports"','data-panel="care"'])assert.ok(!html.includes(name),name);
  assert.doesNotMatch(html,/assets\/merchant-portal\.js/);
});
test('Bot legacy panel is denied to all merchant membership roles',()=>{
  for(const role of ['owner','manager','staff','anonymous','TIEN404_ADMIN'])assert.equal(mayOpenPanel(role,'bots'),false);
});
test('Shop account is bound to Supabase Auth user and active membership',()=>{
  for(const expected of ['auth.getUser()',"from('tenant_memberships')","eq('active',true)",
    "eq('user_id',user.id)","from('tenants')",'approvedMemberships(', 'scopedTenantDisplay('])
   assert.ok(js.includes(expected),expected);
});
test('No outbound billing/order writes, credential persistence or Bot API in account controller',()=>{
  for(const disallowed of ['.insert(','.upsert(','.delete(','.update(',
   'sendMessage(','.auth.updateUser(', 'localStorage','sessionStorage','service_role',
   'bot_token','innerHTML'])assert.ok(!js.includes(disallowed),disallowed);
});
test('Personal and billing update UI are safely disabled until provider review',()=>{
  assert.ok(js.includes("disabled(c,'Chỉnh sửa thông tin cá nhân'"));
  assert.ok(js.includes("disabled(c,'Thay đổi thông tin thanh toán'"));
  assert.ok(js.includes('Chưa có nguồn thanh toán đã xác minh'));
});
test('Logout and authentication loss clear personal information',()=>{
  assert.ok(js.includes('function wipe()'));
  assert.ok(js.includes("event==='SIGNED_OUT'"));
  assert.ok(js.includes("auth.signOut({scope:'local'})"));
});
test('Build bundles new account controller with allowlist only',()=>{
  assert.ok(build.includes("'assets/merchant-account-only.js'"));
  assert.ok(build.includes("'merchant-portal.html'"));
  assert.ok(!build.includes('service_role'));
});
test('No fake subscription and payment values in account portal',()=>{
  assert.ok(js.includes('chưa được kết nối'));
  assert.ok(!js.includes('30/11/2026'));
  assert.ok(!js.includes('199.000đ'));
});
test('Preserves existing CRM modules without migrating or dropping data',()=>{
  for(const p of ['assets/merchant-portal.js','assets/merchant-lists.mjs','assets/merchant-portal-policy.mjs']){
    assert.ok(fs.existsSync(new URL('../'+p,import.meta.url)),p);
  }
});

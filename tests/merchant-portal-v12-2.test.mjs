import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mayOpenPanel,selectAuthorizedShop,ownsScope,PANEL_IDS} from '../assets/merchant-portal-policy.mjs';
const text=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Owner and Manager may see CRM Orders Care and Bot',()=>{
  for(const role of ['owner','manager'])for(const view of ['orders','customers','care','bots','reports'])
    assert.equal(mayOpenPanel(role,view),true);
});
test('Staff cannot access private customer data or Super Admin',()=>{
  for(const view of ['orders','customers','care','bots','reports'])
    assert.equal(mayOpenPanel('staff',view),false);
  assert.equal(mayOpenPanel('staff','products'),true);
  assert.equal(mayOpenPanel('owner','super-admin'),false);
  assert.equal(mayOpenPanel('anonymous','products'),false);
  assert.equal(PANEL_IDS.length,10);
});
test('Shop selection only accepts verified shops',()=>{
  const shops=[{id:'qa-a',role:'owner'},{id:'qa-b',role:'manager'}];
  assert.equal(selectAuthorizedShop(shops,'qa-a'),shops[0]);
  assert.equal(selectAuthorizedShop(shops,'qa-b'),shops[1]);
  assert.equal(selectAuthorizedShop(shops,'qa-c'),null);
  assert.equal(selectAuthorizedShop(shops),shops[0]);
  assert.equal(selectAuthorizedShop([],undefined),null);
});
test('Data scope refuses cross-tenant IDs',()=>{
  assert.equal(ownsScope({id:'qa-a'},'qa-a'),true);
  assert.equal(ownsScope({id:'qa-a'},'qa-b'),false);
  assert.equal(ownsScope(null,'qa-a'),false);
});
test('Portal starts hidden with accessible tabs and no-index',()=>{
  const html=text('merchant-portal.html');
  for(const token of ['id="merchant-protected" class="mp-workspace" hidden',
    'id="merchant-login" class="mp-locked" hidden','id="merchant-shop-select"',
    'aria-label="Các mục quản lý"','data-manager-only','aria-live="polite"',
    'assets/merchant-portal.js','noindex,nofollow'])
    assert.ok(html.includes(token),token);
});
test('Private state requires real Auth user, RLS membership and tenant checks',()=>{
  const js=text('assets/merchant-portal.js');
  for(const token of ['client.auth.getUser()', "from('tenant_memberships')",
    'approvedMemberships(', 'scopedTenantDisplay(', "from('tenants')",
    "eq('user_id',user.id)","eq('active',true)",
    "eq('tenant_id',ctx.tenantId)",'protectedBox.hidden=true',
    "auth.signOut({scope:'local'})"])assert.ok(js.includes(token),token);
});
test('Data lists reuse existing Commerce/CRM and do not mutate',()=>{
  const js=text('assets/merchant-portal.js');
  for(const token of ['addMerchantList(','mountRevenuePanel(',"count:'exact',head:true"])
    assert.ok(js.includes(token),token);
  for(const forbidden of ['.insert(','.upsert(','.delete(','.update(',
    'sendMessage(', 'innerHTML=', 'sb_secret_','service_role_key'])
    assert.ok(!js.includes(forbidden),forbidden);
});
test('Support and Billing clearly distinguish unimplemented features',()=>{
  const js=text('assets/merchant-portal.js');
  assert.ok(js.includes('Ticket nội bộ chưa tích hợp'));
  assert.ok(js.includes('Chưa có nguồn API Subscription/Billing'));
  assert.ok(js.includes('Đơn paid mới được xem là đã thanh toán'));
});
test('Mobile CSS preserves hidden state, focus and breakpoints',()=>{
  const css=text('assets/merchant-portal.css');
  for(const token of ['[hidden]{display:none!important}',':focus-visible',
    '@media(max-width:760px)','@media(max-width:380px)','prefers-reduced-motion'])
    assert.ok(css.includes(token));
});
test('Preview build contains only allowlisted portal and existing Auth',()=>{
  const b=text('scripts/build-auth-preview.mjs');
  for(const token of ["'merchant-portal.html'","'assets/merchant-portal.js'",
    "'assets/merchant-portal-policy.mjs'","'assets/merchant-portal.css'",
    "['login.html','account.html','merchant-portal.html','register-staging.html']","auth-preview-dist"])
    assert.ok(b.includes(token),token);
});
test('Built preview has portal files but no private repository files',()=>{
  const root=new URL('../auth-preview-dist/',import.meta.url);
  if(!fs.existsSync(root))return;
  for(const name of ['merchant-portal.html','assets/merchant-portal.js',
   'assets/merchant-portal-policy.mjs'])assert.ok(fs.existsSync(new URL(name,root)),name);
  for(const name of ['docs','.env','qa','.github'])
    assert.equal(fs.existsSync(new URL(name,root)),false,name);
});

test('Self-registration is explicitly gated until confirmed Auth email setup',()=>{
  const html=text('register-staging.html');
  const js=text('assets/register-staging.js');
  assert.ok(html.includes('id="mp-register-submit" disabled'));
  assert.ok(html.includes('noindex,nofollow'));
  assert.ok(js.includes('MERCHANT_SELF_SIGNUP_ENABLED=false'));
  assert.ok(js.includes('auth.signUp('));
  assert.ok(js.includes('isNewPasswordStrong('));
  assert.ok(js.includes('emailRedirectTo'));
  assert.ok(!js.includes('role:owner'));
  assert.ok(!js.includes('.insert('));
  const build=text('scripts/build-auth-preview.mjs');
  assert.ok(build.includes("'register-staging.html'"));
  assert.ok(build.includes("'assets/register-staging.js'"));
});

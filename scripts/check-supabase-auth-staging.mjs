#!/usr/bin/env node
// TIEN404 Supabase staging Auth: static security / route contract, no network, no user creation.
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const files={login:read('login.html'),account:read('account.html'),config:read('assets/auth-config.js'),client:read('assets/auth-client.js'),loginJs:read('assets/auth-login.js'),accountJs:read('assets/auth-account.js'),css:read('assets/auth.css'),helpers:read('assets/auth-helpers.mjs')};
const merchant=read('assets/merchant-lists.mjs');
const canonicalAccount=files.account.includes('<meta http-equiv="refresh" content="0;url=merchant-portal.html">');
const canonicalGuard=read('assets/merchant-account-only.js');
const build=read('scripts/build-auth-preview.mjs');
const issues=[];
const assert=(value,msg)=>{if(!value)issues.push(msg)};
assert(files.config.includes('sb_publishable_'),'Public publishable key not found');
assert(!/service_role|sb_secret_/.test(files.config),'Secret key type present in public config');
assert(!files.login.includes('id="saas-auth"'),'Demo-only email bypass still active');
assert(!files.login.includes('assets/saas.js'),'Legacy auth simulation loaded on real login');
assert(files.login.includes('id="auth-login"'),'Real login form missing');
assert(files.login.includes('auth-login.js'),'Real Auth controller missing');
if(canonicalAccount){
  // V13.5R.1: old authenticated CRM account was retired from the exposed entrypoint,
  // not from Git history; the new canonical portal still requires Supabase Auth + RLS.
  assert(!/<script\b|<form\b|auth-account\.js|id="account-tenants"/.test(files.account),
    'Canonical entry may not execute legacy technical account controller');
  assert(files.account.includes('href="merchant-portal.html"'),'Canonical account fallback link missing');
  assert(!/href="tester(?:-admin|-request)?\.html"/.test(files.account),'Internal Tester links exposed in customer account');
  assert(read('tester.html').includes('href="tester-request.html"'),'Internal Tester access request continuity missing');
  assert(build.includes("'tester.html'")&&build.includes("'tester-request.html'"),'Authenticated Tester pages missing from staging build');
  assert(!build.includes("'assets/auth-account.js'"),'Legacy technical account controller still deployed');
  assert(canonicalGuard.includes('auth.getUser()'),'Canonical account missing getUser identity verification');
  assert(canonicalGuard.includes("from('tenant_memberships')"),'Canonical account missing RLS membership read');
  assert(canonicalGuard.includes("eq('active',true)"),'Canonical account missing active membership filter');
  assert(canonicalGuard.includes("from('tenants')"),'Canonical account missing scoped shop name read');
  assert(canonicalGuard.includes("auth.signOut({scope:'local'})"),'Canonical account missing safe logout');
  assert(canonicalGuard.includes('approvedMemberships('),'Canonical account missing role filter');
  assert(canonicalGuard.includes('scopedTenantDisplay('),'Canonical account missing authorized tenant intersection');
  assert(!/\.(insert|update|delete|upsert)\(/.test(canonicalGuard),'Canonical account should be read-only');
} else {
  assert(files.account.includes('id="account-protected" hidden'),'Legacy protected content not hidden by default');
  assert(files.account.includes('auth-account.js'),'Legacy account guard missing');
  assert(files.account.includes('id="account-refresh"'),'Legacy revalidate membership action missing');
}
assert(files.accountJs.includes('auth.getUser()'),'Missing network-verified user');
assert(files.accountJs.includes("from('tenant_memberships')"),'Missing RLS membership check');
assert(files.accountJs.includes("eq('user_id',user.id)"),'Missing explicit auth user predicate');
assert(files.accountJs.includes("from('tenants')"),'Missing scoped tenant lookup');
assert(files.accountJs.includes("auth.signOut({scope:'local'})"),'Missing logout handler');
assert(files.loginJs.includes('auth.signInWithPassword'),'No password Auth flow');
assert(files.loginJs.includes('auth.resetPasswordForEmail'),'Recovery email function missing');
assert(files.loginJs.includes('auth.updateUser'),'Password update missing');
assert(files.login.includes('id="auth-recovery-request" hidden'),'Recovery request form must be hidden by default');
assert(files.login.includes('id="auth-password-update" hidden'),'Password update form must be hidden by default');
assert(files.css.includes('.auth-panel [hidden]'),'Form display override missing: hidden forms could show');
assert(files.accountJs.includes('approvedMemberships('),'Missing membership safe filter');
assert(files.accountJs.includes('scopedTenantDisplay('),'Missing tenant intersection filter');
assert(files.accountJs.includes('protectedContent.hidden=false'),'No positive authorization UI transition');
assert(files.accountJs.includes('protectedContent.hidden=true'),'Auth fail-closed state missing');
assert(merchant.includes("'id,tenant_id,status,total_vnd,created_at'"),'Order projection missing');
assert(files.accountJs.includes("eq('tenant_id',tenant.id)"),'Missing merchant scope');
assert(!/\.(insert|update|delete|upsert)\(/.test(files.accountJs+merchant),'Unexpected merchant mutation');
assert(merchant.includes("fields:'id,tenant_id,display_name,created_at'"),'Customer directory projection missing');
assert(!merchant.includes("select('*'"),'Unbounded merchant column selection');
assert(files.client.includes('@supabase/supabase-js@2.119.0/+esm'),'SDK not pinned');
assert(/flowType:\s*'pkce'/.test(files.client),'PKCE disabled');
assert(files.login.includes('type="password"'),'Missing password input');
assert(files.login.includes('id="auth-retry"'),'Missing login connection retry');
assert(files.login.includes('auth-bootstrap.js'),'Missing pre-module fallback');
assert(files.loginJs.includes('withDeadline(client.auth.signInWithPassword'),'Missing login timeout');
assert(files.accountJs.includes('getAuthClient()'),'Account must use common Supabase SDK loader');
assert(files.client.includes('https://esm.sh/'),'Missing alternate CDN fallback');
for(const [path,body] of Object.entries(files)){
 if(/(?:sb_secret_|service_role_key)\S{12,}/.test(body))issues.push(path+' appears to contain secret material');
}
if(issues.length){issues.forEach(s=>console.error('FAIL '+s));process.exit(1)}
console.log('PASS: Supabase staging Auth forms, no-demo bypass, PKCE, RLS membership gate, logout and no secret-key exposure.');
console.log('WARNING: Browser login, email configuration, Render integration and actual tenant access are NOT verified by static QA.');

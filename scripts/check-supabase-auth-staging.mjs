#!/usr/bin/env node
// TIEN404 Supabase staging Auth: static security / route contract, no network, no user creation.
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const files={login:read('login.html'),account:read('account.html'),config:read('assets/auth-config.js'),client:read('assets/auth-client.js'),loginJs:read('assets/auth-login.js'),accountJs:read('assets/auth-account.js'),css:read('assets/auth.css')};
const issues=[];
const assert=(value,msg)=>{if(!value)issues.push(msg)};
assert(files.config.includes('sb_publishable_'),'Public publishable key not found');
assert(!/service_role|sb_secret_/.test(files.config),'Secret key type present in public config');
assert(!files.login.includes('id="saas-auth"'),'Demo-only email bypass still active');
assert(!files.login.includes('assets/saas.js'),'Legacy auth simulation loaded on real login');
assert(files.login.includes('id="auth-login"'),'Real login form missing');
assert(files.login.includes('auth-login.js'),'Real Auth controller missing');
assert(files.account.includes('id="account-protected" hidden'),'Protected content not hidden by default');
assert(files.account.includes('auth-account.js'),'Account guard missing');
assert(files.accountJs.includes('auth.getUser()'),'Missing network-verified user');
assert(files.accountJs.includes("from('tenant_memberships')"),'Missing RLS membership check');
assert(files.accountJs.includes("eq('user_id',user.id)"),'Missing explicit auth user predicate');
assert(files.accountJs.includes("from('tenants')"),'Missing scoped tenant lookup');
assert(files.accountJs.includes('auth.signOut()'),'Missing logout handler');
assert(files.loginJs.includes('auth.signInWithPassword'),'No password Auth flow');
assert(files.client.includes('@supabase/supabase-js@2.119.0/+esm'),'SDK not pinned');
assert(files.client.includes("flowType: 'pkce'"),'PKCE disabled');
assert(!files.login.includes('type="password"')===false,'Missing password input');
for(const [path,body] of Object.entries(files)){
 if(/(?:sb_secret_|service_role_key)\S{12,}/.test(body))issues.push(path+' appears to contain secret material');
}
if(issues.length){issues.forEach(s=>console.error('FAIL '+s));process.exit(1)}
console.log('PASS: Supabase staging Auth forms, no-demo bypass, PKCE, RLS membership gate, logout and no secret-key exposure.');
console.log('WARNING: Browser login, email configuration, Render integration and actual tenant access are NOT verified by static QA.');

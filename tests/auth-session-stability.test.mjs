import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const account=src('assets/auth-account.js');
const merchant=src('assets/merchant-portal.js');
const tester=src('assets/tester-portal.js');

test('Account preserves active tenant panel on same-user RLS revalidation',()=>{
 assert.ok(account.includes('verifiedScopeSignature'));
 assert.ok(account.includes('scopeSignature===verifiedScopeSignature'));
 assert.ok(account.includes('renderGeneration=generation'));
 assert.ok(account.includes('const current=generation'));
 assert.ok(account.includes('const check=++verificationSeq'));
 assert.ok(account.includes("Date.now()-lastChecked>300000"));
 assert.ok(!account.includes('const current=++generation'));
 assert.ok(!account.includes("event==='TOKEN_REFRESHED' ||"));
});
test('Merchant preserves selected shop and active panel on a routine focus event',()=>{
 assert.ok(merchant.includes('const hadWorkspace=!protectedBox.hidden'));
 assert.ok(merchant.includes('const round=++verificationSeq'));
 assert.ok(merchant.includes('JSON.stringify(shops.map'));
 assert.ok(merchant.includes('Đang kiểm tra quyền trong nền'));
 assert.ok(merchant.includes('Date.now()-lastChecked>300000'));
 assert.ok(!merchant.includes("event==='TOKEN_REFRESHED'||"));
});
test('Tester never clears current quick feedback for token refresh or routine focus',()=>{
 assert.ok(tester.includes('const hadWorkspace=!workspace.hidden'));
 assert.ok(tester.includes('previousSnapshot!==nextSnapshot'));
 assert.ok(tester.includes('if(state.busy)return'));
 assert.ok(tester.includes('Date.now()-state.lastCheck>300000'));
 assert.ok(!tester.includes("event==='TOKEN_REFRESHED'||"));
 assert.ok(tester.includes("if(event==='SIGNED_OUT')reset"));
 assert.ok(tester.includes("from('tien404_tester_access')"));
 assert.ok(tester.includes("if(!isApproved()&&!isStaff())"));
});
test('Authorization is still server-verified on rechecks, and access failures fail closed',()=>{
 for(const script of [account,merchant,tester]){
   assert.ok(script.includes('auth.getUser()'));
   assert.ok(script.includes('visibilitychange'));
   assert.ok(script.includes("SIGNED_OUT"));
 }
 assert.ok(account.includes("from('tenant_memberships')"));
 assert.ok(merchant.includes("from('tenant_memberships')"));
 assert.ok(tester.includes("from('tien404_tester_assignments')"));
 assert.ok(account.includes('requireLogin('));
 assert.ok(merchant.includes('function lock(text)'));
 assert.ok(tester.includes('function reset(msg)'));
});
test('Do not modify privileged Tester Admin code or auth persistence setup',()=>{
 const admin=src('assets/tester-admin.js');
 assert.ok(admin.includes("from('tien404_tester_staff')"));
 assert.ok(admin.includes("event==='SIGNED_OUT'"));
 const client=src('assets/auth-client.js');
 assert.ok(client.includes('persistSession:true,autoRefreshToken:true'));
});

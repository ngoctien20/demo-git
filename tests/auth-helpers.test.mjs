import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail, isAcceptablePassword, isNewPasswordStrong,
  approvedMemberships, scopedTenantDisplay, friendlyAuthError, containsRecoverySignal
} from '../assets/auth-helpers.mjs';

test('normalizes email for Auth without touching password',()=>{
  assert.equal(normalizeEmail('  USER@Example.COM  '),'user@example.com');
  assert.equal(normalizeEmail(null),'');
});
test('rejects empty/short/excessive passwords and mismatched policies',()=>{
  assert.equal(isAcceptablePassword('1234567'),false);
  assert.equal(isAcceptablePassword('12345678'),true);
  assert.equal(isAcceptablePassword('x'.repeat(257)),false);
  assert.equal(isNewPasswordStrong('12345678'),false);
  assert.equal(isNewPasswordStrong('12 chars pass'),true);
  assert.equal(isNewPasswordStrong('x'.repeat(257)),false);
});
test('membership helper excludes another user, inactive, unrecognized role and duplicates',()=>{
  const user='user-a', rows=[
    {tenant_id:'tenant-a',user_id:user,role:'owner',active:true},
    {tenant_id:'tenant-a',user_id:user,role:'owner',active:true},
    {tenant_id:'tenant-b',user_id:'user-b',role:'owner',active:true},
    {tenant_id:'tenant-c',user_id:user,role:'owner',active:false},
    {tenant_id:'tenant-d',user_id:user,role:'super_admin',active:true},
    {tenant_id:'tenant-e',user_id:user,role:'staff',active:true}
  ];
  assert.deepEqual(approvedMemberships(rows,user).map(m=>m.tenant_id),['tenant-a','tenant-e']);
  assert.deepEqual(approvedMemberships(rows,'unknown'),[]);
  assert.deepEqual(approvedMemberships(null,user),[]);
});
test('visible tenant cards never include arbitrary tenants returned by backend',()=>{
  const m=[{tenant_id:'tenant-a',user_id:'a',role:'owner',active:true}];
  const t=[{id:'tenant-a',name:'Shop A'},{id:'tenant-b',name:'Shop B'}];
  assert.deepEqual(scopedTenantDisplay(m,t),[{id:'tenant-a',name:'Shop A',role:'owner'}]);
  assert.deepEqual(scopedTenantDisplay(m,[]),[]);
});
test('password recovery signal is explicit; ordinary session is not recovery',()=>{
  assert.equal(containsRecoverySignal('','#type=recovery&access_token=fake'),true);
  assert.equal(containsRecoverySignal('?type=recovery',''),true);
  assert.equal(containsRecoverySignal('?code=fake',''),false);
  assert.equal(containsRecoverySignal('',''),false);
});
test('customer-visible errors are generic and do not expose provider details',()=>{
  assert.match(friendlyAuthError({code:'email_not_confirmed'}),/Email chưa xác nhận/);
  assert.match(friendlyAuthError({code:'over_request_rate_limit'}),/Quá nhiều/);
  assert.doesNotMatch(friendlyAuthError({code:'invalid_credentials',message:'internal token sk_FAKE'}),/sk_FAKE/);
});

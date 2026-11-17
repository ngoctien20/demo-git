import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectStaffPreview } from './staff-authority-offline.mjs';

const NOW=1794900000000;
function fixture(channel='messenger') {
  const s={
    nowMs:NOW, executionMode:'OFFLINE_SYNTHETIC_STAFF_PREVIEW',
    hostedAccessEnabled:false,
    auth:{source:'QA_SYNTHETIC_SUPABASE_AUTH',verified:true,revoked:false,isAnonymous:false,
      userId:'person-A',sessionId:'session-A',expiresAtMs:NOW+60000},
    installation:{source:'QA_SYNTHETIC_TRUSTED_INSTALLATION',bindingId:'binding-A',
      tenantId:'tenant-SHARED',storeId:'store-A',channel,status:'active',
      subscriptionActive:true,pageRef:'page-A',appRef:'app-A'},
    merchant:null,
    staff:{source:'QA_SYNTHETIC_COMMERCIAL_STAFF_ASSIGNMENT',
      userId:'person-A',tenantId:'tenant-SHARED',storeId:'store-A',role:'STAFF',
      active:true,revoked:false,expiresAtMs:NOW+60000,assignmentVersion:3,
      permissions:['INBOX_READ','INBOX_ASSIGN','HANDOFF_ACCEPT','BOT_RESUME']},
    pageRole:{source:'QA_SYNTHETIC_META_PAGE_ACCESS',verified:true,granted:true,
      userId:'person-A',pageRef:'page-A',appRef:'app-A',expiresAtMs:NOW+60000}
  };
  s.verifySupabaseSession=async () => s.auth;
  s.resolveInstallation=async () => s.installation;
  s.readMerchantMembership=async () => s.merchant;
  s.readCommercialStaffAssignment=async () => s.staff;
  s.verifyPageInboxAccess=async () => s.pageRole;
  return s;
}
const request=(action='INBOX_READ')=>({
  bindingId:'binding-A',storeId:'store-A',sessionProof:'qa-auth-proof',action
});
async function allow(s=fixture(),r=request()) {
  const d=await inspectStaffPreview(r,s);
  assert.equal(d.previewAllowed,true,JSON.stringify(d));
  assert.equal(d.canActivateHandoff,false);
  assert.equal(d.canReadHostedInbox,false);
  assert.equal(d.noSend,true);
  assert.equal(d.authRealVerified,false);
  return d;
}
async function deny(code,s=fixture(),r=request()) {
  const d=await inspectStaffPreview(r,s);
  assert.equal(d.previewAllowed,false,JSON.stringify(d));
  assert.equal(d.reason,code);
  assert.equal(d.canActivateHandoff,false);
  assert.equal(d.noSend,true);
}
test('QA commercial Staff read scope is Store A only, not actual Auth', async()=>{
 const d=await allow();
 assert.equal(d.storeId,'store-A');
 assert.equal(d.tenantId,'tenant-SHARED');
 assert.equal(d.role,'STAFF');
 assert.equal(d.source,'QA_SYNTHETIC_STAFF_PREVIEW');
});
test('QA owner permission read independently from tenant membership', async()=>{
 const s=fixture();s.staff=null;
 s.merchant={source:'QA_SYNTHETIC_MERCHANT_MEMBERSHIP',userId:'person-A',
   tenantId:'tenant-SHARED',storeId:'store-A',active:true,revoked:false,
   role:'OWNER',expiresAtMs:NOW+60000,permissions:['INBOX_READ']};
 const d=await allow(s);
 assert.equal(d.role,'OWNER');
});
test('QA manager can review assigned inbox when granted', async()=>{
 const s=fixture();s.staff=null;
 s.merchant={source:'QA_SYNTHETIC_MERCHANT_MEMBERSHIP',userId:'person-A',
   tenantId:'tenant-SHARED',storeId:'store-A',active:true,revoked:false,
   role:'MANAGER',expiresAtMs:NOW+60000,permissions:['INBOX_READ']};
 assert.equal((await allow(s)).role,'MANAGER');
});
test('no backend authorization ports: fail closed',async()=>{
 await deny('OFFLINE_ONLY_BACKEND_PORTS_REQUIRED',{});
});
test('hosted execution explicitly forbidden',async()=>{
 const s=fixture();s.hostedAccessEnabled=true;
 await deny('OFFLINE_ONLY_BACKEND_PORTS_REQUIRED',s);
});
test('non-offline mode explicitly forbidden',async()=>{
 const s=fixture();s.executionMode='PRODUCTION';
 await deny('OFFLINE_ONLY_BACKEND_PORTS_REQUIRED',s);
});
test('blank session proof denied',async()=>{
 await deny('INVALID_PREVIEW_REQUEST',fixture(),{...request(),sessionProof:''});
});
test('unsupported permission escalation denied',async()=>{
 await deny('INVALID_PREVIEW_REQUEST',fixture(),request('STOCK_DELETE'));
});
test('anonymous Supabase auth session denied',async()=>{
 const s=fixture();s.auth.isAnonymous=true;
 await deny('SESSION_UNTRUSTED_OR_EXPIRED',s);
});
test('unverified Supabase auth session denied',async()=>{
 const s=fixture();s.auth.verified=false;
 await deny('SESSION_UNTRUSTED_OR_EXPIRED',s);
});
test('revoked auth session denied',async()=>{
 const s=fixture();s.auth.revoked=true;
 await deny('SESSION_UNTRUSTED_OR_EXPIRED',s);
});
test('expired auth session denied',async()=>{
 const s=fixture();s.auth.expiresAtMs=NOW;
 await deny('SESSION_UNTRUSTED_OR_EXPIRED',s);
});
test('auth reader fails closed',async()=>{
 const s=fixture();s.verifySupabaseSession=async()=>{throw Error('unavailable')};
 await deny('AUTH_OR_REGISTRY_UNAVAILABLE',s);
});
test('wrong Store request denied even same Tenant',async()=>{
 await deny('STORE_INSTALLATION_SCOPE_DENIED',fixture(),{...request(),storeId:'store-B'});
});
test('wrong installation reference denied',async()=>{
 await deny('STORE_INSTALLATION_SCOPE_DENIED',fixture(),{...request(),bindingId:'binding-B'});
});
test('revoked channel installation denied',async()=>{
 const s=fixture();s.installation.status='revoked';
 await deny('STORE_INSTALLATION_SCOPE_DENIED',s);
});
test('expired Store subscription denied',async()=>{
 const s=fixture();s.installation.subscriptionActive=false;
 await deny('STORE_INSTALLATION_SCOPE_DENIED',s);
});
test('staff in different Store same Tenant denied',async()=>{
 const s=fixture();s.staff.storeId='store-B';
 await deny('NO_CANONICAL_COMMERCIAL_STORE_PERMISSION',s);
});
test('staff in different Tenant denied',async()=>{
 const s=fixture();s.staff.tenantId='tenant-OTHER';
 await deny('NO_CANONICAL_COMMERCIAL_STORE_PERMISSION',s);
});
test('revoked commercial staff assignment denied',async()=>{
 const s=fixture();s.staff.revoked=true;
 await deny('NO_CANONICAL_COMMERCIAL_STORE_PERMISSION',s);
});
test('expired commercial staff assignment denied',async()=>{
 const s=fixture();s.staff.expiresAtMs=NOW;
 await deny('NO_CANONICAL_COMMERCIAL_STORE_PERMISSION',s);
});
test('client self-claimed staff role denied',async()=>{
 const s=fixture();s.staff.source='CLIENT_SELF_REPORTED';
 await deny('NO_CANONICAL_COMMERCIAL_STORE_PERMISSION',s);
});
test('platform Tester Staff not accepted as commercial staff',async()=>{
 const s=fixture();s.staff.source='TIEN404_TESTER_STAFF';
 await deny('NO_CANONICAL_COMMERCIAL_STORE_PERMISSION',s);
});
test('staff without explicit action permission denied',async()=>{
 const s=fixture();s.staff.permissions=['INBOX_READ'];
 await deny('NO_CANONICAL_COMMERCIAL_STORE_PERMISSION',s,request('BOT_RESUME'));
});
test('merchant tenant-only membership not accepted without Store',async()=>{
 const s=fixture();s.staff=null;
 s.merchant={source:'QA_SYNTHETIC_MERCHANT_MEMBERSHIP',userId:'person-A',
  tenantId:'tenant-SHARED',active:true,revoked:false,role:'OWNER',
  expiresAtMs:NOW+60000,permissions:['INBOX_READ']};
 await deny('NO_CANONICAL_COMMERCIAL_STORE_PERMISSION',s);
});
test('missing staff assignment adapter fails closed',async()=>{
 const s=fixture();s.readCommercialStaffAssignment=async()=>{throw Error('offline')};
 await deny('STAFF_MEMBERSHIP_UNAVAILABLE',s);
});
test('Meta Page Inbox permission required for handoff',async()=>{
 const s=fixture();s.pageRole.granted=false;
 await deny('META_PAGE_INBOX_AUTHORITY_DENIED',s,request('INBOX_ASSIGN'));
});
test('Meta Page mismatch in permission receipt denied',async()=>{
 const s=fixture();s.pageRole.pageRef='page-B';
 await deny('META_PAGE_INBOX_AUTHORITY_DENIED',s,request('INBOX_ASSIGN'));
});
test('Meta App mismatch in permission receipt denied',async()=>{
 const s=fixture();s.pageRole.appRef='app-B';
 await deny('META_PAGE_INBOX_AUTHORITY_DENIED',s,request('INBOX_ASSIGN'));
});
test('Meta Page permission receipt expired denied',async()=>{
 const s=fixture();s.pageRole.expiresAtMs=NOW;
 await deny('META_PAGE_INBOX_AUTHORITY_DENIED',s,request('INBOX_ASSIGN'));
});
test('Meta Page role verification service failure denied',async()=>{
 const s=fixture();s.verifyPageInboxAccess=async()=>{throw Error('provider down')};
 await deny('META_PAGE_PERMISSION_UNAVAILABLE',s,request('INBOX_ASSIGN'));
});
test('Meta Inbox read not sufficient to authorize handoff',async()=>{
 const s=fixture();s.pageRole.granted=false;
 assert.equal((await allow(s,request('INBOX_READ'))).previewAllowed,true);
 await deny('META_PAGE_INBOX_AUTHORITY_DENIED',s,request('HANDOFF_ACCEPT'));
});
test('Zalo OA uses internal store staff rule, no Meta Page requirement',async()=>{
 const s=fixture('zalo_oa');s.pageRole.granted=false;
 const d=await allow(s,request('INBOX_ASSIGN'));
 assert.equal(d.channel,'zalo_oa');
});
test('Zalo Bot uses internal store staff rule, no Meta Page requirement',async()=>{
 const s=fixture('zalo_bot');s.pageRole.granted=false;
 assert.equal((await allow(s,request('HANDOFF_ACCEPT'))).channel,'zalo_bot');
});
test('Website widget uses same commercial Store authorization',async()=>{
 const s=fixture('website_widget');s.pageRole.granted=false;
 assert.equal((await allow(s,request('BOT_RESUME'))).channel,'website_widget');
});
test('No actual provider send or permission mutation in any positive result',async()=>{
 for(const c of ['messenger','zalo_bot','zalo_oa','website_widget']){
  const d=await allow(fixture(c),request('INBOX_READ'));
  assert.equal(d.permissionChanged,false);
  assert.equal(d.customerDataExposed,false);
 }
});

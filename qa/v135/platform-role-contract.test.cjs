'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createRolePolicy,ROLES,ACTION_ROLES}=require('./platform-role-contract.cjs');
const NOW=Date.parse('2026-11-15T07:00:00Z'),future=new Date(NOW+86400000).toISOString(),past=new Date(NOW-1).toISOString();
const uid='user-0001',tenant='tenant-A',store='store-A';
function build({role='CUSTOMER',sessionExpires=future,memberActive=true,memberRole='owner',
 scopeTenant=tenant,staffActive=true,staffTenant=tenant,staffActions=['staff.assigned_shop.read'],
 subGrant=true,subExpires=future,mfa=false,overrides={}}={}){
 const cfg={
  clock:()=>NOW,
  verifySession:async()=>({serverVerified:true,userId:uid,expiresAt:sessionExpires}),
  readPlatformRole:async()=>({source:'SERVER_VERIFIED_PLATFORM_ROLE',userId:uid,active:true,role}),
  resolveServerScope:async()=>({source:'SERVER_VERIFIED_SCOPE',tenantId:scopeTenant,storeId:store}),
  readMembership:async()=>({source:'SERVER_VERIFIED_MEMBERSHIP',userId:uid,tenantId:tenant,storeId:store,
    active:memberActive,role:memberRole}),
  readStaffAssignment:async()=>({source:'SERVER_VERIFIED_STAFF_ASSIGNMENT',userId:uid,
    tenantId:staffTenant,storeId:store,active:staffActive,expiresAt:future,allowedActions:staffActions}),
  readEntitlement:async()=>({source:'SERVER_VERIFIED_ENTITLEMENT',tenantId:tenant,storeId:store,
    feature:'orders.read_shop',granted:subGrant,expiresAt:subExpires}),
  readOwnerApproval:async()=>({source:'SERVER_VERIFIED_OWNER_REAUTH',userId:uid,mfaVerified:mfa,
    reauthVerified:mfa,approvalRef:'approval-0001',expiresAt:future}),
  ...overrides
 };
 return (action,request={role:'PLATFORM_OWNER',tenant_id:'tenant-B'})=>
    createRolePolicy(cfg).inspect({action,request});
}
test('exact 4 distinct platform roles',()=>assert.deepEqual(Object.keys(ROLES),['PLATFORM_OWNER','PLATFORM_ADMIN','TIEN404_STAFF','CUSTOMER']));
test('customer can preview own orders with verified entitlement',async()=>{
 const r=await build()('customer.orders.read');
 assert.equal(r.allowed,true);assert.equal(r.tenantId,tenant);
 assert.equal(r.writesEnabled,false);assert.equal(r.mode,'DRY_RUN_ONLY');
});
test('owner/manager shop membership is not TIEN404 Staff',async()=>assert.equal(
 (await build({role:'CUSTOMER',memberRole:'owner'})('staff.bot_config.prepare')).reason,'ROLE_DENIED'));
test('merchant cannot call Admin or Platform Owner actions',async()=>{
 for(const act of ['admin.users.read','admin.tenants.read','owner.release_approval.prepare']){
  assert.equal((await build()(act)).reason,'ROLE_DENIED');
 }
});
test('forged roles in request never grant access',async()=>{
 const r=await build()('admin.users.read',{role:'PLATFORM_ADMIN',tenant_id:'tenant-B',isAdmin:true});
 assert.equal(r.allowed,false);
});
test('staff requires independent verified assignment',async()=>{
 const r=await build({role:'TIEN404_STAFF'})('staff.assigned_shop.read');
 assert.equal(r.allowed,true);assert.equal(r.providerSendingEnabled,false);
});
test('unassigned staff blocked even with assigned merchant membership',async()=>assert.equal(
 (await build({role:'TIEN404_STAFF',staffActive:false})('staff.assigned_shop.read')).reason,'STAFF_ASSIGNMENT_DENIED'));
test('cross-shop staff assignment blocked',async()=>assert.equal(
 (await build({role:'TIEN404_STAFF',staffTenant:'tenant-B'})('staff.assigned_shop.read')).reason,'STAFF_ASSIGNMENT_DENIED'));
test('staff cannot perform arbitrary other action',async()=>assert.equal(
 (await build({role:'TIEN404_STAFF'})('staff.catalog_change.prepare')).reason,'STAFF_ASSIGNMENT_DENIED'));
test('staff cannot become Admin by shop owner role',async()=>assert.equal(
 (await build({role:'TIEN404_STAFF',memberRole:'owner'})('admin.staff_assignment.prepare')).reason,'ROLE_DENIED'));
test('admin can review users but cannot perform owner release action',async()=>{
 const f=build({role:'PLATFORM_ADMIN'});
 assert.equal((await f('admin.users.read')).allowed,true);
 assert.equal((await f('owner.release_approval.prepare')).reason,'ROLE_DENIED');
});
test('owner with no fresh MFA blocked for high risk action',async()=>assert.equal(
 (await build({role:'PLATFORM_OWNER'})('owner.release_approval.prepare')).reason,'OWNER_REAUTH_DENIED'));
test('owner MFA only permits DRY RUN preparation, not release',async()=>{
 const r=await build({role:'PLATFORM_OWNER',mfa:true})('owner.release_approval.prepare');
 assert.equal(r.allowed,true);assert.equal(r.writesEnabled,false);
 assert.equal(r.permissionChanged,false);
});
test('owner is not granted customer orders by platform role alone',async()=>assert.equal(
 (await build({role:'PLATFORM_OWNER'})('customer.orders.read')).reason,'ROLE_DENIED'));
test('revoked merchant membership denied',async()=>assert.equal(
 (await build({memberActive:false})('customer.orders.read')).reason,'MEMBERSHIP_DENIED'));
test('cross-shop customer access denied',async()=>assert.equal(
 (await build({scopeTenant:'tenant-B'})('customer.orders.read')).reason,'MEMBERSHIP_DENIED'));
test('customer can read profile even if subscription expired',async()=>{
 const r=await build({subGrant:false})('customer.profile.read');assert.equal(r.allowed,true);
});
test('customer orders blocked when subscription unavailable',async()=>assert.equal(
 (await build({subGrant:false})('customer.orders.read')).reason,'ENTITLEMENT_DENIED'));
test('customer orders blocked on expired subscription',async()=>assert.equal(
 (await build({subExpires:past})('customer.orders.read')).reason,'ENTITLEMENT_DENIED'));
test('expired login session denied',async()=>assert.equal(
 (await build({sessionExpires:past})('customer.profile.read')).reason,'SESSION_DENIED'));
test('no unknown action can be authorized',async()=>assert.equal(
 (await build()('owner.permissions.grant')).reason,'UNKNOWN_ACTION'));
test('backend failures do not leak secrets',async()=>{
 const r=await build({overrides:{readPlatformRole:async()=>{throw Error('secret TOKEN');}}})('customer.profile.read');
 assert.equal(r.reason,'BACKEND_UNAVAILABLE');assert.equal(JSON.stringify(r).includes('TOKEN'),false);
});
test('separate Role/Staff/Entitlement ports are required at runtime',()=>{
 assert.throws(()=>createRolePolicy(),/TRUSTED_SERVER_PORT_MISSING/);
});
test('action matrix never grants write or provider send directly',async()=>{
 for(const action of Object.keys(ACTION_ROLES)){
  assert.ok(ACTION_ROLES[action].length>0);
 }
 const r=await build({role:'TIEN404_STAFF',staffActions:['staff.bot_config.prepare']})('staff.bot_config.prepare');
 assert.equal(r.allowed,true);assert.equal(r.writesEnabled,false);assert.equal(r.providerSendingEnabled,false);
});

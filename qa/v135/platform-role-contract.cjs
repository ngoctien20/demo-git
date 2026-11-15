'use strict';
// TIEN404 V13.5 — server-port DRY RUN role contract. DOES NOT authenticate or authorize real API writes.
// Existing Supabase tenant membership roles are NOT TIEN404 Staff/Admin/Platform Owner roles.
const ROLES=Object.freeze({
 PLATFORM_OWNER:'PLATFORM_OWNER',PLATFORM_ADMIN:'PLATFORM_ADMIN',
 TIEN404_STAFF:'TIEN404_STAFF',CUSTOMER:'CUSTOMER'
});
const ACTION_ROLES=Object.freeze({
 'customer.profile.read':['CUSTOMER'],
 'customer.subscription.read':['CUSTOMER'],
 'customer.billing.read':['CUSTOMER'],
 'customer.orders.read':['CUSTOMER'],
 'customer.support.prepare':['CUSTOMER'],
 'staff.assigned_shop.read':['TIEN404_STAFF'],
 'staff.catalog_change.prepare':['TIEN404_STAFF'],
 'staff.bot_config.prepare':['TIEN404_STAFF'],
 'staff.ticket.prepare':['TIEN404_STAFF'],
 'admin.users.read':['PLATFORM_ADMIN','PLATFORM_OWNER'],
 'admin.tenants.read':['PLATFORM_ADMIN','PLATFORM_OWNER'],
 'admin.staff_assignment.prepare':['PLATFORM_ADMIN'],
 'owner.system.read':['PLATFORM_OWNER'],
 'owner.release_approval.prepare':['PLATFORM_OWNER']
});
const ACTION_ENTITLEMENTS=Object.freeze({'customer.orders.read':'orders.read_shop'});
const STAFF_ACTIONS=new Set(Object.keys(ACTION_ROLES).filter(x=>x.startsWith('staff.')));
const ID=/^[a-zA-Z0-9:_-]{4,160}$/;
const deny=reason=>Object.freeze({allowed:false,reason,mode:'DRY_RUN_ONLY',
 writesEnabled:false,providerSendingEnabled:false,permissionChanged:false});
function createRolePolicy({verifySession,readPlatformRole,resolveServerScope,
  readMembership,readStaffAssignment,readEntitlement,readOwnerApproval,clock=Date.now}={}){
 if([verifySession,readPlatformRole,resolveServerScope,clock].some(x=>typeof x!=='function'))
    throw Error('TRUSTED_SERVER_PORT_MISSING');
 async function inspect({request,action}={}){
  if(!Object.hasOwn(ACTION_ROLES,action))return deny('UNKNOWN_ACTION');
  try{
   const s=await verifySession(request);
   if(s?.serverVerified!==true||!ID.test(s.userId||'')||
      !Number.isFinite(Date.parse(s.expiresAt))||Date.parse(s.expiresAt)<=clock())
      return deny('SESSION_DENIED');
   const platform=await readPlatformRole(Object.freeze({userId:s.userId}));
   if(platform?.source!=='SERVER_VERIFIED_PLATFORM_ROLE'||platform.userId!==s.userId||
      platform.active!==true||!Object.values(ROLES).includes(platform.role))
      return deny('PLATFORM_ROLE_UNVERIFIED');
   const role=platform.role;
   if(!ACTION_ROLES[action].includes(role))return deny('ROLE_DENIED');
   const scope=await resolveServerScope(Object.freeze({userId:s.userId,action}));
   if(!scope||scope.source!=='SERVER_VERIFIED_SCOPE'||!ID.test(scope.tenantId||'')||
      !ID.test(scope.storeId||''))return deny('SHOP_SCOPE_UNVERIFIED');
   // Identity, role, shop and entitlements are resolved exclusively by separate backend ports.
   // Raw request claims are NEVER forwarded into trusted ports.
   const current=Object.freeze({userId:s.userId,tenantId:scope.tenantId,storeId:scope.storeId});
   if(role===ROLES.CUSTOMER){
      if(typeof readMembership!=='function')return deny('MEMBERSHIP_PORT_MISSING');
      const m=await readMembership(current);
      if(m?.source!=='SERVER_VERIFIED_MEMBERSHIP'||m.userId!==s.userId||
         m.tenantId!==scope.tenantId||m.storeId!==scope.storeId||
         m.active!==true||!['owner','manager'].includes(m.role))return deny('MEMBERSHIP_DENIED');
      const needed=ACTION_ENTITLEMENTS[action];
      if(needed){
        if(typeof readEntitlement!=='function')return deny('ENTITLEMENT_PORT_MISSING');
        const e=await readEntitlement(Object.freeze({...current,feature:needed}));
        if(e?.source!=='SERVER_VERIFIED_ENTITLEMENT'||e.tenantId!==scope.tenantId||
           e.storeId!==scope.storeId||e.feature!==needed||e.granted!==true||
           !Number.isFinite(Date.parse(e.expiresAt))||Date.parse(e.expiresAt)<=clock())
           return deny('ENTITLEMENT_DENIED');
      }
   }
   if(STAFF_ACTIONS.has(action)){
      if(typeof readStaffAssignment!=='function')return deny('STAFF_ASSIGNMENT_PORT_MISSING');
      const a=await readStaffAssignment(current);
      if(a?.source!=='SERVER_VERIFIED_STAFF_ASSIGNMENT'||a.userId!==s.userId||
          a.tenantId!==scope.tenantId||a.storeId!==scope.storeId||a.active!==true||
          !Array.isArray(a.allowedActions)||!a.allowedActions.includes(action)||
          !Number.isFinite(Date.parse(a.expiresAt))||Date.parse(a.expiresAt)<=clock())
          return deny('STAFF_ASSIGNMENT_DENIED');
   }
   if(action==='owner.release_approval.prepare'){
      if(typeof readOwnerApproval!=='function')return deny('OWNER_REAUTH_PORT_MISSING');
      const a=await readOwnerApproval(Object.freeze({userId:s.userId,action}));
      if(a?.source!=='SERVER_VERIFIED_OWNER_REAUTH'||a.userId!==s.userId||
         a.mfaVerified!==true||a.reauthVerified!==true||
         typeof a.approvalRef!=='string'||a.approvalRef.length<4||
         !Number.isFinite(Date.parse(a.expiresAt))||Date.parse(a.expiresAt)<=clock())
         return deny('OWNER_REAUTH_DENIED');
   }
   return Object.freeze({allowed:true,reason:'SCOPE_VERIFIED_FOR_PREVIEW',
     userRole:role,action,tenantId:scope.tenantId,storeId:scope.storeId,
     mode:'DRY_RUN_ONLY',writesEnabled:false,providerSendingEnabled:false,
     permissionChanged:false});
  }catch{return deny('BACKEND_UNAVAILABLE');}
 }
 return Object.freeze({inspect,mode:'DRY_RUN_ONLY'});
}
module.exports={createRolePolicy,ROLES,ACTION_ROLES};

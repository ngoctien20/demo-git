import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDualStoreUatRehearsal} from './dual-store-jwt-uat-rehearsal.mjs';
const NOW=1794900000000;
const fixture=()=>{
 const d={
  executionMode:'OFFLINE_FIXTURE_ONLY',realJwtRunnerEnabled:false,nowMs:NOW,
  a:{source:'QA_SYNTHETIC_AUTH_SERVER_RECEIPT',slot:'A',authenticated:true,
    jwtSignatureChecked:true,revoked:false,isAnonymous:false,
    userAlias:'user-A',sessionAlias:'session-A',tenantRef:'tenant-SHARED',
    storeRef:'store-A',expiresAtMs:NOW+60000,action:'READ_ONLY_STAFF_INBOX'},
  b:{source:'QA_SYNTHETIC_AUTH_SERVER_RECEIPT',slot:'B',authenticated:true,
    jwtSignatureChecked:true,revoked:false,isAnonymous:false,
    userAlias:'user-B',sessionAlias:'session-B',tenantRef:'tenant-SHARED',
    storeRef:'store-B',expiresAtMs:NOW+60000,action:'READ_ONLY_STAFF_INBOX'},
  revocation:{source:'QA_SYNTHETIC_REVOCATION_RECEIPT',
    tenantRef:'tenant-SHARED',staffRoleRevokedDenied:true,
    afterRevocationFreshAuthDenied:true,noWrites:true}
 };
 d.ra={source:'QA_SYNTHETIC_POSTGREST_RLS_RECEIPT',slot:'A',
  tenantRef:'tenant-SHARED',storeRef:'store-A',sentinelOwnVisible:true,
  sentinelCrossStoreHidden:true,adminBypassUsed:false,serviceRoleUsed:false,
  storeRlsPolicyActuallyApplied:true,noWrites:true,
  realDatabaseRowDataReturned:false};
 d.rb={...d.ra,slot:'B',storeRef:'store-B'};
 d.inspectAuthSlot=async slot=>slot==='A'?d.a:d.b;
 d.inspectRlsSlot=async slot=>slot==='A'?d.ra:d.rb;
 d.inspectRevocation=async()=>d.revocation;
 return d;
};
const denied=async(d,reason)=>{
 const r=await inspectDualStoreUatRehearsal(d);
 assert.equal(r.candidate,false);
 assert.equal(r.code,reason);
 assert.equal(r.actualJwtVerified,false);
 assert.equal(r.canDeploy,false);
 assert.equal(r.noSend,true);
};
test('positive two-slot fixture is only review candidate, never real JWT',async()=>{
 const r=await inspectDualStoreUatRehearsal(fixture());
 assert.equal(r.candidate,true);assert.equal(r.actualJwtVerified,false);
 assert.equal(r.actualRlsVerified,false);assert.equal(r.canReadRealInbox,false);
 assert.equal(r.realUatComplete,false);assert.equal(r.customerRowsRead,0);
});
test('missing runner ports fail closed',async()=>denied({},'PRIVATE_RUNNER_NOT_AUTHORIZED'));
test('production mode cannot be run through fake inputs',async()=>{
 const d=fixture();d.executionMode='PRODUCTION';
 await denied(d,'PRIVATE_RUNNER_NOT_AUTHORIZED');
});
test('real JWT execution explicitly blocked',async()=>{
 const d=fixture();d.realJwtRunnerEnabled=true;
 await denied(d,'PRIVATE_RUNNER_NOT_AUTHORIZED');
});
test('unauthenticated Store A denied',async()=>{
 const d=fixture();d.a.authenticated=false;
 await denied(d,'SIGNED_SESSION_SHAPES_MISSING_OR_UNTRUSTED');
});
test('signature shape not independently acknowledged denied',async()=>{
 const d=fixture();d.a.jwtSignatureChecked=false;
 await denied(d,'SIGNED_SESSION_SHAPES_MISSING_OR_UNTRUSTED');
});
test('session marked client JWT instead of QA fixture denied',async()=>{
 const d=fixture();d.b.source='CLIENT_JWT_CLAIM';
 await denied(d,'SIGNED_SESSION_SHAPES_MISSING_OR_UNTRUSTED');
});
test('revoked Store B auth denied',async()=>{
 const d=fixture();d.b.revoked=true;
 await denied(d,'SIGNED_SESSION_SHAPES_MISSING_OR_UNTRUSTED');
});
test('expired session denied',async()=>{
 const d=fixture();d.a.expiresAtMs=NOW;
 await denied(d,'SIGNED_SESSION_SHAPES_MISSING_OR_UNTRUSTED');
});
test('anonymous session cannot be Store owner',async()=>{
 const d=fixture();d.a.isAnonymous=true;
 await denied(d,'SIGNED_SESSION_SHAPES_MISSING_OR_UNTRUSTED');
});
test('same User ID across both Stores denied',async()=>{
 const d=fixture();d.b.userAlias=d.a.userAlias;
 await denied(d,'SAME_TENANT_DIFFERENT_OWNER_AND_STORE_NOT_PROVED');
});
test('same browser session cannot pass as two distinct logins',async()=>{
 const d=fixture();d.b.sessionAlias=d.a.sessionAlias;
 await denied(d,'SAME_TENANT_DIFFERENT_OWNER_AND_STORE_NOT_PROVED');
});
test('two owners assigned to same Store denied',async()=>{
 const d=fixture();d.b.storeRef=d.a.storeRef;
 await denied(d,'SAME_TENANT_DIFFERENT_OWNER_AND_STORE_NOT_PROVED');
});
test('different Tenant pair denied',async()=>{
 const d=fixture();d.b.tenantRef='tenant-OTHER';
 await denied(d,'SAME_TENANT_DIFFERENT_OWNER_AND_STORE_NOT_PROVED');
});
test('missing own sentinel read denied',async()=>{
 const d=fixture();d.ra.sentinelOwnVisible=false;
 await denied(d,'CROSS_STORE_RLS_NEGATIVE_AND_POSITIVE_SENTINELS_REQUIRED');
});
test('cross-Store sentinel leakage denied',async()=>{
 const d=fixture();d.rb.sentinelCrossStoreHidden=false;
 await denied(d,'CROSS_STORE_RLS_NEGATIVE_AND_POSITIVE_SENTINELS_REQUIRED');
});
test('service_role RLS bypass cannot attest owner scope',async()=>{
 const d=fixture();d.ra.serviceRoleUsed=true;
 await denied(d,'CROSS_STORE_RLS_NEGATIVE_AND_POSITIVE_SENTINELS_REQUIRED');
});
test('admin BypassRLS denied',async()=>{
 const d=fixture();d.ra.adminBypassUsed=true;
 await denied(d,'CROSS_STORE_RLS_NEGATIVE_AND_POSITIVE_SENTINELS_REQUIRED');
});
test('synthetic missing applied Store policy denied',async()=>{
 const d=fixture();d.rb.storeRlsPolicyActuallyApplied=false;
 await denied(d,'CROSS_STORE_RLS_NEGATIVE_AND_POSITIVE_SENTINELS_REQUIRED');
});
test('actual customer row exposed in fixture denied',async()=>{
 const d=fixture();d.ra.realDatabaseRowDataReturned=true;
 await denied(d,'CROSS_STORE_RLS_NEGATIVE_AND_POSITIVE_SENTINELS_REQUIRED');
});
test('revocation must be independently recorded as denied',async()=>{
 const d=fixture();d.revocation.staffRoleRevokedDenied=false;
 await denied(d,'REVOCATION_READBACK_NOT_PROVED');
});
test('fresh auth after revocation must be denied too',async()=>{
 const d=fixture();d.revocation.afterRevocationFreshAuthDenied=false;
 await denied(d,'REVOCATION_READBACK_NOT_PROVED');
});
test('missing revocation result fails closed',async()=>{
 const d=fixture();d.revocation=null;
 await denied(d,'REVOCATION_READBACK_NOT_PROVED');
});
test('failed private Auth backend fails closed',async()=>{
 const d=fixture();d.inspectAuthSlot=async()=>{throw Error('auth timeout')};
 await denied(d,'AUTH_RECEIPT_UNAVAILABLE');
});
test('failed private RLS backend fails closed',async()=>{
 const d=fixture();d.inspectRlsSlot=async()=>{throw Error('rls timeout')};
 await denied(d,'RLS_OR_REVOCATION_EVIDENCE_UNAVAILABLE');
});

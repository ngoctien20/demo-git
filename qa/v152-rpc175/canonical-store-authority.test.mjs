import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateStoreAuthorityOffline,evaluateStoreAbReadiness,publicAdmission,STORE_AUTHORITY_SCHEMA} from './canonical-store-authority.mjs';
const u=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const tenant=u(1), A=u(2), B=u(3), personA=u(4), personB=u(5);
const principal={sub:personA,session_id:u(6),tenant_id:tenant,issuer:'tien404-staging-supabase-auth',aud:'authenticated',exp:2000000300,iat:2000000000,verified_by_private_gateway:true,session_confirmed:true};
const store={id:A,tenant_id:tenant,status:'active',authority_version:1};
const membership={store_id:A,tenant_id:tenant,user_id:personA,role:'owner',active:true,authority_version:1};
const tenantMembership={tenant_id:tenant,user_id:personA,role:'owner',active:true};
const request=()=>({principal:{...principal},store:{...store},membership:{...membership},tenantMembership:{...tenantMembership},nowSeconds:2000000010});
const noAccess=r=>{for(const k of ['can_read','can_write','can_upload','can_send','can_deploy'])assert.equal(r[k],false)};
test('offline matching canonical claims is never hosted grant',()=>{const r=evaluateStoreAuthorityOffline(request());assert.equal(r.eligible,true);noAccess(r)});
for(const [label,key,change] of [
 ['issuer','issuer','attacker'],['audience','aud','merchant'],['wrong tenant','tenant_id',u(7)],
 ['fake gateway proof','verified_by_private_gateway',false],['no session proof','session_confirmed',false],
 ['expired','exp',2000000000],['future iat','iat',2000000300],['long lived','exp',2000005000],
 ['bad sub','sub','spoof'],['bad session','session_id','raw-jwt']
])test('reject principal '+label,()=>{const x=request();x.principal[key]=change;const r=evaluateStoreAuthorityOffline(x);assert.equal(r.eligible,false);noAccess(r)});
for(const [label,key,change] of [
 ['other store','id',B],['other tenant','tenant_id',u(8)],['disabled','status','disabled'],
 ['invalid authority version','authority_version',0],['changed version','authority_version',2]
])test('reject store '+label,()=>{const x=request();x.store[key]=change;const r=evaluateStoreAuthorityOffline(x);assert.equal(r.eligible,false);noAccess(r)});
for(const [label,key,change] of [
 ['cross-store membership','store_id',B],['cross-tenant membership','tenant_id',u(8)],
 ['wrong user','user_id',personB],['revoked member','active',false],
 ['stale version','authority_version',0],['unknown role','role','superadmin']
])test('reject store member '+label,()=>{const x=request();x.membership[key]=change;const r=evaluateStoreAuthorityOffline(x);assert.equal(r.eligible,false);noAccess(r)});
test('reject inactive tenant membership',()=>{const x=request();x.tenantMembership.active=false;assert.equal(evaluateStoreAuthorityOffline(x).eligible,false)});
test('reject unrelated tenant membership',()=>{const x=request();x.tenantMembership.tenant_id=u(9);assert.equal(evaluateStoreAuthorityOffline(x).eligible,false)});
test('reject extra user supplied authority claim',()=>{const x=request();x.membership.user_metadata={role:'owner'};assert.equal(evaluateStoreAuthorityOffline(x).eligible,false)});
test('reject unexpected raw JWT token in principal',()=>{const x=request();x.principal.jwt='fake-token';assert.equal(evaluateStoreAuthorityOffline(x).eligible,false)});
test('fail closed on absent evidence and null',()=>{assert.equal(evaluateStoreAuthorityOffline({}).eligible,false);assert.equal(evaluateStoreAuthorityOffline(null).eligible,false)});
test('two positive synthetic stores still cannot claim real UAT',()=>{const x=request(),a=evaluateStoreAuthorityOffline(x);const y=request();y.principal.sub=personB;y.principal.session_id=u(10);y.store.id=B;y.membership.store_id=B;y.membership.user_id=personB;y.tenantMembership.user_id=personB;const b=evaluateStoreAuthorityOffline(y);assert.equal(b.eligible,true);const z=evaluateStoreAbReadiness({A:a,B:b,storeA:A,storeB:B,sameTenantExpected:tenant});assert.equal(z.status,'BLOCKED');assert.equal(z.can_assert_real_uat,false)});
test('two stores cannot reuse same canonical ID',()=>{const x=evaluateStoreAbReadiness({A:{eligible:true,store_id:A,tenant_id:tenant},B:{eligible:true,store_id:A,tenant_id:tenant},storeA:A,storeB:A,sameTenantExpected:tenant});assert.equal(x.status,'BLOCKED')});
test('no authoritative store objects means no UAT',()=>assert.equal(evaluateStoreAbReadiness().status,'BLOCKED'));
test('schema is strictly proposed not live migration',()=>{assert.deepEqual(STORE_AUTHORITY_SCHEMA.stores,['id','tenant_id','status','authority_version']);assert.equal(publicAdmission().eligible,false)});

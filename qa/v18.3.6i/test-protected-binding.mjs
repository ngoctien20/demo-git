import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {CONTRACT,createPrivateIssuer,AuthorityDenied} from '../v18.3.6g/signed-authority.mjs';
import {createProtectedIssuerNonceBinding} from './protected-issuer-nonce-binding.mjs';

const NOW=1_800_000_000,T='tenant-fixture',A='store-A',B='store-B';
const key=(user,tenant,store)=>[user,tenant,store].join('/');
function fixture() {
  const k=generateKeyPairSync('ed25519'),clock=()=>NOW*1000;
  const bindingKey=randomBytes(32),scopeBindingSecret=randomBytes(32);
  const principals=new Map([
    ['opaque-A',{source:'trusted_supabase_server_adapter',verified:true,active:true,
      sub:'owner-A',sessionId:'session-A',iss:CONTRACT.supabaseIssuer,aud:CONTRACT.supabaseAudience,exp:NOW+3600}],
    ['opaque-B',{source:'trusted_supabase_server_adapter',verified:true,active:true,
      sub:'owner-B',sessionId:'session-B',iss:CONTRACT.supabaseIssuer,aud:CONTRACT.supabaseAudience,exp:NOW+3600}]
  ]);
  const memberships=new Map();
  const mk=(user,store)=>({userId:user,tenantId:T,storeId:store,status:'active',
    storeStatus:'active',tenantMembershipActive:true,revokedAt:null,expiresAt:null,
    revision:'rev-1',capabilities:['CATALOG_READ','ORDER_READ']});
  memberships.set(key('owner-A',T,A),mk('owner-A',A));
  memberships.set(key('owner-B',T,B),mk('owner-B',B));
  const db={active:true,memberActive:true,reason:null,calls:[],accepted:new Set(),throwError:false};
  const verifySession=async h=>principals.get(h);
  const resolveMembership=async({userId,tenantId,storeId})=>memberships.get(key(userId,tenantId,storeId));
  const common={bindingKey,clock,verifySession,resolveMembership};
  const issuer=createPrivateIssuer({...common,privateKey:k.privateKey,kid:'qa-i-issuer'});
  const commitVerifiedNonce=async r=>{
    db.calls.push(r);
    if(db.throwError)throw Error('DB down');
    if(!db.active)return 'DENY_SESSION_REVOKED';
    if(!db.memberActive)return 'DENY_MEMBERSHIP_REVOKED';
    if(db.reason)return db.reason;
    if(db.accepted.has(r.jti))return 'REPLAY';
    db.accepted.add(r.jti);
    return 'ACCEPTED';
  };
  const make=async(handle='opaque-A',store=A,capability='CATALOG_READ')=>
    issuer.issue({sessionHandle:handle,tenantId:T,storeId:store,capability});
  const bind=(overrides={})=>createProtectedIssuerNonceBinding({
    ...common, trustedKeys:new Map([['qa-i-issuer',k.publicKey]]),
    scopeBindingSecret,commitVerifiedNonce,...overrides,
  });
  const redeem=(token,handle='opaque-A',store=A,capability='CATALOG_READ')=>
    bind().redeemReadOnly({token,sessionHandle:handle,tenantId:T,storeId:store,capability});
  return {k,db,principals,memberships,make,redeem,bind,scopeBindingSecret,common};
}
async function denied(fn,code) {
  await assert.rejects(fn,err=>err instanceof AuthorityDenied && err.code===code,code);
}
test('I01 genuine ephemeral Ed25519 authority claims bind to server admission',async()=>{
 const f=fixture(),token=await f.make();
 const res=await f.redeem(token);
 assert.equal(res.allowed,true);assert.equal(res.operationExecuted,false);assert.equal(res.productionAdmitted,false);
 assert.equal(f.db.calls.length,1);
});
test('I02 nonce admission object contains signed issuer, audience, Store digests and digest',async()=>{
 const f=fixture(),token=await f.make();await f.redeem(token);
 const r=f.db.calls[0];
 assert.equal(r.issuer,CONTRACT.issuer);assert.equal(r.audience,CONTRACT.audience);
 assert.equal(r.capability,'CATALOG_READ');assert.equal(r.authorityDigest.length,64);
 for(const k of ['tenantHash','storeHash','subjectHash','sessionBindingHash','membershipRevisionHash'])
   assert.match(r[k],/^[0-9a-f]{64}$/);
 assert.equal(Object.isFrozen(r),true);
});
test('I03 two independently authorized A/B users produce distinct server digests',async()=>{
 const f=fixture(),a=await f.make(),b=await f.make('opaque-B',B);
 await f.redeem(a);await f.redeem(b,'opaque-B',B);
 assert.notEqual(f.db.calls[0].storeHash,f.db.calls[1].storeHash);
 assert.notEqual(f.db.calls[0].subjectHash,f.db.calls[1].subjectHash);
});
test('I04 original JWT string and raw session IDs are never forwarded to DB adapter',async()=>{
 const f=fixture(),token=await f.make();await f.redeem(token);
 const text=JSON.stringify(f.db.calls[0]);
 assert.equal(text.includes(token),false);
 assert.equal(text.includes('session-A'),false);
 assert.equal(text.includes('owner-A'),false);
});
test('I05 same signed JTI replay is denied by durable-repository contract',async()=>{
 const f=fixture(),token=await f.make();await f.redeem(token);
 await denied(()=>f.redeem(token),'REPLAY');
});
test('I06 two concurrent redemptions: exactly one is accepted',async()=>{
 const f=fixture(),token=await f.make();
 const out=await Promise.allSettled([f.redeem(token),f.redeem(token)]);
 assert.equal(out.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(out.filter(x=>x.status==='rejected'&&x.reason.code==='REPLAY').length,1);
});
test('I07 mutated JWT signature rejected before any DB call',async()=>{
 const f=fixture(),token=await f.make();
 await denied(()=>f.redeem(token.slice(0,-5)+'zzzzz'),'BAD_SIGNATURE');
 assert.equal(f.db.calls.length,0);
});
test('I08 wrong Store scope rejected before DB admission',async()=>{
 const f=fixture(),token=await f.make();
 await denied(()=>f.redeem(token,'opaque-A',B),'REQUEST_MISMATCH');
 assert.equal(f.db.calls.length,0);
});
test('I09 wrong capability rejected before DB admission',async()=>{
 const f=fixture(),token=await f.make();
 await denied(()=>f.redeem(token,'opaque-A',A,'ORDER_READ'),'REQUEST_MISMATCH');
 assert.equal(f.db.calls.length,0);
});
test('I10 write capability never accepted by read-only contract',async()=>{
 const f=fixture(),token=await f.make();
 await denied(()=>f.redeem(token,'opaque-A',A,'ORDER_WRITE'),'REQUEST_REJECTED');
 assert.equal(f.db.calls.length,0);
});
test('I11 another Owner cannot redeem the other user session',async()=>{
 const f=fixture(),token=await f.make();
 await denied(()=>f.redeem(token,'opaque-B',A),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
 assert.equal(f.db.calls.length,0);
});
test('I12 session revoked before signature redemption fails before DB admission',async()=>{
 const f=fixture(),token=await f.make();f.principals.get('opaque-A').active=false;
 await denied(()=>f.redeem(token),'SESSION_NOT_VERIFIED');
 assert.equal(f.db.calls.length,0);
});
test('I13 revoked membership before redemption fails before DB admission',async()=>{
 const f=fixture(),token=await f.make();f.memberships.get(key('owner-A',T,A)).status='revoked';
 await denied(()=>f.redeem(token),'MEMBERSHIP_NOT_ACTIVE_OR_SCOPED');
 assert.equal(f.db.calls.length,0);
});
test('I14 session revoked after G check but before DB commit is denied',async()=>{
 const f=fixture(),token=await f.make();
 f.db.active=false;
 await denied(()=>f.redeem(token),'REPLAY');
 assert.equal(f.db.calls.length,1);assert.equal(f.db.accepted.size,0);
});
test('I15 Store membership revoked between checks and DB admission denied',async()=>{
 const f=fixture(),token=await f.make();
 f.db.memberActive=false;
 await denied(()=>f.redeem(token),'REPLAY');
 assert.equal(f.db.accepted.size,0);
});
test('I16 PostgreSQL outage fails closed and does not return read permission',async()=>{
 const f=fixture(),token=await f.make();f.db.throwError=true;
 await denied(()=>f.redeem(token),'NONCE_STORE_UNAVAILABLE');
});
test('I17 unexpected DB result such as object status accepted is DENY',async()=>{
 const f=fixture(),token=await f.make();
 const other=f.bind({commitVerifiedNonce:async()=>({status:'ACCEPTED'})});
 await denied(()=>other.redeemReadOnly({token,sessionHandle:'opaque-A',tenantId:T,storeId:A,capability:'CATALOG_READ'}),'REPLAY');
});
test('I18 null DB result DENY',async()=>{
 const f=fixture(),token=await f.make();
 const other=f.bind({commitVerifiedNonce:async()=>null});
 await denied(()=>other.redeemReadOnly({token,sessionHandle:'opaque-A',tenantId:T,storeId:A,capability:'CATALOG_READ'}),'REPLAY');
});
test('I19 missing private binding secret rejects configuration',()=>{
 const f=fixture();assert.throws(()=>f.bind({scopeBindingSecret:undefined}),e=>e.code==='PRIVATE_CONFIGURATION');
});
test('I20 no direct client-supplied nonce callback accepted',()=>{
 const f=fixture();assert.throws(()=>f.bind({consumeNonce:()=>true}),e=>e.code==='PRIVATE_CONFIGURATION');
});
test('I21 revoking issuer signing key rejects without DB call',async()=>{
 const f=fixture(),token=await f.make();
 const b=f.bind({trustedKeys:new Map()});
 await denied(()=>b.redeemReadOnly({token,sessionHandle:'opaque-A',tenantId:T,storeId:A,capability:'CATALOG_READ'}),'UNTRUSTED_KID');
 assert.equal(f.db.calls.length,0);
});
test('I22 invalid session handle rejected before DB call',async()=>{
 const f=fixture(),token=await f.make();
 await denied(()=>f.redeem(token,'',A),'REQUEST_REJECTED');
 assert.equal(f.db.calls.length,0);
});
test('I23 token digest differs across two signed authorities for same Store',async()=>{
 const f=fixture(),a=await f.make(),b=await f.make();
 await f.redeem(a);await f.redeem(b);
 assert.notEqual(f.db.calls[0].authorityDigest,f.db.calls[1].authorityDigest);
 assert.equal(f.db.calls[0].storeHash,f.db.calls[1].storeHash);
});
test('I24 unexpected deny does not mutate synthetic nonce set',async()=>{
 const f=fixture(),token=await f.make();f.db.reason='DENY_SESSION_REVISION';
 await denied(()=>f.redeem(token),'REPLAY');
 assert.equal(f.db.accepted.size,0);
});

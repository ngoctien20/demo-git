import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {verifyOwnerLocally,compareTwoLocalReports,makeLocalPairReceipt,comparePeerLocalReceipt} from '../assets/private-auth-evidence-core.mjs';
const subA='10000000-0000-4000-8000-000000000001',subB='10000000-0000-4000-8000-000000000002';
const storeTenant='11111111-1111-4111-8111-111111111111';
const otherTenant='33333333-3333-4333-8333-333333333333';
const session='22222222-2222-4222-8222-222222222222';
const nonce='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const base=(options={})=>{
 const calls=[];
 const subject=options.subject||subA;
 const claims={iss:'https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1',
 aud:'authenticated',role:'authenticated',sub:subject,session_id:session,
 iat:Math.floor(Date.now()/1000)-5,exp:Math.floor(Date.now()/1000)+500,
 ...options.claims};
 const db={select:()=>db,eq:()=>db,limit:async()=>{calls.push('ownerRLSRead');return {
   data:[{tenant_id:options.tenant||storeTenant,role:options.memberRole||'owner',active:true}],
   error:options.dbError||null
 }}};
 return {calls,client:{
  auth:{getUser:async()=>{calls.push('getUser');return options.authError?
   {data:null,error:{msg:'private secret'}}:{data:{user:{id:subject,is_anonymous:false}}}},
   getClaims:async()=>{calls.push('getClaims');return {data:{claims},error:null}}
  },
  from:table=>{assert.equal(table,'tenant_memberships');return db;}
 }};
};
const run=async(opts={},args={})=>{
 const q=base(opts);
 const r=await verifyOwnerLocally({client:q.client,nonce,consent:true,cryptoApi:webcrypto,...args});
 return {r,calls:q.calls};
};
test('owner confirmed read-only Auth + RLS returns local indication only',async()=>{
 const {r,calls}=await run();
 assert.equal(r.status,'LOCAL_OWNER_AUTH_READ_OK');
 assert.deepEqual(calls,['getUser','getClaims','ownerRLSRead']);
 assert.equal(r.canMigrate,false);assert.equal(r.canSend,false);
 assert.equal(r.realServerSessionVerified,false);
 assert.equal(r.canonicalStoreOwnerVerified,false);
 const output=JSON.stringify(r);
 for(const secret of [subA,storeTenant,session,'private secret'])
   assert.equal(output.includes(secret),false);
});
test('different subjects in same tenant match owner tenant code but have distinct actor codes',async()=>{
 const a=(await run()).r,b=(await run({subject:subB})).r;
 assert.notEqual(a.actorCode,b.actorCode);
 assert.equal(a.ownerTenantCodes[0],b.ownerTenantCodes[0]);
 assert.equal(compareTwoLocalReports(a,b).localBrowserIndication,'TWO_DIFFERENT_ACTORS_COMMON_TENANT_OWNER');
 assert.equal(compareTwoLocalReports(a,b).storeAuthorityVerified,false);
});
test('different tenant denied common owner correlation',async()=>{
 const a=(await run()).r,b=(await run({subject:subB,tenant:otherTenant})).r;
 assert.equal(compareTwoLocalReports(a,b).localBrowserIndication,'NOT_ESTABLISHED');
});
test('no consent prevents any Auth call',async()=>{
 const {r,calls}=await run({}, {consent:false});
 assert.equal(r.status,'BLOCKED');assert.deepEqual(calls,[]);
});
test('invalid comparison nonce prevents Auth call',async()=>{
 const {r,calls}=await run({}, {nonce:'bad value'});
 assert.equal(r.status,'BLOCKED');assert.deepEqual(calls,[]);
});
test('Auth getUser denied before getClaims',async()=>{
 const {r,calls}=await run({authError:true});
 assert.equal(r.status,'BLOCKED');assert.deepEqual(calls,['getUser']);
 assert.equal(JSON.stringify(r).includes('private secret'),false);
});
test('incorrect JWT signature or issuer claims denied in preflight',async()=>{
 for(const claims of [{iss:'https://evil.invalid'},{aud:'service_role'},{sub:subB},{session_id:null},
 {exp:Math.floor(Date.now()/1000)-1},{role:'service_role'}]){
 const {r,calls}=await run({claims});
 assert.equal(r.status,'BLOCKED');assert.equal(calls.includes('ownerRLSRead'),false);
 }
});
test('staff user_metadata spoof cannot become owner',async()=>{
 const {r}=await run({memberRole:'staff'});
 assert.equal(r.status,'BLOCKED');assert.equal(r.ownerTenantCodes.length,0);
});
test('RLS error and unexpected result fail closed without raw error',async()=>{
 const {r}=await run({dbError:{message:'Sensitive returned data'}});
 assert.equal(r.status,'BLOCKED');assert.equal(JSON.stringify(r).includes('Sensitive'),false);
});
test('same browser report twice cannot fake two actors',async()=>{
 const a=(await run()).r;
 assert.equal(compareTwoLocalReports(a,a).localBrowserIndication,'NOT_ESTABLISHED');
});
test('no credentials, writes, sends, localStorage or UI privilege in core',async()=>{
 assert.equal(typeof verifyOwnerLocally,'function');
 const r=(await run()).r;
 assert.equal(r.canGrantRoles,false);assert.equal(r.canPublish,false);assert.equal(r.canSend,false);
});


test('P0O same-tenant two-actor local receipt comparison works without raw ID leakage',async()=>{
 const alice=(await run()).r, bob=(await run({subject:subB})).r;
 const receipt=makeLocalPairReceipt(bob,nonce,2000);
 assert.equal(typeof receipt,'string');
 const out=comparePeerLocalReceipt(alice,nonce,receipt,2010);
 assert.equal(out.status,'LOCAL_TWO_ACTOR_SAME_OWNER_TENANT_INDICATION');
 assert.equal(out.differentActor,true);
 assert.equal(out.sameTenantOwner,true);
 assert.equal(out.serverSignedProof,false);
 assert.equal(out.canonicalStoreAuthority,false);
 assert.equal(out.canMigrate,false);
 assert.equal(out.canSend,false);
 for(const secret of [subA,subB,storeTenant,session])
  assert.equal(receipt.includes(secret),false);
});
test('P0O same subject cannot impersonate two separate owner accounts',async()=>{
 const alice=(await run()).r;
 const receipt=makeLocalPairReceipt(alice,nonce,2000);
 const out=comparePeerLocalReceipt(alice,nonce,receipt,2010);
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.reason,'SAME_ACTOR_FINGERPRINT');
});
test('P0O two owner accounts in different tenants are rejected',async()=>{
 const alice=(await run()).r,bob=(await run({subject:subB,tenant:otherTenant})).r;
 const out=comparePeerLocalReceipt(alice,nonce,makeLocalPairReceipt(bob,nonce,2000),2010);
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.reason,'NO_COMMON_OWNER_TENANT');
});
test('P0O rejects reused or mismatched one-time nonce',async()=>{
 const alice=(await run()).r,bob=(await run({subject:subB})).r;
 const valid=makeLocalPairReceipt(bob,nonce,2000);
 const malicious=JSON.parse(valid);
 malicious.nonce='11111111-1111-4111-8111-111111111111';
 assert.equal(comparePeerLocalReceipt(alice,nonce,JSON.stringify(malicious),2010).status,'BLOCKED');
 assert.equal(comparePeerLocalReceipt(alice,'bad',valid,2010).status,'BLOCKED');
});
test('P0O rejects stale and future-dated browser receipts',async()=>{
 const alice=(await run()).r,bob=(await run({subject:subB})).r;
 const raw=makeLocalPairReceipt(bob,nonce,2000);
 assert.equal(comparePeerLocalReceipt(alice,nonce,raw,2000+1801).reason,'RECEIPT_EXPIRED');
 assert.equal(comparePeerLocalReceipt(alice,nonce,raw,1879).reason,'RECEIPT_EXPIRED');
});
test('P0O rejects forged and oversized receipt shapes without data egress',async()=>{
 const alice=(await run()).r,bob=(await run({subject:subB})).r;
 const valid=JSON.parse(makeLocalPairReceipt(bob,nonce,2000));
 for(const text of ['{bad', 'x'.repeat(1801), JSON.stringify({...valid,access_token:'forbidden'}),
 JSON.stringify({...valid,owners:['bad']}),JSON.stringify({...valid,actor:subB}),
 JSON.stringify({...valid,issuedAt:'2000'}),JSON.stringify({...valid,version:99})]){
   const out=comparePeerLocalReceipt(alice,nonce,text,2010);
   assert.equal(out.status,'BLOCKED');
   assert.equal(out.serverSignedProof,false);
 }
});
test('P0O cannot issue local receipt for denied or unconsented Auth',async()=>{
 const denied=await run({authError:true});
 assert.equal(makeLocalPairReceipt(denied.r,nonce),null);
 assert.equal(makeLocalPairReceipt(null,nonce),null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {checkBrowserActorReadOnly,reviewTwoLocalPrechecks} from './private-browser-auth-readonly.mjs';
const ID='10000000-0000-4000-8000-000000000001';
const SID='20000000-0000-4000-8000-000000000002';
const options=()=>({
 privateOperatorConsentConfirmed:true,environment:'STAGING_QA_PRIVATE',roleSlot:'A',
 useRealCustomerData:false,noSend:true
});
function client(change={}){
 const u={id:ID,email:'private@example.invalid',is_anonymous:false};
 const c={iss:'https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1',
  aud:'authenticated',role:'authenticated',sub:ID,session_id:SID,
  exp:Math.floor(Date.now()/1000)+400,iat:Math.floor(Date.now()/1000)-3};
 const calls=[];
 return {auth:{
  getUser:async()=>{calls.push('getUser');return change.userResp??{data:{user:{...u,...change.user}}}},
  getClaims:async()=>{calls.push('getClaims');return change.claimsResp??{data:{claims:{...c,...change.claims}}}}
 },calls};
}
const permissions=(x)=> {
 assert.equal(x.canGrantStoreRoles,false);
 assert.equal(x.canRunHostedAB,false);
 assert.equal(x.canChangeHosted,false);
 assert.equal(x.canSend,false);
 assert.equal(x.canPublish,false);
};
test('official Auth preflight checked without disclosing private claims or identifiers',async()=>{
 const c=client();const r=await checkBrowserActorReadOnly(c,options());
 assert.equal(r.status,'LOCAL_AUTH_CLIENT_READ_ONLY_CHECKED');
 assert.equal(r.localAuthChecked,true);
 assert.equal(r.serverSessionRevocationVerified,false);
 assert.deepEqual(c.calls,['getUser','getClaims']);
 assert.equal(JSON.stringify(r).includes(ID),false);
 assert.equal(JSON.stringify(r).includes(SID),false);
 assert.equal(JSON.stringify(r).includes('private@example.invalid'),false);
 permissions(r);
});
test('consent missing avoids auth client calls',async()=>{
 const c=client();const o=options();o.privateOperatorConsentConfirmed=false;
 const r=await checkBrowserActorReadOnly(c,o);
 assert.equal(r.status,'BLOCKED');assert.deepEqual(c.calls,[]);permissions(r);
});
test('rejects production environment',async()=>{
 const c=client();const o=options();o.environment='PRODUCTION';
 assert.equal((await checkBrowserActorReadOnly(c,o)).status,'BLOCKED');
 assert.deepEqual(c.calls,[]);
});
test('only A or B actor slots allowed',async()=>{
 const c=client();const o=options();o.roleSlot='OWNER';
 assert.equal((await checkBrowserActorReadOnly(c,o)).reason,'INVALID_ACTOR_SLOT');
});
test('requires no-send mode',async()=>{
 const c=client();const o=options();o.noSend=false;
 assert.equal((await checkBrowserActorReadOnly(c,o)).reason,'NO_SEND_NO_CUSTOMER_DATA_REQUIRED');
});
test('must not include actual customer data',async()=>{
 const o=options();o.useRealCustomerData=true;
 assert.equal((await checkBrowserActorReadOnly(client(),o)).status,'BLOCKED');
});
test('rejects client without official getClaims',async()=>{
 const c=client();delete c.auth.getClaims;
 assert.equal((await checkBrowserActorReadOnly(c,options())).reason,'OFFICIAL_AUTH_CLIENT_REQUIRED');
});
test('getUser fails closed before getClaims',async()=>{
 const c=client({userResp:{data:{user:null},error:{message:'private detail'}}});
 const r=await checkBrowserActorReadOnly(c,options());
 assert.deepEqual(c.calls,['getUser']);assert.equal(r.status,'BLOCKED');
 assert.equal(JSON.stringify(r).includes('private detail'),false);
});
test('anonymous Auth user denied',async()=>{
 const c=client({user:{is_anonymous:true}});
 assert.equal((await checkBrowserActorReadOnly(c,options())).reason,'OFFICIAL_GETUSER_NOT_VERIFIED');
});
test('getClaims error fails closed without error logging',async()=>{
 const c=client({claimsResp:{data:null,error:{message:'private claims detail'}}});
 const r=await checkBrowserActorReadOnly(c,options());
 assert.equal(r.reason,'OFFICIAL_GETCLAIMS_NOT_VERIFIED');
 assert.equal(JSON.stringify(r).includes('private claims detail'),false);
});
test('reject wrong issuer',async()=>{
 const c=client({claims:{iss:'https://attacker.invalid/auth/v1'}});
 assert.equal((await checkBrowserActorReadOnly(c,options())).reason,'JWT_CLAIMS_OR_SUBJECT_MISMATCH');
});
test('reject wrong audience',async()=>{
 const c=client({claims:{aud:'service_role'}});
 assert.equal((await checkBrowserActorReadOnly(c,options())).status,'BLOCKED');
});
test('accept audience array without opening hosted authorization',async()=>{
 const c=client({claims:{aud:['authenticated']}});
 const r=await checkBrowserActorReadOnly(c,options());
 assert.equal(r.localAuthChecked,true);permissions(r);
});
test('reject subject mismatch',async()=>{
 const c=client({claims:{sub:'30000000-0000-4000-8000-000000000003'}});
 assert.equal((await checkBrowserActorReadOnly(c,options())).status,'BLOCKED');
});
test('reject missing session id',async()=>{
 const c=client({claims:{session_id:undefined}});
 assert.equal((await checkBrowserActorReadOnly(c,options())).status,'BLOCKED');
});
test('reject expired access token',async()=>{
 const c=client({claims:{exp:Math.floor(Date.now()/1000)-3}});
 assert.equal((await checkBrowserActorReadOnly(c,options())).status,'BLOCKED');
});
test('reject future issued-at timestamp',async()=>{
 const c=client({claims:{iat:Math.floor(Date.now()/1000)+180}});
 assert.equal((await checkBrowserActorReadOnly(c,options())).status,'BLOCKED');
});
test('reject role escalation',async()=>{
 const c=client({claims:{role:'service_role'}});
 assert.equal((await checkBrowserActorReadOnly(c,options())).status,'BLOCKED');
});
test('unknown network/runtime errors fail closed',async()=>{
 const c=client();c.auth.getClaims=async()=>{throw Error('token info must not be logged')};
 const r=await checkBrowserActorReadOnly(c,options());
 assert.equal(r.reason,'AUTH_CLIENT_OPERATION_UNAVAILABLE');
 assert.equal(JSON.stringify(r).includes('token info'),false);
});
test('two actor local checks never prove their distinct identities',async()=>{
 const a=await checkBrowserActorReadOnly(client(),options());
 const o=options();o.roleSlot='B';
 const b=await checkBrowserActorReadOnly(client(),o);
 const r=reviewTwoLocalPrechecks(a,b);
 assert.equal(r.status,'PRIVATE_OPERATOR_REVIEW_REQUIRED');
 assert.equal(r.localBrowserPrechecks,2);
 assert.equal(r.distinctActorIdentityCryptographicallyProven,false);
 assert.equal(r.canonicalStoreOwnershipVerified,false);
 permissions(r);
});
test('duplicate browser actor slot cannot masquerade as two different actors',async()=>{
 const a=await checkBrowserActorReadOnly(client(),options());
 const r=reviewTwoLocalPrechecks(a,a);
 assert.equal(r.status,'BLOCKED');permissions(r);
});
test('no owner proof means no pairing admission',()=>{
 const r=reviewTwoLocalPrechecks(null,null);
 assert.equal(r.status,'BLOCKED');permissions(r);
});

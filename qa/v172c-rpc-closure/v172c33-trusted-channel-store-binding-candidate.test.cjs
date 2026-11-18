'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createTrustedChannelStoreBinding}=require('./v172c33-trusted-channel-store-binding-candidate.cjs');
const NOW=1773820000000;
const fixtures={
 A:{channel:'messenger',externalAccountRef:'page-A',providerEventRef:'event-001',timestampMs:NOW,signatureVerified:true,providerAttested:true},
 B:{channel:'zalo',externalAccountRef:'bot-B',providerEventRef:'event-002',timestampMs:NOW,signatureVerified:true,providerAttested:true}
};
const records={
 'messenger:page-A':{channel:'messenger',externalAccountRef:'page-A',installationRef:'installation-A',tenantRef:'tenant-1',storeRef:'store-A',active:true,provenanceVerified:true},
 'zalo:bot-B':{channel:'zalo',externalAccountRef:'bot-B',installationRef:'installation-B',tenantRef:'tenant-1',storeRef:'store-B',active:true,provenanceVerified:true}
};
function setup(opts={}){
 const calls=[];let received=fixtures.A;const used=new Set();
 const deps={
  now:()=>NOW,
  hmacSecret:'synthetic-hmac-key-only-in-ci-minimum-32-characters',
  readReleaseGate:async()=>({syntheticOnly:true,noSend:true,noCommerceWrites:true,hostedUatApproved:false}),
  verifyIngress:async input=>{calls.push('verify');return received;},
  findInstallation:async input=>{calls.push('installation');return records[input.channel+':'+input.externalAccountRef]||null;},
  verifyStoreAuthority:async input=>{calls.push('authority');return {verified:true,active:true,...input};},
  consumeIngressOnce:async input=>{calls.push('replay');const key=JSON.stringify(input);
   if(used.has(key))return {insertedNew:false,atomicVerified:true};
   used.add(key);return {insertedNew:true,atomicVerified:true};},
  ...opts
 };
 return {calls,bind:createTrustedChannelStoreBinding(deps),
  setIngress:v=>{received=v;}};
}
const input=()=>({rawIngress:Buffer.from('synthetic-original-provider-bytes'),proofHeaders:{'x-test-qa':'fake'}});
test('same Tenant / two independent Store installations produce different opaque read-only binding references',async()=>{
 const f=setup();const a=await f.bind(input());f.setIngress(fixtures.B);
 const b=await f.bind(input());
 assert.equal(a.status,'INTERNAL_READONLY_BINDING_NO_ORDER_AUTH');
 assert.equal(b.status,'INTERNAL_READONLY_BINDING_NO_ORDER_AUTH');
 assert.notEqual(a.receiptRef,b.receiptRef);
 assert.equal(a.canWriteOrder,false);assert.equal(b.canSend,false);
 assert.ok(!JSON.stringify(a).includes('store-A'));
 assert.ok(!JSON.stringify(b).includes('bot-B'));
});
test('DENY reused provider event even if signature is valid',async()=>{
 const f=setup();assert.equal((await f.bind(input())).status,'INTERNAL_READONLY_BINDING_NO_ORDER_AUTH');
 assert.equal((await f.bind(input())).status,'DENY');
});
test('DENY caller-controlled Store/tenant/role and write flags before contacting provider',async()=>{
 for(const payload of [
  {storeRef:'store-B'},{tenantRef:'tenant-2'},{store_id:'store-B'},
  {authorityVerified:true},{isOwner:true},{writeApproved:true},{role:'owner'}
 ]){
  const f=setup();assert.equal((await f.bind({...input(),...payload})).status,'DENY');
  assert.deepEqual(f.calls,[]);
 }
});
for(const [label,attestation] of [
 ['missing signature',{...fixtures.A,signatureVerified:false}],
 ['not provider attested',{...fixtures.A,providerAttested:false}],
 ['missing event',{...fixtures.A,providerEventRef:''}],
 ['timestamp missing',{...fixtures.A,timestampMs:undefined}],
 ['stale event',{...fixtures.A,timestampMs:NOW-360000}],
 ['future event',{...fixtures.A,timestampMs:NOW+360000}],
 ['unknown channel',{...fixtures.A,channel:'website'}],
 ['forged external account',{...fixtures.A,externalAccountRef:'unknown-page'}],
 ['wrong bot/account pair',{...fixtures.A,channel:'zalo'}]
])test('DENY '+label,async()=>{
 const f=setup({verifyIngress:async()=>attestation});
 assert.equal((await f.bind(input())).status,'DENY');
});
for(const [label,record] of [
 ['wrong tenant',{...records['messenger:page-A'],tenantRef:'tenant-2'}],
 ['not installed',{...records['messenger:page-A'],active:false}],
 ['provenance unknown',{...records['messenger:page-A'],provenanceVerified:false}],
 ['wrong platform',{...records['messenger:page-A'],channel:'zalo'}],
 ['wrong account',{...records['messenger:page-A'],externalAccountRef:'bot-B'}],
 ['Store undefined',{...records['messenger:page-A'],storeRef:undefined}]
])test('DENY installation '+label,async()=>{
 const f=setup({findInstallation:async()=>record,
  verifyStoreAuthority:async expected=>({verified:true,active:true,
   ...expected,tenantRef:'tenant-1',storeRef:'store-A'})});
 assert.equal((await f.bind(input())).status,'DENY');
});
test('DENY registry Store authority mismatch and service failure',async()=>{
 for(const verifyStoreAuthority of [
  async v=>({...v,verified:false,active:true}),
  async v=>({...v,verified:true,active:true,storeRef:'store-B'}),
  async()=>{throw Error('private provider offline');}
 ]){
  const f=setup({verifyStoreAuthority});
  assert.equal((await f.bind(input())).status,'DENY');
 }
});
test('DENY replay consume not atomic or missing',async()=>{
 for(const consumeIngressOnce of [
  async()=>({insertedNew:true,atomicVerified:false}),
  async()=>({insertedNew:false,atomicVerified:true}),
  async()=>{throw Error('write failed');}
 ]){
  const f=setup({consumeIngressOnce});
  assert.equal((await f.bind(input())).status,'DENY');
 }
});
test('DENY disabled synthetic-only, no-send/no-write, or release gate',async()=>{
 for(const gate of [
  {syntheticOnly:false,noSend:true,noCommerceWrites:true,hostedUatApproved:false},
  {syntheticOnly:true,noSend:false,noCommerceWrites:true,hostedUatApproved:false},
  {syntheticOnly:true,noSend:true,noCommerceWrites:false,hostedUatApproved:false},
  {syntheticOnly:true,noSend:true,noCommerceWrites:true,hostedUatApproved:true},
  {syntheticOnly:true,noSend:true,noCommerceWrites:true}
 ]){
  const f=setup({readReleaseGate:async()=>gate});
  assert.equal((await f.bind(input())).status,'DENY');
 }
});
test('DENY missing private server adapters',()=>{
 assert.throws(()=>createTrustedChannelStoreBinding({}),/SERVER_SIDE_ADAPTERS_REQUIRED/);
});

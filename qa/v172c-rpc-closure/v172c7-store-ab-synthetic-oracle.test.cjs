'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
// Pure authorization oracle for disposable fixtures ONLY. This file never imports networking or secrets.
// Not a representation of actual deployed RLS, JWT, owners, or provider signatures.
const tenant='qa-tenant-synthetic';
const stores={A:'qa-store-a',B:'qa-store-b'};
const actors={
  A:{uid:'synthetic-a',signed:true,tenant,store:stores.A,active:true,role:'owner'},
  B:{uid:'synthetic-b',signed:true,tenant,store:stores.B,active:true,role:'owner'}
};
function canRead(actor,req){
  if(!actor||!actor.signed||!actor.active||!req) return false;
  if(!['owner','manager','viewer'].includes(actor.role)) return false;
  if(req.tenant!==actor.tenant||req.store!==actor.store) return false;
  if(req.inboundStoreOverride || req.unverifiedProvider || req.jwtInvalid || req.sessionRevoked) return false;
  return true;
}
const cases=[
 ['A own store',actors.A,{tenant,store:stores.A},true],
 ['A cross store',actors.A,{tenant,store:stores.B},false],
 ['B own store',actors.B,{tenant,store:stores.B},true],
 ['B cross store',actors.B,{tenant,store:stores.A},false],
 ['no auth',null,{tenant,store:stores.A},false],
 ['cross tenant',actors.A,{tenant:'qa-other-tenant',store:stores.A},false],
 ['cross tenant B',actors.B,{tenant:'qa-other-tenant',store:stores.B},false],
 ['forged inbound store',{...actors.A},{tenant,store:stores.A,inboundStoreOverride:true},false],
 ['unverified provider',{...actors.B},{tenant,store:stores.B,unverifiedProvider:true},false],
 ['invalid JWT',{...actors.A},{tenant,store:stores.A,jwtInvalid:true},false],
 ['revoked session',{...actors.B},{tenant,store:stores.B,sessionRevoked:true},false],
 ['revoked membership',{...actors.A,active:false},{tenant,store:stores.A},false],
 ['missing role',{...actors.A,role:null},{tenant,store:stores.A},false],
 ['unsigned identity',{...actors.B,signed:false},{tenant,store:stores.B},false],
 ['viewer same store',{...actors.A,role:'viewer'},{tenant,store:stores.A},true],
 ['unknown role',{...actors.A,role:'admin-godmode'},{tenant,store:stores.A},false]
];
for(const [name,actor,req,want] of cases){
  test('synthetic store negative oracle: '+name,()=>assert.equal(canRead(actor,req),want));
}
test('fixture is clearly not a hosted JWT test',()=>assert.equal(typeof actors.A.uid,'string'));

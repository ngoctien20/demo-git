'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {FLAGS,createReadOnlyAdmission}=require('./readonly-admission.cjs');
const valid=Date.UTC(2026,10,20);
const NOW=Date.UTC(2026,10,18);
const sessions={
  'qa-session-owner-a':{subject:'owner-a',sessionId:'session-a',verificationSource:'backend_authoritative',status:'active',issuer:'synthetic-qa-issuer',audience:'tien404-synthetic-gateway',expiresAtMs:valid},
  'qa-session-owner-b':{subject:'owner-b',sessionId:'session-b',verificationSource:'backend_authoritative',status:'active',issuer:'synthetic-qa-issuer',audience:'tien404-synthetic-gateway',expiresAtMs:valid},
  'qa-session-owner-c':{subject:'owner-c',sessionId:'session-c',verificationSource:'backend_authoritative',status:'active',issuer:'synthetic-qa-issuer',audience:'tien404-synthetic-gateway',expiresAtMs:valid},
  'qa-session-manager-a':{subject:'manager-a',sessionId:'session-ma',verificationSource:'backend_authoritative',status:'active',issuer:'synthetic-qa-issuer',audience:'tien404-synthetic-gateway',expiresAtMs:valid},
  'qa-session-staff-a':{subject:'staff-a',sessionId:'session-sa',verificationSource:'backend_authoritative',status:'active',issuer:'synthetic-qa-issuer',audience:'tien404-synthetic-gateway',expiresAtMs:valid},
  'qa-session-revoked':{subject:'revoked-a',sessionId:'session-ra',verificationSource:'backend_authoritative',status:'active',issuer:'synthetic-qa-issuer',audience:'tien404-synthetic-gateway',expiresAtMs:valid},
};
const memberships=[
  {subject:'owner-a',tenantKey:'tenant-one',storeKey:'store-a',active:true,storeStatus:'active',role:'owner'},
  {subject:'owner-b',tenantKey:'tenant-one',storeKey:'store-b',active:true,storeStatus:'active',role:'owner'},
  {subject:'owner-c',tenantKey:'tenant-two',storeKey:'store-c',active:true,storeStatus:'active',role:'owner'},
  {subject:'manager-a',tenantKey:'tenant-one',storeKey:'store-a',active:true,storeStatus:'active',role:'manager'},
  {subject:'staff-a',tenantKey:'tenant-one',storeKey:'store-a',active:true,storeStatus:'active',role:'staff'},
  {subject:'revoked-a',tenantKey:'tenant-one',storeKey:'store-a',active:false,storeStatus:'active',role:'owner'},
];
const pages={
  'page-a':{pageKey:'page-a',platform:'messenger',tenantKey:'tenant-one',storeKey:'store-a',status:'connected',qa:'SYNTHETIC_QA'},
  'page-b':{pageKey:'page-b',platform:'messenger',tenantKey:'tenant-one',storeKey:'store-b',status:'connected',qa:'SYNTHETIC_QA'},
  'page-c':{pageKey:'page-c',platform:'messenger',tenantKey:'tenant-two',storeKey:'store-c',status:'connected',qa:'SYNTHETIC_QA'},
};
function make({s={},m=memberships,p=pages,clock=NOW}={}) {
 const local={...sessions,...s};
 return createReadOnlyAdmission({
  resolveVerifiedSession:async handle=>local[handle],
  readStoreMembership:async (subject,storeKey)=>m.find(x=>x.subject===subject&&x.storeKey===storeKey),
  readPageConnection:async pageId=>p[pageId],now:()=>clock,
 });
}
const A={serverSessionHandle:'qa-session-owner-a',selectedStoreKey:'store-a',operation:'authority.readonly.check'};
const B={serverSessionHandle:'qa-session-owner-b',selectedStoreKey:'store-b',operation:'authority.readonly.check'};
const C={serverSessionHandle:'qa-session-owner-c',selectedStoreKey:'store-c',operation:'authority.readonly.check'};
const preview=(a,pageId)=>({...a,operation:'channel.connection.preview',pageId});
const denies=async(p,req,code)=>assert.rejects(()=>p.inspect(req),{code});
test('safety flags are always mock/no send/no write/no private order',()=>assert.deepEqual(FLAGS,{mode:'SYNTHETIC_QA',metaLiveApi:false,providerSend:false,orderWrite:false,allowPrivateOrderRead:false}));
test('missing backends refused',()=>assert.throws(()=>createReadOnlyAdmission(),{code:'BACKEND_DEPENDENCIES_REQUIRED'}));
test('Owner A read-only admission allowed',async()=>assert.equal((await make().inspect(A)).decision,'READ_ONLY_ALLOWED'));
test('Owner B same tenant read-only admission allowed',async()=>assert.equal((await make().inspect(B)).decision,'READ_ONLY_ALLOWED'));
test('Owner C other tenant read-only admission allowed',async()=>assert.equal((await make().inspect(C)).decision,'READ_ONLY_ALLOWED'));
test('Owner A page A preview allowed',async()=>assert.equal((await make().inspect(preview(A,'page-a'))).canSend,false));
test('Owner B page B preview allowed',async()=>assert.equal((await make().inspect(preview(B,'page-b'))).canReadOrders,false));
test('Owner C page C preview allowed',async()=>assert.equal((await make().inspect(preview(C,'page-c'))).canWriteOrders,false));
test('Owner A cannot select store B within same tenant',()=>denies(make(),{...A,selectedStoreKey:'store-b'},'STORE_AUTHORITY_DENIED'));
test('Owner B cannot select store A within same tenant',()=>denies(make(),{...B,selectedStoreKey:'store-a'},'STORE_AUTHORITY_DENIED'));
test('Owner A cannot select store C of another tenant',()=>denies(make(),{...A,selectedStoreKey:'store-c'},'STORE_AUTHORITY_DENIED'));
test('Owner A cannot preview Page B of same tenant',()=>denies(make(),preview(A,'page-b'),'PAGE_AUTHORITY_DENIED'));
test('Owner B cannot preview Page A of same tenant',()=>denies(make(),preview(B,'page-a'),'PAGE_AUTHORITY_DENIED'));
test('Owner A cannot preview Page C of another tenant',()=>denies(make(),preview(A,'page-c'),'PAGE_AUTHORITY_DENIED'));
test('unknown Page refused',()=>denies(make(),preview(A,'page-unknown'),'PAGE_AUTHORITY_DENIED'));
test('manager can preview own store Page',async()=>assert.equal((await make().inspect(preview({...A,serverSessionHandle:'qa-session-manager-a'},'page-a'))).decision,'READ_ONLY_ALLOWED'));
test('staff forbidden to administrate connection',()=>denies(make(),{...A,serverSessionHandle:'qa-session-staff-a'},'STORE_AUTHORITY_DENIED'));
test('revoked owner forbidden',()=>denies(make(),{...A,serverSessionHandle:'qa-session-revoked'},'STORE_AUTHORITY_DENIED'));
test('no session handle',()=>denies(make(),{...A,serverSessionHandle:undefined},'SERVER_SESSION_REQUIRED'));
test('unknown session handle',()=>denies(make(),{...A,serverSessionHandle:'qa-session-missing'},'SESSION_AUTHORITY_DENIED'));
test('malformed store selector',()=>denies(make(),{...A,selectedStoreKey:'../store-b'},'STORE_SELECTOR_INVALID'));
test('unknown store selector',()=>denies(make(),{...A,selectedStoreKey:'store-does-not-exist'},'STORE_AUTHORITY_DENIED'));
test('missing operation',()=>denies(make(),{...A,operation:undefined},'READONLY_OPERATION_REQUIRED'));
for (const op of ['orders.read','orders.create','orders.update','inventory.write','provider.send','meta.oauth.live']) {
 test(`unsupported ${op} denied`,()=>denies(make(),{...A,operation:op},'READONLY_OPERATION_REQUIRED'));
}
test('page selector for non-page operation denied',()=>denies(make(),{...A,pageId:'page-a'},'PAGE_NOT_ALLOWED_FOR_OPERATION'));
test('missing Page selector denied',()=>denies(make(),preview(A,undefined),'PAGE_SELECTOR_INVALID'));
test('client forged tenant denied',()=>denies(make(),{...A,clientBody:{tenantId:'tenant-two'}},'CLIENT_AUTHORITY_FORBIDDEN'));
test('client forged role denied',()=>denies(make(),{...A,clientBody:{role:'owner'}},'CLIENT_AUTHORITY_FORBIDDEN'));
test('client forged verification flag denied',()=>denies(make(),{...A,clientBody:{verified:true}},'CLIENT_AUTHORITY_FORBIDDEN'));
test('client provided token denied',()=>denies(make(),{...A,clientBody:{access_token:'not-real'}},'CLIENT_AUTHORITY_FORBIDDEN'));
test('unexpected request body denied',()=>denies(make(),{...A,clientBody:{extra:1}},'UNEXPECTED_CLIENT_PAYLOAD'));
test('session resolver attacker-supplied verified-but-not-authoritative denied',()=>denies(make({s:{'qa-session-owner-a':{...sessions['qa-session-owner-a'],verificationSource:'browser'}}}),A,'SESSION_AUTHORITY_DENIED'));
test('expired session denied',()=>denies(make({s:{'qa-session-owner-a':{...sessions['qa-session-owner-a'],expiresAtMs:NOW-1}}}),A,'SESSION_AUTHORITY_DENIED'));
test('inactive session denied',()=>denies(make({s:{'qa-session-owner-a':{...sessions['qa-session-owner-a'],status:'revoked'}}}),A,'SESSION_AUTHORITY_DENIED'));
test('wrong audience denied',()=>denies(make({s:{'qa-session-owner-a':{...sessions['qa-session-owner-a'],audience:'another-app'}}}),A,'SESSION_AUTHORITY_DENIED'));
test('wrong issuer denied',()=>denies(make({s:{'qa-session-owner-a':{...sessions['qa-session-owner-a'],issuer:'unknown'}}}),A,'SESSION_AUTHORITY_DENIED'));
test('missing subject denied',()=>denies(make({s:{'qa-session-owner-a':{...sessions['qa-session-owner-a'],subject:''}}}),A,'SESSION_AUTHORITY_DENIED'));
test('membership inactive denied even with active session',()=>denies(make({m:memberships.map(x=>x.subject==='owner-a'?{...x,active:false}:x)}),A,'STORE_AUTHORITY_DENIED'));
test('store disabled denied',()=>denies(make({m:memberships.map(x=>x.subject==='owner-a'?{...x,storeStatus:'disabled'}:x)}),A,'STORE_AUTHORITY_DENIED'));
test('membership subject mismatch denied',()=>denies(make({m:memberships.map(x=>x.subject==='owner-a'?{...x,subject:'other-user'}:x)}),A,'STORE_AUTHORITY_DENIED'));
test('page disabled denied',()=>denies(make({p:{...pages,'page-a':{...pages['page-a'],status:'reauthorization_required'}}}),preview(A,'page-a'),'PAGE_AUTHORITY_DENIED'));
test('page wrong platform denied',()=>denies(make({p:{...pages,'page-a':{...pages['page-a'],platform:'zalo'}}}),preview(A,'page-a'),'PAGE_AUTHORITY_DENIED'));
test('page wrong tenant denied',()=>denies(make({p:{...pages,'page-a':{...pages['page-a'],tenantKey:'tenant-two'}}}),preview(A,'page-a'),'PAGE_AUTHORITY_DENIED'));
test('page wrong QA status denied',()=>denies(make({p:{...pages,'page-a':{...pages['page-a'],qa:'REAL'}}}),preview(A,'page-a'),'PAGE_AUTHORITY_DENIED'));
test('no provider sends or DB writes from module',async()=>{const gate=make();await gate.inspect(preview(A,'page-a'));await gate.inspect(preview(B,'page-b'));assert.deepEqual(gate.getMetrics(),{externalCalls:0,providerSends:0,orderWrites:0});});
test('response contains no session, tenant, user or token',async()=>{const response=JSON.stringify(await make().inspect(A));for(const phrase of ['session-a','owner-a','tenant-one','token','secret','jwt'])assert.equal(response.includes(phrase),false);});

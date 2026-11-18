'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {FLAGS,createProtectedUatGate}=require('./protected-uat-gate.cjs');
const NOW=Date.UTC(2026,10,18);
const ACCESS={source:'trusted-host-runtime',operatorVerified:true,authorized:true,audience:'private-staging-qa',role:'qa-operator'};
const ACTORS={
 browserA:{principalAlias:'owner-a',sessionAlias:'session-a',verifiedBy:'trusted-auth-server',status:'active',issuer:'synthetic-auth',audience:'synthetic-owner-uat',expiresAt:NOW+100_000},
 browserB:{principalAlias:'owner-b',sessionAlias:'session-b',verifiedBy:'trusted-auth-server',status:'active',issuer:'synthetic-auth',audience:'synthetic-owner-uat',expiresAt:NOW+100_000},
 browserC:{principalAlias:'owner-c',sessionAlias:'session-c',verifiedBy:'trusted-auth-server',status:'active',issuer:'synthetic-auth',audience:'synthetic-owner-uat',expiresAt:NOW+100_000},
 staffA:{principalAlias:'staff-a',sessionAlias:'session-staff',verifiedBy:'trusted-auth-server',status:'active',issuer:'synthetic-auth',audience:'synthetic-owner-uat',expiresAt:NOW+100_000},
 managerA:{principalAlias:'manager-a',sessionAlias:'session-manager',verifiedBy:'trusted-auth-server',status:'active',issuer:'synthetic-auth',audience:'synthetic-owner-uat',expiresAt:NOW+100_000},
 revokedA:{principalAlias:'revoked-a',sessionAlias:'session-revoked',verifiedBy:'trusted-auth-server',status:'active',issuer:'synthetic-auth',audience:'synthetic-owner-uat',expiresAt:NOW+100_000},
};
const MEMBERS=[
 {principalAlias:'owner-a',tenantAlias:'tenant-one',storeAlias:'store-a',role:'owner',active:true,storeStatus:'active'},
 {principalAlias:'owner-b',tenantAlias:'tenant-one',storeAlias:'store-b',role:'owner',active:true,storeStatus:'active'},
 {principalAlias:'owner-c',tenantAlias:'tenant-two',storeAlias:'store-c',role:'owner',active:true,storeStatus:'active'},
 {principalAlias:'manager-a',tenantAlias:'tenant-one',storeAlias:'store-a',role:'manager',active:true,storeStatus:'active'},
 {principalAlias:'staff-a',tenantAlias:'tenant-one',storeAlias:'store-a',role:'staff',active:true,storeStatus:'active'},
 {principalAlias:'revoked-a',tenantAlias:'tenant-one',storeAlias:'store-a',role:'owner',active:false,storeStatus:'active'}
];
const PAGES={
 'page-a':{pageAlias:'page-a',tenantAlias:'tenant-one',storeAlias:'store-a',platform:'messenger',status:'connected',qa:'SYNTHETIC_QA'},
 'page-b':{pageAlias:'page-b',tenantAlias:'tenant-one',storeAlias:'store-b',platform:'messenger',status:'connected',qa:'SYNTHETIC_QA'},
 'page-c':{pageAlias:'page-c',tenantAlias:'tenant-two',storeAlias:'store-c',platform:'messenger',status:'connected',qa:'SYNTHETIC_QA'}
};
const base={selectedStoreAlias:'store-a',probe:'store.admission.check'};
const page=(p='page-a',selectedStoreAlias='store-a')=>({selectedStoreAlias,probe:'page.connection.preview',pageAlias:p});
function fixture(options={}){
 const audit=[];const sessions={...ACTORS,...options.sessions};const pages={...PAGES,...options.pages};
 const gate=createProtectedUatGate({
   verifyPrivateAccessContext:async c=>options.access??(c&&c.privateAccess),
   resolveBackendSession:async c=>options.noSession?null:sessions[c?.browserAlias],
   findCanonicalMembership:async ({principalAlias,selectedStoreAlias})=>(options.members||MEMBERS).find(x=>x.principalAlias===principalAlias&&x.storeAlias===selectedStoreAlias),
   findPageConnection:async ({pageAlias})=>pages[pageAlias],
   recordSafeAudit:async ev=>{audit.push(ev); if(options.auditError)throw Error('internal audit infrastructure secret');return !options.auditDeny},
   now:()=>NOW,
 });
 return {gate,audit,ctx:(browserAlias='browserA')=>({browserAlias,privateAccess:ACCESS})};
}
const run=async (f,b=base,who='browserA',ctx)=>f.gate.probe({clientBody:b,privateContext:ctx??f.ctx(who)});
const expectCode=async(f,b,who,code,ctx)=>{const r=await run(f,b,who,ctx);assert.equal(r.code,code);assert.equal(r.decision,'DENY');return r};
test('hard zero-side-effect flags',()=>assert.deepEqual(FLAGS,{qaMode:'SYNTHETIC_QA',liveAuth:false,liveMeta:false,customerDataRead:false,privateOrderRead:false,orderWrite:false,providerSend:false,databaseWrite:false}));
test('requires all backend adapters',()=>assert.throws(()=>createProtectedUatGate(),/TRUSTED_ADAPTERS_REQUIRED/));
test('owner A allowed store A',async()=>assert.equal((await run(fixture())).decision,'ALLOW'));
test('owner B allowed same-tenant store B',async()=>assert.equal((await run(fixture(),{...base,selectedStoreAlias:'store-b'},'browserB')).decision,'ALLOW'));
test('owner C allowed other-tenant store C',async()=>assert.equal((await run(fixture(),{...base,selectedStoreAlias:'store-c'},'browserC')).decision,'ALLOW'));
test('owner A page A preview allowed',async()=>assert.equal((await run(fixture(),page())).decision,'ALLOW'));
test('owner B page B preview allowed',async()=>assert.equal((await run(fixture(),page('page-b','store-b'),'browserB')).decision,'ALLOW'));
test('owner A blocked store B same tenant',async()=>expectCode(fixture(),{...base,selectedStoreAlias:'store-b'},'browserA','ACCESS_DENIED'));
test('owner B blocked store A same tenant',async()=>expectCode(fixture(),base,'browserB','ACCESS_DENIED'));
test('owner A blocked store C other tenant',async()=>expectCode(fixture(),{...base,selectedStoreAlias:'store-c'},'browserA','ACCESS_DENIED'));
test('owner A blocked Page B within same tenant',async()=>expectCode(fixture(),page('page-b'),'browserA','ACCESS_DENIED'));
test('owner B blocked Page A',async()=>expectCode(fixture(),page('page-a','store-b'),'browserB','ACCESS_DENIED'));
test('owner A blocked Page C',async()=>expectCode(fixture(),page('page-c'),'browserA','ACCESS_DENIED'));
test('unknown Page indistinguishable from another store',async()=>{const f=fixture();const a=await run(f,page('page-unknown'));const b=await run(f,page('page-b'));assert.equal(a.code,b.code)});
test('staff not authorized',async()=>expectCode(fixture(),base,'staffA','ACCESS_DENIED'));
test('manager A allowed',async()=>assert.equal((await run(fixture(),base,'managerA')).decision,'ALLOW'));
test('revoked membership denied',async()=>expectCode(fixture(),base,'revokedA','ACCESS_DENIED'));
test('missing Access context denied',async()=>expectCode(fixture(),base,'browserA','PROTECTED_CONTEXT_REQUIRED',{browserAlias:'browserA'}));
for (const [name,access] of Object.entries({unverified:{...ACCESS,operatorVerified:false},wrongAudience:{...ACCESS,audience:'public'},wrongRole:{...ACCESS,role:'user'},noHostOrigin:{...ACCESS,source:'browser-header'},notAuthorized:{...ACCESS,authorized:false}})){
 test(`Access ${name} denied`,async()=>expectCode(fixture(),base,'browserA','PROTECTED_CONTEXT_REQUIRED',{browserAlias:'browserA',privateAccess:access}));
}
test('unknown owner session fails closed',async()=>expectCode(fixture(),base,'missingBrowser','AUTH_REQUIRED'));
test('missing backend session fails closed',async()=>expectCode(fixture({noSession:true}),base,'browserA','AUTH_REQUIRED'));
for (const [name,change] of Object.entries({expired:{expiresAt:NOW},badIssuer:{issuer:'wrong'},badAudience:{audience:'wrong'},clientAsserted:{verifiedBy:'client'},revoked:{status:'revoked'},noSessionAlias:{sessionAlias:''},noPrincipal:{principalAlias:''}})){
 test(`session ${name} denied`,async()=>{const f=fixture({sessions:{browserA:{...ACTORS.browserA,...change}}});await expectCode(f,base,'browserA','AUTH_REQUIRED')});
}
for (const [name,change] of Object.entries({disabledStore:{storeStatus:'disabled'},inactiveMembership:{active:false},roleStaff:{role:'staff'},wrongPrincipal:{principalAlias:'owner-b'},wrongStore:{storeAlias:'store-b'},badTenant:{tenantAlias:'../../evil'}})){
 test(`membership ${name} denied`,async()=>{const members=[{...MEMBERS[0],...change},...MEMBERS.slice(1)];await expectCode(fixture({members}),base,'browserA','ACCESS_DENIED')});
}
for (const [name,change] of Object.entries({paused:{status:'paused'},wrongStore:{storeAlias:'store-b'},wrongTenant:{tenantAlias:'tenant-two'},unverified:{qa:'SOMETHING_ELSE'},wrongProvider:{platform:'zalo'},wrongPage:{pageAlias:'page-b'}})){
 test(`page ${name} denied`,async()=>{const f=fixture({pages:{'page-a':{...PAGES['page-a'],...change}}});await expectCode(f,page(),'browserA','ACCESS_DENIED')});
}
for (const probeName of ['orders.read','orders.create','provider.send','payments.capture','inventory.write','meta.oauth.live','customer.read','tenant.list','rpc.call']){
 test(`operation ${probeName} denied`,async()=>expectCode(fixture(),{...base,probe:probeName},'browserA','BAD_INPUT'));
}
for (const authority of [{tenantId:'tenant-one'},{storeId:'store-a'},{userId:'owner-a'},{role:'owner'},{verified:true},{jwt:'synthetic-jwt'},{accessToken:'fake'},{cookies:'fake'},{sessionId:'fake'},{isAdmin:true},{authorization:'Bearer FAKE'},{pageToken:'fake'}, {orderId:'one'}]){
 const name=Object.keys(authority)[0];test(`client forged ${name} denied`,async()=>expectCode(fixture(),{...base,...authority},'browserA','BAD_INPUT'));
}
for (const body of [null,[],{},'text',0,JSON.parse('{"__proto__":{"admin":true},"selectedStoreAlias":"store-a","probe":"store.admission.check"}'),{...base,selectedStoreAlias:'../other'},{...base,selectedStoreAlias:'store_A'}, {selectedStoreAlias:'store-a',probe:'page.connection.preview'}, {...base,pageAlias:'page-a'}]){
 test(`invalid payload ${JSON.stringify(body)?.slice(0,40)} denied`,async()=>expectCode(fixture(),body,'browserA','BAD_INPUT'));
}
test('successful output excludes identifiers and secret properties',async()=>{const r=await run(fixture());const t=JSON.stringify(r);for(const key of ['storeAlias','tenantAlias','principalAlias','sessionAlias','pageAlias','token','userId','orderId','cookie','header'])assert.equal(t.includes(key),false);assert.equal(r.storeRlsVerified,false);assert.equal(r.realOwnerSessionsVerified,false)});
test('denied output excludes private identity',async()=>{const r=await run(fixture(),page('page-b'));assert.equal(JSON.stringify(r).includes('page-b'),false);assert.equal(JSON.stringify(r).includes('owner-a'),false)});
test('audit only stores safe decision metadata',async()=>{const f=fixture();await run(f);assert.equal(f.audit.length,1);assert.deepEqual(Object.keys(f.audit[0]).sort(),['code','decision','probe','scope'])});
test('audit failure denies even previously allowed decision',async()=>expectCode(fixture({auditError:true}),base,'browserA','UAT_UNAVAILABLE'));
test('audit denial denies even previously allowed decision',async()=>expectCode(fixture({auditDeny:true}),base,'browserA','UAT_UNAVAILABLE'));
test('no network, order read/write or provider sends',async()=>{const f=fixture();await run(f);await run(f,page());assert.deepEqual(f.gate.getMetrics(),{metaCalls:0,orderReads:0,orderWrites:0,sends:0})});

import test from 'node:test';
import assert from 'node:assert/strict';
import {projectQaUnifiedInbox} from './unified-inbox-qa-projection.mjs';
const NOW=1794900000000;
const access=(bindingId,channel,storeId='store-A',tenantId='tenant-SHARED')=>({
 previewAllowed:true,source:'QA_SYNTHETIC_STAFF_PREVIEW',
 action:'INBOX_READ',authRealVerified:false,storeRlsVerified:false,
 canReadHostedInbox:false,canActivateHandoff:false,noSend:true,
 bindingId,channel,storeId,tenantId
});
const row=(bindingId,channel,conversationId='conv-A')=>({
 source:'QA_SYNTHETIC_INBOX_ROW',marker:'SYNTHETIC_NO_CUSTOMER_PII',
 tenantId:'tenant-SHARED',storeId:'store-A',bindingId,channel,conversationId,
 state:'HANDOFF_PENDING',displayLabel:'Khách QA 01',previewText:'Nhờ nhân viên tư vấn',
 updatedAtMs:NOW,assignedStaffId:null
});
function fixture() {
 const f={executionMode:'OFFLINE_SYNTHETIC_UNIFIED_INBOX',hostedReadEnabled:false,
  rows:[row('bind-M','messenger','conv-01'),row('bind-OA','zalo_oa','conv-02'),
    row('bind-W','website_widget','conv-03')],
  readQaRows:async()=>f.rows
 };
 return f;
}
const input=()=>({storeId:'store-A',accessDecisions:[
 access('bind-M','messenger'),access('bind-OA','zalo_oa'),access('bind-W','website_widget')
]});
async function okay(i=input(),f=fixture()){
 const x=await projectQaUnifiedInbox(i,f);
 assert.equal(x.ok,true,JSON.stringify(x));
 assert.equal(x.noHostedRead,true);
 assert.equal(x.noSend,true);
 assert.equal(x.canReply,false);
 assert.equal(x.realJwtRlsVerified,false);
 return x;
}
async function denied(reason,i=input(),f=fixture()){
 const x=await projectQaUnifiedInbox(i,f);
 assert.equal(x.ok,false,JSON.stringify(x));
 assert.equal(x.reason,reason);
 assert.deepEqual(x.rows,[]);
}
test('one Store aggregates Messenger Zalo OA and Website QA rows',async()=>{
 const x=await okay();
 assert.equal(x.rowCount,3);
 assert.deepEqual(new Set(x.rows.map(z=>z.channel)),
 new Set(['messenger','zalo_oa','website_widget']));
});
test('sort by recent timestamp stable for same timestamp',async()=>{
 const f=fixture();f.rows[0].updatedAtMs=NOW-1;
 const x=await okay(input(),f);
 assert.equal(x.rows.at(-1).channel,'messenger');
});
test('channel filter restricts to exact selection',async()=>{
 const x=await okay({...input(),channel:'zalo_oa'});
 assert.equal(x.rowCount,1);
 assert.equal(x.rows[0].channel,'zalo_oa');
});
test('state filter excludes all nonmatching rows',async()=>{
 const x=await okay({...input(),state:'HUMAN_ACTIVE'});
 assert.equal(x.rowCount,0);
});
test('invalid channel filter rejected',async()=>denied('INVALID_CHANNEL_FILTER',{...input(),channel:'facebook_personal'}));
test('invalid state filter rejected',async()=>denied('INVALID_STATE_FILTER',{...input(),state:'ORDER_PAID'}));
test('no access decisions rejected',async()=>denied('ACCESS_SCOPE_REQUIRED',{storeId:'store-A',accessDecisions:[]}));
test('client self-reported access denied',async()=>{
 const i=input();i.accessDecisions[0].source='CLIENT_SELF_REPORTED';
 await denied('STAFF_PREVIEW_SCOPE_DENIED',i);
});
test('wrong Store authority denied',async()=>{
 const i=input();i.accessDecisions[0].storeId='store-B';
 await denied('STAFF_PREVIEW_SCOPE_DENIED',i);
});
test('mixed Tenant scope denied',async()=>{
 const i=input();i.accessDecisions[2].tenantId='tenant-B';
 await denied('CROSS_TENANT_SCOPES_DENIED',i);
});
test('real hosted access mode refused',async()=>{
 const f=fixture();f.hostedReadEnabled=true;
 await denied('SYNTHETIC_INBOX_ONLY',input(),f);
});
test('synthetic result cannot claim real JWT/RLS acceptance',async()=>{
 const i=input();i.accessDecisions[0].storeRlsVerified=true;
 await denied('STAFF_PREVIEW_SCOPE_DENIED',i);
});
test('foreign Store row rejects whole result, not merely filters it',async()=>{
 const f=fixture();f.rows[2].storeId='store-B';
 await denied('FOREIGN_OR_UNSAFE_ROW',input(),f);
});
test('foreign Tenant row rejects whole result',async()=>{
 const f=fixture();f.rows[2].tenantId='tenant-B';
 await denied('FOREIGN_OR_UNSAFE_ROW',input(),f);
});
test('row with unknown channel binding rejected',async()=>{
 const f=fixture();f.rows[1].bindingId='bind-OTHER';
 await denied('UNAUTHORIZED_CHANNEL_BINDING',input(),f);
});
test('real customer row instead of synthetic marker blocked',async()=>{
 const f=fixture();f.rows[0].marker='REAL_CUSTOMER_DATA';
 await denied('FOREIGN_OR_UNSAFE_ROW',input(),f);
});
test('hidden raw customer identity field rejects entire result',async()=>{
 const f=fixture();f.rows[0].customerPhone='0912345678';
 await denied('FOREIGN_OR_UNSAFE_ROW',input(),f);
});
test('phone in preview is blocked',async()=>{
 const f=fixture();f.rows[1].previewText='SĐT 0912345678';
 await denied('FOREIGN_OR_UNSAFE_ROW',input(),f);
});
test('email in preview is blocked',async()=>{
 const f=fixture();f.rows[1].previewText='khach@example.com';
 await denied('FOREIGN_OR_UNSAFE_ROW',input(),f);
});
test('HTML and injection-like markup refused',async()=>{
 const f=fixture();f.rows[1].previewText='<img src=x onerror=alert(1)>';
 await denied('FOREIGN_OR_UNSAFE_ROW',input(),f);
});
test('duplicate same conversation rejected across result',async()=>{
 const f=fixture();f.rows.push({...f.rows[0]});
 await denied('DUPLICATE_CONVERSATION',input(),f);
});
test('result over bounded page size denied',async()=>{
 const f=fixture();f.rows=Array.from({length:101},(_,k)=>row('bind-M','messenger','conv-'+String(k).padStart(3,'0')));
 await denied('FIXTURE_RESULT_INVALID',input(),f);
});
test('backend QA read failure denied',async()=>{
 const f=fixture();f.readQaRows=async()=>{throw Error('unavailable')};
 await denied('FIXTURE_READER_UNAVAILABLE',input(),f);
});
test('read access cannot escalate to assignment',async()=>{
 const i=input();i.accessDecisions[0].action='INBOX_ASSIGN';
 await denied('STAFF_PREVIEW_SCOPE_DENIED',i);
});
test('QA result carries no action-permitting flag',async()=>{
 const x=await okay();
 assert.equal(x.canAssign,false);
 assert.equal(x.realStaffAuthorized,false);
 assert.equal(JSON.stringify(x).includes('accessToken'),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySyntheticMetaHandoverShape}
 from './meta-handover-fixture-classifier.mjs';
const NOW=1794900000000;
const ctx=()=>({executionMode:'OFFLINE_FIXTURE_ONLY',liveEnabled:false,
 qaPageId:'12345678901',qaTesterPsid:'22345678901',
 qaBotAppId:'32345678901',qaStaffAppId:'42345678901',
 expectedState:'HANDOFF_PENDING',nowMs:NOW});
const event=(key='pass_thread_control')=>({
 object:'page',entry:[{id:'12345678901',messaging:[{
 sender:{id:'22345678901'},recipient:{id:'12345678901'},timestamp:NOW,
 [key]:{previous_owner_app_id:key==='pass_thread_control'?'32345678901':'42345678901',
 new_owner_app_id:key==='pass_thread_control'?'42345678901':'32345678901'}
 }]}]
});
const deny=(p,c,code)=>{const r=classifySyntheticMetaHandoverShape(p,c);
 assert.equal(r.recognizedFixture,false,JSON.stringify(r));
 assert.equal(r.code,code);assert.equal(r.canAdvanceHandoff,false);
 assert.equal(r.noSend,true);assert.equal(r.realMetaHmacVerified,false);};
test('synthetic pass_thread_control shape recognized but never as signed Meta',()=>{
 const r=classifySyntheticMetaHandoverShape(event(),ctx());
 assert.equal(r.recognizedFixture,true);
 assert.equal(r.eventClass,'pass_thread_control');
 assert.equal(r.realMetaHmacVerified,false);
 assert.equal(r.canReleaseBot,false);
 assert.equal(r.canAdvanceHandoff,false);
 assert.equal(r.providerCalls,0);
});
test('synthetic take_thread_control shape recognized in resume state, still no resume',()=>{
 const c=ctx();c.expectedState='RESUME_PENDING';
 const r=classifySyntheticMetaHandoverShape(event('take_thread_control'),c);
 assert.equal(r.recognizedFixture,true);
 assert.equal(r.canReleaseBot,false);
 assert.equal(r.requiresNativeSchemaUat,true);
});
test('never allow real provider execution',()=>{
 const c=ctx();c.executionMode='PRODUCTION';
 deny(event(),c,'NOT_AUTHORIZED_FOR_REAL_EVENT');
});
test('liveEnabled true cannot be enabled',()=>{
 const c=ctx();c.liveEnabled=true;
 deny(event(),c,'NOT_AUTHORIZED_FOR_REAL_EVENT');
});
test('app identities must be different',()=>{
 const c=ctx();c.qaStaffAppId=c.qaBotAppId;
 deny(event(),c,'NOT_AUTHORIZED_FOR_REAL_EVENT');
});
test('missing Page owner scope denied',()=>{
 const c=ctx();delete c.qaPageId;
 deny(event(),c,'NOT_AUTHORIZED_FOR_REAL_EVENT');
});
test('batch of multiple entries denied',()=>{
 const a=event();a.entry.push(a.entry[0]);
 deny(a,ctx(),'META_PAGE_BATCH_SHAPE_INVALID');
});
test('batch multiple messenger events denied',()=>{
 const a=event();a.entry[0].messaging.push(a.entry[0].messaging[0]);
 deny(a,ctx(),'QA_PAGE_OR_EVENT_COUNT_MISMATCH');
});
test('wrong Page ID denied',()=>{
 const a=event();a.entry[0].id='54321098765';
 deny(a,ctx(),'QA_PAGE_OR_EVENT_COUNT_MISMATCH');
});
test('additional tenant claim in callback denied',()=>{
 const a=event();a.tenantId='tenant-evil';
 deny(a,ctx(),'META_PAGE_BATCH_SHAPE_INVALID');
});
test('Meta actor PSID spoofed denied',()=>{
 const a=event();a.entry[0].messaging[0].sender.id='99887766554';
 deny(a,ctx(),'META_QA_SENDER_RECIPIENT_OR_TIMESTAMP_INVALID');
});
test('wrong Page recipient denied',()=>{
 const a=event();a.entry[0].messaging[0].recipient.id='99887766554';
 deny(a,ctx(),'META_QA_SENDER_RECIPIENT_OR_TIMESTAMP_INVALID');
});
test('stale event denied',()=>{
 const a=event();a.entry[0].messaging[0].timestamp=NOW-300001;
 deny(a,ctx(),'META_QA_SENDER_RECIPIENT_OR_TIMESTAMP_INVALID');
});
test('future event denied',()=>{
 const a=event();a.entry[0].messaging[0].timestamp=NOW+300001;
 deny(a,ctx(),'META_QA_SENDER_RECIPIENT_OR_TIMESTAMP_INVALID');
});
test('text message instead of native handover cannot unlock bot',()=>{
 const a=event();delete a.entry[0].messaging[0].pass_thread_control;
 a.entry[0].messaging[0].message={mid:'QA-1',text:'Hello'};
 deny(a,ctx(),'META_HANDOVER_EVENT_SHAPE_INVALID');
});
test('unexpected handover metadata field is ignored only when bounded',()=>{
 const a=event();a.entry[0].messaging[0].pass_thread_control.metadata='QA-only';
 assert.equal(classifySyntheticMetaHandoverShape(a,ctx()).recognizedFixture,true);
 a.entry[0].messaging[0].pass_thread_control.metadata='x'.repeat(129);
 deny(a,ctx(),'NATIVE_TRANSFER_APP_SHAPE_UNVERIFIED');
});
test('unknown native event property rejected',()=>{
 const a=event();a.entry[0].messaging[0].pass_thread_control.accessToken='not-real';
 deny(a,ctx(),'NATIVE_TRANSFER_APP_SHAPE_UNVERIFIED');
});
test('previous owner App swapped denied',()=>{
 const a=event();a.entry[0].messaging[0].pass_thread_control.previous_owner_app_id='55555555555';
 deny(a,ctx(),'MISMATCHED_EXPECTED_THREAD_OWNER');
});
test('new owner App swapped denied',()=>{
 const a=event();a.entry[0].messaging[0].pass_thread_control.new_owner_app_id='55555555555';
 deny(a,ctx(),'MISMATCHED_EXPECTED_THREAD_OWNER');
});
test('previous and new app same invalid',()=>{
 const a=event();a.entry[0].messaging[0].pass_thread_control.previous_owner_app_id='42345678901';
 deny(a,ctx(),'NATIVE_TRANSFER_APP_SHAPE_UNVERIFIED');
});
test('take event cannot be used to satisfy pass pending',()=>{
 deny(event('take_thread_control'),ctx(),'META_HANDOVER_EVENT_SHAPE_INVALID');
});
test('pass event cannot be used to satisfy resume pending',()=>{
 const c=ctx();c.expectedState='RESUME_PENDING';
 deny(event('pass_thread_control'),c,'META_HANDOVER_EVENT_SHAPE_INVALID');
});
test('standby or request_thread_control is not takeover ACK',()=>{
 const a=event();delete a.entry[0].messaging[0].pass_thread_control;
 a.entry[0].messaging[0].request_thread_control={requested_owner_app_id:'42345678901'};
 deny(a,ctx(),'META_HANDOVER_EVENT_SHAPE_INVALID');
});
test('metadata cannot include raw app credential object',()=>{
 const a=event();a.entry[0].messaging[0].pass_thread_control.metadata={secret:'not-real'};
 deny(a,ctx(),'NATIVE_TRANSFER_APP_SHAPE_UNVERIFIED');
});

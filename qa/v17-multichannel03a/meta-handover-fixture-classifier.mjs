// TIEN404 V17.MULTI-CHANNEL-03A — synthetic native Meta Handover EVENT
// classifier, *after* the independently existing PR #243 raw-HMAC module.
// THIS CLASSIFIER DOES NOT VERIFY HMAC, Meta Page ownership, App consent, or
// recipient control and is NOT pluggable into production without a new review.
// No provider call or state transition ever occurs here.
const ID=/^\d{5,30}$/;
const valid=x=>typeof x==='string'&&ID.test(x);
const fail=(code)=>Object.freeze({
  recognizedFixture:false,code,source:'QA_SYNTHETIC_META_HANDOVER_SHAPE',
  realMetaHmacVerified:false,realPageOwnerVerified:false,
  canAdvanceHandoff:false,canReleaseBot:false,noSend:true,
  canCallGraph:false,canDeploy:false,providerCalls:0
});
const TYPES=new Set(['pass_thread_control','take_thread_control']);
const KEYS=['object','entry'];
const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
function oneShape(o,keys) {
 return plain(o)&&Object.keys(o).length===keys.length&&
  keys.every(k=>Object.hasOwn(o,k));
}
export function classifySyntheticMetaHandoverShape(input,context) {
 if(!context||context.executionMode!=='OFFLINE_FIXTURE_ONLY'||
   context.liveEnabled!==false || !valid(context.qaPageId)||
   !valid(context.qaTesterPsid)||!valid(context.qaBotAppId)||
   !valid(context.qaStaffAppId)||context.qaBotAppId===context.qaStaffAppId||
   !['HANDOFF_PENDING','RESUME_PENDING'].includes(context.expectedState))
  return fail('NOT_AUTHORIZED_FOR_REAL_EVENT');
 if(!oneShape(input,KEYS)||input.object!=='page'||
  !Array.isArray(input.entry)||input.entry.length!==1)
  return fail('META_PAGE_BATCH_SHAPE_INVALID');
 const entry=input.entry[0];
 if(!oneShape(entry,['id','messaging'])||
  entry.id!==context.qaPageId||!Array.isArray(entry.messaging)||
  entry.messaging.length!==1)
  return fail('QA_PAGE_OR_EVENT_COUNT_MISMATCH');
 const m=entry.messaging[0];
 if(!plain(m)||!oneShape(m,['sender','recipient','timestamp',
    context.expectedState==='HANDOFF_PENDING'?'pass_thread_control':'take_thread_control']))
  return fail('META_HANDOVER_EVENT_SHAPE_INVALID');
 if(!oneShape(m.sender,['id'])||!oneShape(m.recipient,['id'])||
  m.sender.id!==context.qaTesterPsid||m.recipient.id!==context.qaPageId||
  !Number.isSafeInteger(m.timestamp)||m.timestamp<=0||
  !Number.isSafeInteger(context.nowMs)||
  Math.abs(context.nowMs-m.timestamp)>300000)
  return fail('META_QA_SENDER_RECIPIENT_OR_TIMESTAMP_INVALID');
 const type=context.expectedState==='HANDOFF_PENDING'?'pass_thread_control':'take_thread_control';
 const evt=m[type];
 if(!plain(evt)||!Object.keys(evt).every(k=>[
   'previous_owner_app_id','new_owner_app_id','metadata'
  ].includes(k))||!valid(evt.previous_owner_app_id)||
  !valid(evt.new_owner_app_id)||evt.previous_owner_app_id===evt.new_owner_app_id||
  (evt.metadata!==undefined&&(typeof evt.metadata!=='string'||evt.metadata.length>128)))
  return fail('NATIVE_TRANSFER_APP_SHAPE_UNVERIFIED');
 const expectedPrevious=type==='pass_thread_control'?context.qaBotAppId:context.qaStaffAppId;
 const expectedNew=type==='pass_thread_control'?context.qaStaffAppId:context.qaBotAppId;
 if(evt.previous_owner_app_id!==expectedPrevious||evt.new_owner_app_id!==expectedNew)
  return fail('MISMATCHED_EXPECTED_THREAD_OWNER');
 return Object.freeze({
  recognizedFixture:true,code:'SYNTHETIC_HANDOVER_SHAPE_ONLY',
  eventClass:type,source:'QA_SYNTHETIC_META_HANDOVER_SHAPE',
  expectedState:context.expectedState,
  realMetaHmacVerified:false,realPageOwnerVerified:false,
  canAdvanceHandoff:false,canReleaseBot:false,noSend:true,
  canCallGraph:false,canDeploy:false,providerCalls:0,
  requiresIndependentRawHmac:true,requiresNativeSchemaUat:true,
  requiresVerifiedPageAndAtomicReplay:true
 });
}

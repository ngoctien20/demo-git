// Cross-branch compatibility test, source pinned to PR #243 exact SHA by CI.
// This does not call Meta and does not copy the old handler into this PR.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handleIsolatedMeta, CONTRACT} from '../../pinned-pr243-meta-source/qa/v171e-meta-real-event/isolated-meta-no-send.mjs';

const NOW=1794900000000;
const CFG={
  appSecret:'SYNTHETIC_QA_TEST_ONLY_32_BYTES_RANDOM_NOT_REAL',
  verifyToken:'QA_VERIFICATION_TOKEN_DUMMY_NOT_REAL',
  qaPageId:'12345678901',qaTesterPsid:'22345678901',
  qaAppId:'32345678901',productionAppId:'42345678901',
  productionPageId:'52345678901',
  ownerApproval:{
    qaAppPageIsolated:true,callbackPermissionGranted:true,
    merchantPageControlVerified:true,
    evidenceReference:'PRIVATE_SYNTHETIC_TEST_NOT_AUTHORITY',
    productionAppCallbackUnchanged:true
  },
  claimOnce: async ()=> 'claimed'
};
function signed(event,config=CFG) {
  const rawBody=Buffer.from(JSON.stringify({
    object:'page',entry:[{id:config.qaPageId,messaging:[{
      sender:{id:config.qaTesterPsid},recipient:{id:config.qaPageId},
      timestamp:NOW,...event
    }]}]
  }), 'utf8');
  const header='sha256='+createHmac('sha256',config.appSecret)
      .update(rawBody).digest('hex');
  return {method:'POST',url:'/private-qa',
    headers:{'x-hub-signature-256':header},rawBody};
}
test('pinned PR243 Meta handler source version is exact expected isolated contract',()=>{
 assert.equal(CONTRACT,'T404_V171E_ISOLATED_SIGNED_NOSEND_V1');
});
test('synthetic signed text QA is supported but never a real Meta delivery claim',async()=>{
 const event=signed({message:{mid:'mid-synthetic-1',text:'QA hello'}});
 const r=await handleIsolatedMeta(event,CFG,()=>NOW);
 assert.equal(r.status,'SIGNED_QA_EVENT_NO_SEND',JSON.stringify(r));
 assert.equal(r.meta_outbound,0);
 assert.equal(r.commerce_writes,0);
 assert.equal(r.accepted_as_real_provider_delivery,false);
});
test('signed native-looking pass_thread_control is currently NOT accepted by pinned PR243 text-only handler',async()=>{
 const event=signed({pass_thread_control:{new_owner_app_id:CFG.qaAppId,metadata:'QA-only'}});
 const r=await handleIsolatedMeta(event,CFG,()=>NOW);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'SIGNED_EVENT_NOT_ELIGIBLE_FOR_QA');
 assert.equal(r.meta_outbound,0);
});
test('signed native-looking take_thread_control is currently NOT accepted by pinned PR243 text-only handler',async()=>{
 const event=signed({take_thread_control:{previous_owner_app_id:CFG.productionAppId}});
 const r=await handleIsolatedMeta(event,CFG,()=>NOW);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'SIGNED_EVENT_NOT_ELIGIBLE_FOR_QA');
 assert.equal(r.meta_outbound,0);
});
test('synthetic signature wrong raw bytes blocked and no callback operation',async()=>{
 const event=signed({message:{mid:'mid-synthetic-1',text:'QA hello'}});
 const modified=Buffer.from(event.rawBody.toString('utf8').replace('QA hello','QA tampered'));
 const r=await handleIsolatedMeta({...event,rawBody:modified},CFG,()=>NOW);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'META_HMAC_MISMATCH');
 assert.equal(r.meta_outbound,0);
});
test('synthetic Page identity spoofing blocked by strict pinned handler',async()=>{
 const event=signed({message:{mid:'mid-synthetic-1',text:'QA hello'}});
 const parsed=JSON.parse(event.rawBody.toString('utf8'));
 parsed.entry[0].messaging[0].sender.id='998877665544';
 const rawBody=Buffer.from(JSON.stringify(parsed));
 const sig='sha256='+createHmac('sha256',CFG.appSecret).update(rawBody).digest('hex');
 const r=await handleIsolatedMeta({...event,rawBody,
     headers:{'x-hub-signature-256':sig}},CFG,()=>NOW);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'SIGNED_EVENT_NOT_ELIGIBLE_FOR_QA');
});
test('duplicate synthetic message id is suppressed by injected claim result',async()=>{
 const cfg={...CFG,claimOnce: async()=> 'duplicate'};
 const event=signed({message:{mid:'mid-synthetic-1',text:'QA hello'}},cfg);
 const r=await handleIsolatedMeta(event,cfg,()=>NOW);
 assert.equal(r.status,'DUPLICATE_IGNORED');
 assert.equal(r.meta_outbound,0);
});

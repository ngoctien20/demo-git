import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const script = () => execFileSync(process.execPath, ['config-core/n8n/build-messenger-reactions-shadow.mjs'],
  { encoding: 'utf8', timeout: 4000 });
const pageA='1234567890', pageB='2222222222', senderA='7654321098';
const row=(text='Cảm ơn shop nhé!', add={})=>({pageId:pageA,senderId:senderA,messageId:'m_testReaction2026',mediaType:'text',chatInput:text,pauseAction:'',...add});
const policy=({hmac=true,owner=true,claim=true,commerceClear=true,handoffClear=true,...rest}={})=>({
  enabled:true,tenantId:'tenant-qa',trustedTenantResolved:true,trustedPageAuthorized:true,
  freshThreadOwnershipVerified:owner,atomicClaimSucceeded:claim,handoffClear,commerceClear,
  approvalClear:true,allowedPageIds:[pageA],...rest,
});
function run(items,{config=null,signature=true,entryPage=pageA,entrySender=senderA,mid='m_testReaction2026',text='Cảm ơn shop nhé!',isQuickReply=false}={}){
  let code=script();
  if(config)code=code.replace('const PAGE_POLICIES = Object.freeze({});',
    'const PAGE_POLICIES = Object.freeze('+JSON.stringify({[pageA]:config})+');');
  const entry={id:entryPage,messaging:[{
    sender:{id:entrySender},recipient:{id:entryPage},
    timestamp:Date.now()-2000,message:{mid,text,...(isQuickReply?{quick_reply:{payload:'TIEN404:ASK:catalog'}}:{})}
  }]};
  const nodes={
    'Verify Meta Signature':{verified:signature},
    'Verify Signature Timing-Safe':{verified:signature},
    'Webhook1':{body:{object:'page',entry:[entry]}},
  };
  const $=(name)=>({first:()=>({json:nodes[name]||{}})});
  const $input={all:()=>items.map(json=>({json}))};
  const output=vm.runInNewContext('(function(){\n'+code+'\n})()',{$,$input},{timeout:2000});
  return JSON.parse(JSON.stringify(output));
}
test('shadow gate generator emits safe executable Code, no Meta network call or credentials',()=>{
  const code=script();
  assert.match(code,/PAGE_POLICIES = Object.freeze\(\{\}\)/);
  assert.match(code,/outgoingSendEnabled: false/);
  assert.doesNotMatch(code,/graph\.facebook\.com|\bfetch\s*\(|\$\.httpRequest|httpBearerAuth/);
});
test('default OFF: preserve exact menu/voice/order/handoff item JSON on Messenger draft path',()=>{
  const input=[
    row(),row('x',{mediaType:'voice',audioUrl:'https://example.invalid/x'}),
    row('Xin xem mẫu',{mediaType:'product_detail',selectedSku:'A003'}),
    row('Gặp nhân viên',{pauseAction:'handoff'}),
    row('Giới thiệu',{mediaType:'menu_reply',menuMode:'direct',menuMessage:{text:'Hi'}}),
  ];
  const out=run(input);
  assert.deepEqual(out.map(x=>x.json),input);
  assert.ok(out.every((x,i)=>x.pairedItem.item===i));
});
test('synthetic per-Page ON shadow candidate: ❤️ allowed only when trusted guards hold, but NO SEND',()=>{
  const out=run([row()],{config:policy()});
  assert.equal(out[0].json.socialReactionShadow.mode,'reaction_candidate');
  assert.equal(out[0].json.socialReactionShadow.emoji,'❤️');
  assert.equal(out[0].json.socialReactionShadow.outgoingSendEnabled,false);
});
test('disabled authority or missing atomic claim cannot bypass gate',()=>{
  for(const opts of [{owner:false},{claim:false},{commerceClear:false},{handoffClear:false}]){
    const out=run([row()],{config:policy(opts)});
    assert.notEqual(out[0].json.socialReactionShadow.mode,'reaction_candidate');
  }
  assert.notEqual(run([row()],{config:policy(),signature:false})[0].json.socialReactionShadow.mode,'reaction_candidate');
});
test('do not convert approval, SKU, menu, voice or handoff into reaction-only',()=>{
  const inputs=[
    row('Đồng ý triển khai migration'),
    row('Cảm ơn shop, báo giá sản phẩm nhé'),
    row('Cảm ơn shop nhé!',{mediaType:'product_detail',selectedSku:'A003'}),
    row('Cảm ơn shop nhé!',{menuMode:'direct'}),
    row('Cảm ơn shop nhé!',{pauseAction:'handoff'}),
    row('Cảm ơn shop nhé!',{mediaType:'voice'}),
  ];
  const out=run(inputs,{config:policy()});
  assert.ok(out.every(x=>x.json.socialReactionShadow.mode!=='reaction_candidate'));
});
test('Page/sender/MID mismatch, quick reply or wrong Page do not create reaction',()=>{
  for(const c of [{entryPage:pageB},{entrySender:'9999999999'},{mid:'m_other0001'},{isQuickReply:true}]){
    const out=run([row()],{config:policy(),...c});
    assert.notEqual(out[0].json.socialReactionShadow.mode,'reaction_candidate');
  }
  const out=run([row('Cảm ơn shop nhé!',{pageId:pageB})],{config:policy()});
  assert.equal(out[0].json.socialReactionShadow,undefined);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {customerMenu,resolvePreviewSelection,capabilityReport}=require('./button-capability.cjs');
const {createMenuRegistry}=require('../sales-lite/v131/menu-engine.cjs');
const registry=createMenuRegistry();
test('Bot Creator uses numbered text, never produces native buttons or provider payload',()=>{
  const m=customerMenu('ZALO_BOT_CREATOR');
  assert.equal(m.transport,'TEXT_NUMBERED');
  assert.equal(m.native_buttons_supported,false);assert.equal(m.native_buttons_enabled,false);
  assert.equal(m.provider_payload,null);assert.equal(m.external_sends,0);assert.equal(m.orders_written,0);
  assert.match(m.text,/1.*Xem sản phẩm/);
});
test('OA button candidate renders preview only and cannot be sent',()=>{
  const m=customerMenu('ZALO_OA');assert.equal(m.native_buttons_supported,true);
  assert.equal(m.native_buttons_enabled,false);assert.equal(m.provider_payload,null);
  assert.equal(m.buttons_preview_only,true);
});
test('All six CUSTOMER action IDs reuse V13.1 registry, without duplicate route data',()=>{
  const actions=registry.menus.get('CUSTOMER').actions.filter(a=>a.enabled);
  for(const channel of ['ZALO_BOT_CREATOR','ZALO_OA']){
    const c=customerMenu(channel).controls;
    assert.deepEqual(c.map(x=>x.action_id),actions.map(x=>x.action_id));
    assert.deepEqual(c.map(x=>x.command),actions.map(x=>x.fallback_command));
  }
});
test('Bot numbered choice requires verified permission',()=>{
  const r=resolvePreviewSelection({input:'1',permissions:['catalog:read']});
  assert.equal(r.action_id,'CUS_CATALOG');assert.equal(r.status,'ACTION_READ_PREVIEW_ONLY');
  assert.equal(r.orders_written,0);assert.equal(r.provider_send_allowed,false);
});
test('Bot choice cannot spoof internal Action ID through text',()=>{
  assert.throws(()=>resolvePreviewSelection({input:'CUS_CATALOG',permissions:['catalog:read']}),/CONTROL_NOT_FOUND/);
});
test('OA mock button can select same underlying action by action ID',()=>{
  const r=resolvePreviewSelection({channel:'ZALO_OA',input:'CUS_PRICE',permissions:['catalog:read']});
  assert.equal(r.action_id,'CUS_PRICE');assert.equal(r.provider_send_allowed,false);
});
test('Permission missing must fail closed',()=>{
  assert.throws(()=>resolvePreviewSelection({input:'1',permissions:[]}),/CONTROL_PERMISSION_DENIED/);
});
test('Staff/owner/Admin roles cannot hijack customer preview',()=>{
  for(const role of ['OWNER','MANAGER','TIEN404_SUPPORT','TIEN404_ADMIN','SYSTEM'])
    assert.throws(()=>resolvePreviewSelection({input:'1',role,permissions:['catalog:read']}),/ROLE_NOT_AUTHORIZED/);
});
test('Draft action never writes Orders and always flags confirmation',()=>{
  const x=resolvePreviewSelection({input:'3',permissions:['order:draft']});
  assert.equal(x.action_id,'CUS_ORDER_DRAFT');assert.equal(x.status,'ACTION_DRAFT_PREVIEW_ONLY');
  assert.equal(x.expected_confirmation,true);assert.equal(x.orders_written,0);
});
test('Support handoff only previews, not automatic ticket creation',()=>{
  const x=resolvePreviewSelection({input:'6',permissions:['support:request']});
  assert.equal(x.action_id,'CUS_SUPPORT');assert.equal(x.outbox_written,0);
  assert.equal(x.expected_confirmation,true);
});
test('OA mock rejects number as native callback ID',()=>{
  assert.throws(()=>resolvePreviewSelection({channel:'ZALO_OA',input:'1',permissions:['catalog:read']}),/CONTROL_NOT_FOUND/);
});
test('Invalid/unknown channels cannot execute actions',()=>{
  assert.throws(()=>customerMenu('ZALO_OA_ACCESS_TOKEN_LEAK'),/CHANNEL_UNSUPPORTED/);
  assert.throws(()=>resolvePreviewSelection({channel:'UNKNOWN',input:'1'}),/CHANNEL_UNSUPPORTED/);
});
test('Hostile content and whitespace are not menu commands',()=>{
  for(const input of ['1; DROP TABLE orders',' 1','1\n2','../../../etc/passwd','01','','__proto__'])
    assert.throws(()=>resolvePreviewSelection({input,permissions:['catalog:read']}),/CONTROL_NOT_FOUND|CONTROL_INVALID/);
});
test('Zalo Bot native keyboard false, OA capability needs separate provider auth',()=>{
  const x=capabilityReport();
  assert.equal(x.zaloBotCreator.buttons_status,'UNVERIFIED_NO_NATIVE_BUTTON_SCHEMA');
  assert.equal(x.zaloOA.buttons_status,'OFFICIAL_OA_SUPPORT_DOCUMENTED_RUNTIME_NOT_CONNECTED');
  assert.equal(x.active_bot_sender_connected,false);
  assert.equal(x.native_button_provider_payload,null);
});
test('No network or secrets in reusable capability module',()=>{
  const s=fs.readFileSync(require.resolve('./button-capability.cjs'),'utf8');
  for(const x of ['fetch(', 'axios', 'ZALO_BOT_TOKEN','chat_id','sendMessage(','setChatKeyboard(','setWebhook(','/v1/send','service_role','credential','localStorage','sessionStorage'])
    assert.ok(!s.includes(x),'Forbidden external side effect '+x);
});
test('Menu types and standard fallback preserve original contracts',()=>{
  const m=customerMenu('ZALO_BOT_CREATOR');
  assert.equal(m.menu_version,'1.1.0');
  assert.equal(m.controls.length,6);
  assert.equal(m.text.includes('Nhắn số tương ứng'),true);
});
test('No callback forged from preview data',()=>{
  const m=customerMenu('ZALO_OA');
  assert.equal(m.provider_payload,null);
  assert.equal(m.production_ready,false);
  assert.equal(m.native_buttons_enabled,false);
});
test('Controlled number chooses exact intended action and cannot mutate shop',()=>{
  for(const a of customerMenu().controls){
    const r=resolvePreviewSelection({input:a.command,permissions:a.required_permissions});
    assert.equal(r.action_id,a.action_id);
    assert.equal(r.tenant_scope,'NO_TENANT_CONTEXT');
    assert.equal(r.external_sends,0);
  }
});

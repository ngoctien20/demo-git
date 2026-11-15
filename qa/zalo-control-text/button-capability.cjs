'use strict';
/**
 * TIEN404 V13.6: Provider-neutral selection controls for QA/STUDIO ONLY.
 * The same registry action IDs can be displayed as a numbered text menu on Bot Creator
 * and clickable PREVIEW buttons for a future Zalo OA surface.
 * No provider-native Bot Creator buttons are claimed and NO message is sent.
 * Does not contain tenant auth, staff auth, Zalo tokens or business writes.
 */
const {createMenuRegistry,createMenuRenderer}=require('../sales-lite/v131/menu-engine.cjs');
const registry=createMenuRegistry();
const renderer=createMenuRenderer(registry);
const fail=(code)=>{const e=new Error(code);e.code=code;throw e;};
const CHANNELS=Object.freeze({
  ZALO_BOT_CREATOR:Object.freeze({
    transport:'TEXT_NUMBERED',nativeButtonsDocumented:false,nativeButtonsEnabled:false,
    evidence:'https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage'
  }),
  ZALO_OA:Object.freeze({
    transport:'NATIVE_BUTTONS_PREVIEW_ONLY',nativeButtonsDocumented:true,nativeButtonsEnabled:false,
    evidence:'https://oa.zaloapp.com/home/function/interaction?type=menu-chatbot'
  })
});
const safeTitle=s=>typeof s==='string'&&s.length>0&&s.length<=90;
function customerMenu(channel='ZALO_BOT_CREATOR'){
  const caps=CHANNELS[channel];
  if(!caps)fail('CHANNEL_UNSUPPORTED');
  const menu=registry.menus.get('CUSTOMER');
  if(!menu)fail('CUSTOMER_REGISTRY_MISSING');
  const actions=menu.actions.filter(x=>x.enabled).map(a=>Object.freeze({
    action_id:a.action_id,
    label:a.label,
    command:a.fallback_command,
    action_type:a.action_type,
    requires_confirmation:a.requires_confirmation,
    required_permissions:Object.freeze([...a.required_permissions])
  }));
  const providerText=renderer.render({role:'CUSTOMER',mode:'TEXT_NUMBERED'});
  if(!safeTitle(menu.title)||providerText.text.length>2000)fail('MENU_PAYLOAD_INVALID');
  return Object.freeze({
    schema_version:'1.0.0',menu_version:registry.version,role:'CUSTOMER',channel,
    transport:caps.transport,native_buttons_supported:caps.nativeButtonsDocumented,
    native_buttons_enabled:false,provider_payload:null,
    text:providerText.text,buttons_preview_only:channel==='ZALO_OA',
    controls:Object.freeze(actions),
    external_sends:0,orders_written:0,outbox_written:0,
    production_ready:false
  });
}
function resolvePreviewSelection({channel='ZALO_BOT_CREATOR',input,role='CUSTOMER',permissions=[]}={}){
  if(role!=='CUSTOMER')fail('ROLE_NOT_AUTHORIZED');
  if(!CHANNELS[channel])fail('CHANNEL_UNSUPPORTED');
  if(typeof input!=='string'||input.length>64||!input.trim())fail('CONTROL_INVALID');
  const menu=customerMenu(channel);
  const selected=menu.controls.find(x=> channel==='ZALO_BOT_CREATOR' ? x.command===input : x.action_id===input);
  if(!selected)fail('CONTROL_NOT_FOUND');
  if(!Array.isArray(permissions)||selected.required_permissions.some(p=>!permissions.includes(p)))
    fail('CONTROL_PERMISSION_DENIED');
  // All outcomes are proposals; never invoke Core, order write, payment or staff tools.
  const needsWrite=selected.action_type!=='READ';
  return Object.freeze({
    status:needsWrite?'ACTION_DRAFT_PREVIEW_ONLY':'ACTION_READ_PREVIEW_ONLY',
    action_id:selected.action_id,
    expected_confirmation:selected.requires_confirmation||needsWrite,
    tenant_scope:'NO_TENANT_CONTEXT',
    provider_send_allowed:false,
    orders_written:0,outbox_written:0,
    external_sends:0,production_ready:false
  });
}
function capabilityReport(){
  return Object.freeze({
    zaloBotCreator:Object.freeze({...CHANNELS.ZALO_BOT_CREATOR,
      buttons_status:'UNVERIFIED_NO_NATIVE_BUTTON_SCHEMA',
      downgrade:'NUMBERED_TEXT_MENU'}),
    zaloOA:Object.freeze({...CHANNELS.ZALO_OA,
      buttons_status:'OFFICIAL_OA_SUPPORT_DOCUMENTED_RUNTIME_NOT_CONNECTED',
      required_gate:'VERIFIED_OA_ACCESS_TOKEN_SCOPE_AND_PROVIDER_API_CONTRACT'}),
    common_menu_version:registry.version,
    active_bot_sender_connected:false,
    native_button_provider_payload:null
  });
}
module.exports={customerMenu,resolvePreviewSelection,capabilityReport};

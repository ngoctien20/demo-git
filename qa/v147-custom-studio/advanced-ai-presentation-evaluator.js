'use strict';
/* Same authorized contract compiler for offline Node tests and browser preview. */
(function(factory){
 const isNode=typeof module!=='undefined'&&!!module.exports;
 const registry=isNode?require('./advanced-channel-registry.js'):window.T404ChannelRegistry;
 const policy=isNode?require('./advanced-presentation-policy.js'):window.T404AdvancedPresentation;
 const studioApi=isNode?require('./studio-core.js'):window.T404Studio;
 if(!registry||!policy||!studioApi)throw Error('ADV4_DEPENDENCY_MISSING');
 const api=factory(registry,policy,studioApi);
 if(isNode)module.exports=api;
 if(typeof window!=='undefined')Object.defineProperty(window,'T404PresentationEvaluator',{value:api,writable:false});
})(function(registry,policy,studioApi){
/*
 * TIEN404 V15.2-ADV.3 — Structured AI Presentation Proposal Evaluation.
 * SOURCE-ONLY; synthetic Store fixtures; NO SEND, NO MODEL API, NO HOSTED WRITES.
 * The model suggests semantic presentation. Trusted policy constructs all business text.
 * All preview actions remain non-executable and require a separate signed server gate.
 */

const INPUT_CONTRACT='T404_PRESENTATION_PROPOSAL_V1';
const OUTPUT_CONTRACT='T404_PRESENTATION_DECISION_V1';
const EMPHASIS=Object.freeze(['NONE','PRICE','WARNING','NOTE']);
const COMPONENT=Object.freeze(['TEXT','RICH_TEXT','PRODUCT_CARD','PRODUCT_CAROUSEL','QUICK_REPLIES','OA_CTA','ZBS_TEMPLATE','WIDGET_CAROUSEL']);
const MEDIA=Object.freeze(['NONE','PRODUCT_IMAGE']);
const ACTION=Object.freeze(['NONE','CATALOG','QUOTE','ORDER_REQUEST','ASK_STAFF','POLICY','TRACK_ORDER','OPEN_VERIFIED_LINK']);
const keys=(obj,expected)=>Object.keys(obj).length===expected.length&&expected.every(k=>Object.hasOwn(obj,k));
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function deny(reason){throw new Error(reason)}
function parseProposal(raw){
  if(typeof raw!=='string'||raw.length<2||raw.length>2048)deny('PROPOSAL_ENCODING_OR_SIZE');
  let value;
  try{value=JSON.parse(raw)}catch{deny('PROPOSAL_INVALID_JSON')}
  if(!isObject(value)||!keys(value,['contract','intent','presentation']))deny('PROPOSAL_SCHEMA_DENIED');
  if(value.contract!==INPUT_CONTRACT||!policy.INTENTS.includes(value.intent))deny('PROPOSAL_INTENT_OR_VERSION_DENIED');
  const p=value.presentation;
  if(!isObject(p)||!keys(p,['emphasis','component','media','action']))deny('PRESENTATION_SCHEMA_DENIED');
  if(!EMPHASIS.includes(p.emphasis)||!COMPONENT.includes(p.component)||
     !MEDIA.includes(p.media)||!ACTION.includes(p.action))deny('PRESENTATION_ENUM_DENIED');
  return Object.freeze({contract:INPUT_CONTRACT,intent:value.intent,
    presentation:Object.freeze({emphasis:p.emphasis,component:p.component,media:p.media,action:p.action})});
}
const clone=x=>JSON.parse(JSON.stringify(x));
function compactToText(render){
  return {...render,type:'TEXT',buttons:[],cards:[],image:null,segments:[],text_styles:[],
    layout:null,parse_mode:null,link:null};
}
function decide({raw,shop,channel,studio=studioApi.createStudio(),api=studioApi}={}){
  const proposal=parseProposal(raw);
  // Canonical price, stock, policy, and order privacy are derived from trusted fixtures,
  // NEVER from model text, rich HTML, URLs, product IDs, or action parameters.
  const base=policy.compile({studio,api,shop,channel,proposal:{intent:proposal.intent}});
  const request=proposal.presentation, reasons=[];
  let component='TEXT', render=compactToText(clone(base.render));
  const lookup=registry.resolve({tenant_id:base.tenantId,store_id:base.storeId,
    channel,componentId:request.component});
  if(lookup.status!=='PREVIEW_ONLY'&&request.component!=='TEXT'){
    reasons.push('COMPONENT_NOT_AVAILABLE_OR_APPROVED');
  }else if(request.component==='TEXT'){
    component='TEXT';
  }else if(request.component==='PRODUCT_CARD'){
    if(proposal.intent==='DISCOVER'&&['MESSENGER','WEB_WIDGET'].includes(channel)){
      component='PRODUCT_CARD';render=clone(base.render);
    }else reasons.push('PRODUCT_CARD_CONTEXT_OR_CHANNEL_DENIED');
  }else if(request.component==='RICH_TEXT'){
    if(['ZALO_BOT','WEB_WIDGET'].includes(channel)&&base.plan.emphasis.length){
      component='RICH_TEXT';render=clone(base.render);
    }else reasons.push('RICH_TEXT_CONTEXT_OR_CHANNEL_DENIED');
  }else if(request.component==='QUICK_REPLIES'){
    if(channel==='MESSENGER'&&base.render.type==='QUICK_REPLIES_PREVIEW'){
      component='QUICK_REPLIES';render=clone(base.render);
    }else reasons.push('QUICK_REPLY_CONTEXT_OR_CHANNEL_DENIED');
  }else if(request.component==='PRODUCT_CAROUSEL'||request.component==='WIDGET_CAROUSEL'){
    reasons.push('CAROUSEL_REQUIRES_MULTIPLE_VERIFIED_PRODUCTS');
  }else{
    reasons.push('PRIVILEGED_OR_ACCOUNT_COMPONENT_NOT_READY');
  }
  // A semantic emphasis hint is only permitted when the policy actually generated that
  // role from trusted data. It may not invent warnings, discounts or price changes.
  let emphasis=request.emphasis!=='NONE'&&base.plan.emphasis.includes(request.emphasis)?
    request.emphasis:'NONE';
  if(component==='TEXT'&&emphasis!=='NONE'){
    emphasis='NONE';reasons.push('CHANNEL_OR_COMPONENT_CANNOT_APPLY_EMPHASIS');
  }
  if(request.emphasis!=='NONE'&&emphasis==='NONE')reasons.push('UNTRUSTED_EMPHASIS_NOT_GROUNDED');
  // Suppress all style spans if model explicitly chose no emphasis or if there
  // is no channel-supported safe rich text preview for the selected component.
  if(component==='TEXT'){
    render.segments=[];render.text_styles=[];
  }else if(emphasis==='NONE'){
    render.segments=[];render.text_styles=[];
  }else{
    render.segments=(render.segments||[]).filter(s=>s.kind===emphasis);
    if(channel==='ZALO_BOT'){
      const allowed=base.plan.emphasis;
      render.text_styles=(render.text_styles||[]).filter((s,i)=>allowed[i]===emphasis);
    }
  }
  // Never turn proposed actions into executable business calls. Reuse ONLY
  // actions produced by the trusted compiler; deny private order lookups.
  const available=[...(base.render.buttons||[]),
    ...(base.render.cards||[]).flatMap(c=>c.buttons||[])];
  const safeAction=available.find(a=>a.id===request.action&&a.interactive===false&&a.requiresSignedServerAction===true);
  const action=request.action!=='NONE'&&safeAction?safeAction.id:'NONE';
  if(request.action!=='NONE'&&action==='NONE')
    reasons.push(request.action==='TRACK_ORDER'?'VERIFIED_CUSTOMER_IDENTITY_REQUIRED':
      'ACTION_NOT_AUTHORIZED_BY_POLICY');
  // Restrict the preview controls to the one model-requested and policy-approved
  // suggestion. Unrequested disabled controls must not appear as extra buttons.
  render.buttons=(render.buttons||[]).filter(b=>b.id===action&&action!=='NONE');
  render.cards=(render.cards||[]).map(c=>({...c,
    buttons:(c.buttons||[]).filter(b=>b.id===action&&action!=='NONE')}));
  // Text-only Zalo fallback should not expose additional menu actions merely
  // because the underlying trusted compiler listed several candidates.
  if(action==='NONE'&&['ZALO_BOT','ZALO_OA'].includes(channel)){
    const menuStart=render.text.indexOf('\n1. ');
    if(menuStart>=0)render.text=render.text.slice(0,menuStart);
  }
  // No store-approved media registry or verified external URL is available.
  if(request.media!=='NONE')reasons.push('APPROVED_STORE_MEDIA_UNAVAILABLE');
  const modelSuggestionUsed=component!=='TEXT'||emphasis!=='NONE'||action!=='NONE';
  return Object.freeze({
    contract:OUTPUT_CONTRACT,lifecycle:'EXPERIMENTAL',mode:'SYNTHETIC_NO_SEND',
    tenantId:base.tenantId,storeId:base.storeId,channel,shop,source:base.source,
    modelProposal:proposal,
    decision:{selectedComponent:component,selectedEmphasis:emphasis,actionSuggestion:action,
      actionExecutable:false,mediaUrl:null,externalLink:null,modelSuggestionUsed,
      fallbackReasons:[...new Set(reasons)],registryStatus:lookup.status},
    preview:render,orderLookupAuthorized:false,orderCreated:false,
    realModelCalls:0,providerSends:0,hostedWrites:0,paidSpendVnd:0,
    releaseAuthorized:false
  });
}
return Object.freeze({INPUT_CONTRACT,OUTPUT_CONTRACT,EMPHASIS,COMPONENT,MEDIA,ACTION,parseProposal,decide});

});

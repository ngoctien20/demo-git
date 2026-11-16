'use strict';
/*
 * TIEN404 V15.2-ADV.5 — Safe Channel Adapter PREVIEW ONLY.
 * This is NOT a sender and contains no provider credentials/recipient/API endpoint.
 * The input is a strict ADV.3 JSON proposal, never a precompiled client decision.
 * All business text is compiled from a trusted store-scoped synthetic QA fixture.
 */
(function(factory){
  const isNode=typeof module!=='undefined'&&!!module.exports;
  const evaluator=isNode?require('./advanced-ai-presentation-evaluator.js'):window.T404PresentationEvaluator;
  const registry=isNode?require('./advanced-channel-registry.js'):window.T404ChannelRegistry;
  const studioApi=isNode?require('./studio-core.js'):window.T404Studio;
  if(!evaluator||!registry||!studioApi)throw Error('ADV5_ADAPTER_DEPENDENCY_MISSING');
  const result=factory(evaluator,registry,studioApi);
  if(isNode)module.exports=result;
  if(typeof window!=='undefined')
    Object.defineProperty(window,'T404SafeChannelAdapter',{value:result,writable:false});
})(function(evaluator,registry,studioApi){
  const CONTRACT='T404_SAFE_CHANNEL_PREVIEW_V1';
  const ALLOWED_STYLE=Object.freeze(['b','i','u','s','c_db342e','c_15a85f','c_050a19','f_18']);
  function deny(reason){throw new Error(reason)}
  const copy=x=>JSON.parse(JSON.stringify(x));
  const pureText=x=>{
    if(typeof x!=='string'||x.length>3500||/[\x00-\x08\x0b-\x1f\x7f]/.test(x))deny('INVALID_PREVIEW_TEXT');
    return x;
  };
  const textButton=a=>{
    if(!a||typeof a.label!=='string'||a.interactive!==false||a.requiresSignedServerAction!==true)
      deny('UNTRUSTED_ACTION_BUTTON');
    return {label:pureText(a.label).slice(0,70),actionKey:a.id,
      disabled:true,interactive:false,payload:null,token:null,requiresSignedServerAction:true};
  };
  const normalizeSpans=(spans,source)=>{
    if(!Array.isArray(spans)||spans.length>12)deny('INVALID_SPAN_COUNT');
    let end=0;
    return spans.map(s=>{
      if(!s||!Number.isInteger(s.start)||!Number.isInteger(s.len)||s.start<end||
         s.len<1||s.start+s.len>source.length||!['PRICE','NOTE','WARNING'].includes(s.kind))
        deny('INVALID_STYLE_SPAN');
      end=s.start+s.len;
      return {start:s.start,length:s.len,role:s.kind};
    });
  };
  function build({raw,shop,channel,studio=studioApi.createStudio(),api=studioApi}={}){
    if(typeof raw!=='string'||!registry.CHANNELS.includes(channel))deny('INVALID_CHANNEL_OR_PROPOSAL');
    const decision=evaluator.decide({raw,shop,channel,studio,api});
    if(decision.providerSends!==0||decision.hostedWrites!==0||decision.realModelCalls!==0||
       decision.releaseAuthorized!==false||decision.decision.actionExecutable!==false)
       deny('UNEXPECTED_LIVE_DECISION');
    const prev=decision.preview, text=pureText(prev.text);
    const buttons=[...prev.buttons,...prev.cards.flatMap(c=>c.buttons||[])].map(textButton);
    if(buttons.length>2)deny('TOO_MANY_UNAPPROVED_ACTION_HINTS');
    const hints=buttons.map(x=>({...x}));
    const channelCap=registry.resolve({channel,
      tenant_id:decision.tenantId,store_id:decision.storeId,
      componentId:decision.decision.selectedComponent});
    if(channelCap.status!=='PREVIEW_ONLY')deny('CHANNEL_CAPABILITY_NOT_RESOLVED');
    let message;
    if(channel==='MESSENGER'){
      const card=decision.decision.selectedComponent==='PRODUCT_CARD'&&prev.cards.length===1
        ?prev.cards[0]:null;
      message=card?{
        previewKind:'MESSENGER_GENERIC_TEMPLATE_PREVIEW',
        text,presentation:{template_type:'generic',elements:[{
          title:pureText(card.title).slice(0,80),
          subtitle:pureText(card.priceLabel||card.subtitle||'').slice(0,80),
          sku:pureText(card.sku).slice(0,80),image_url:null,
          buttons:[] // No unsigned provider postback payloads.
        }]},
        quickReplyHints:[],signedPostbackPayload:null
      }:{
        previewKind:decision.decision.selectedComponent==='QUICK_REPLIES'
          ?'MESSENGER_QUICK_REPLY_HINTS':'MESSENGER_TEXT_PREVIEW',
        text,presentation:null,quickReplyHints:hints,signedPostbackPayload:null
      };
    }else if(channel==='ZALO_BOT'){
      const styles=Array.isArray(prev.text_styles)?prev.text_styles:[];
      const validated=styles.map(s=>{
        if(!Number.isInteger(s.start)||!Number.isInteger(s.len)||s.len<1||
          s.start<0||s.start+s.len>text.length||!Array.isArray(s.st)||!s.st.length||
          s.st.some(x=>!ALLOWED_STYLE.includes(x)))deny('UNTRUSTED_ZALO_STYLE');
        return {start:s.start,len:s.len,st:s.st.slice()};
      });
      message={previewKind:validated.length?'ZALO_BOT_RICH_TEXT_PREVIEW':'ZALO_BOT_TEXT_PREVIEW',
        text,text_styles:validated,photo:null,nativeButtons:null,
        menuHint:'Các thao tác cần xác minh server; chưa kích hoạt nút Zalo Bot.'};
    }else if(channel==='ZALO_OA'){
      message={previewKind:'ZALO_OA_TEXT_FALLBACK_PREVIEW',text,
        oaCTA:null,oaMenu:null,zbsTemplate:null,entitlementsVerified:false,
        billable:false,spendApproved:false};
    }else{
      const spans=normalizeSpans(prev.segments||[],text);
      message={previewKind:'WEB_WIDGET_SAFE_VIEW',text,semanticSpans:spans,
        cards:prev.cards.map(c=>({
          title:pureText(c.title),sku:pureText(c.sku||''),priceLabel:pureText(c.priceLabel||''),
          imageUrl:null,buttons:(c.buttons||[]).map(textButton)
        })),controls:hints,externalUrl:null,
        requiresTextContent:true,htmlAllowed:false};
    }
    return copy({
      contract:CONTRACT,mode:'SYNTHETIC_NO_SEND',lifecycle:'EXPERIMENTAL',
      source:'V15_2_ADV3_EVALUATED_QA_ONLY',
      tenantId:decision.tenantId,storeId:decision.storeId,channel,
      selectedComponent:decision.decision.selectedComponent,
      adapterKind:message.previewKind,
      fallbackReasons:decision.decision.fallbackReasons.slice(),
      message,
      actionProposal:decision.decision.actionSuggestion!=='NONE'
        ?{actionKey:decision.decision.actionSuggestion,requiresSignedServerAction:true,
          previewOnly:true,interactive:false,signedToken:null}:null,
      delivery:{authorized:false,canSend:false,recipient:null,endpoint:null,
        providerPayload:null,credential:null,request:null},
      security:{ownerJwtVerified:false,channelEntitlementVerified:false,
        providerSendAllowed:false,serverActionRequired:true,nonceClaimed:false,
        actionExecutable:false,storeScopeEnforcedByTrustedFixtureOnly:true},
      estimatedCost:null,realModelCalls:0,providerSends:0,hostedWrites:0
    });
  }
  function send(){deny('PROVIDER_SEND_DISABLED')}
  function executeAction(){deny('SIGNED_BACKEND_ACTION_REQUIRED')}
  return Object.freeze({CONTRACT,build,send,executeAction});
});
'use strict';
/* TIEN404 V15.2 ADVANCED EXPERIENCE -- SOURCE-ONLY synthetic policy.
 * AI outputs are untrusted proposals, never provider instructions.
 * No fetch, provider send, database, credentials, payment or state mutation.
 * Reuses V14.7 three-shop / four-channel scoped QA configurations.
 */
(function (factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') Object.defineProperty(window, 'T404AdvancedPresentation', {value:api, writable:false});
})(function () {
  const INTENTS = Object.freeze(['GREETING','DISCOVER','QUOTE','LOW_STOCK','POLICY','ORDER_REQUEST','ORDER_LOOKUP','SUPPORT']);
  const CHANNELS = Object.freeze(['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']);
  const ACTIONS = Object.freeze(['CATALOG','QUOTE','ORDER_REQUEST','ASK_STAFF','POLICY']);
  const CAP = Object.freeze({
    MESSENGER: {card:'DOCUMENTED_ACCOUNT_GATE', quick:'DOCUMENTED_ACCOUNT_GATE', color:'UNSUPPORTED_NATIVE', photo:'DOCUMENTED_ACCOUNT_GATE', buttons:'DOCUMENTED_ACCOUNT_GATE'},
    ZALO_BOT: {card:'UNVERIFIED_NATIVE', quick:'UNVERIFIED_NATIVE', color:'DOCUMENTED', photo:'DOCUMENTED_ACCOUNT_GATE', buttons:'UNVERIFIED_NATIVE'},
    ZALO_OA: {card:'ACCOUNT_PERMISSION_REQUIRED',quick:'ACCOUNT_PERMISSION_REQUIRED',color:'UNVERIFIED_NATIVE',photo:'ACCOUNT_PERMISSION_REQUIRED',buttons:'ACCOUNT_PERMISSION_REQUIRED'},
    WEB_WIDGET: {card:'SOURCE_PREVIEW_ONLY',quick:'SOURCE_PREVIEW_ONLY',color:'SOURCE_PREVIEW_ONLY',photo:'SOURCE_PREVIEW_ONLY',buttons:'SOURCE_PREVIEW_ONLY'}
  });
  const ALLOWED_STYLES = Object.freeze(['b','i','u','s','c_db342e','c_15a85f','c_050a19','f_18']);
  const deny = m => { throw Error(m); };
  const clean = (x,max=2000) => {
    if (typeof x !== 'string' || !x.trim() || x.length>max || /[<>\x00-\x1f\x7f]/.test(x)) deny('UNSAFE_TEXT');
    return x.trim();
  };
  const stable = x => JSON.parse(JSON.stringify(x));
  const vnd = n => {if (!Number.isSafeInteger(n)||n<0)deny('INVALID_VND');return new Intl.NumberFormat('vi-VN').format(n)+'đ';};
  const make = (label,id) => ({id,label,interactive:false,requiresSignedServerAction:true});
  const span = (message,search,kind) => {
    const start=message.indexOf(search);
    if(start<0)deny('STYLE_SPAN_MISSING');
    return {start,len:search.length,kind};
  };
  function compile({studio,api,shop,channel,proposal}={}) {
    if(!studio||typeof studio.get!=='function'||!api||!api.FIXTURES)deny('TRUSTED_QA_STUDIO_REQUIRED');
    if(!Object.hasOwn(api.FIXTURES,shop)||!CHANNELS.includes(channel))deny('UNKNOWN_SHOP_CHANNEL');
    if(!proposal||typeof proposal!=='object'||Array.isArray(proposal)||!INTENTS.includes(proposal.intent))deny('INTENT_NOT_ALLOWED');
    const extra=Object.keys(proposal).filter(k=>!['intent'].includes(k));
    if(extra.length)deny('UNTRUSTED_MODEL_FIELDS'); // model cannot inject prices, styles, actions, URLs or IDs
    const f=api.FIXTURES[shop], cfg=studio.get(shop,channel);
    if(cfg.tenant_id!==f.tenantId||cfg.store_id!==f.storeId||cfg.channel!==channel||
       cfg.approval_status!=='EXPERIMENTAL'||cfg.policy_version!=='GLOBAL_CORE_LOCKED')deny('STORE_POLICY_MISMATCH');
    const p=f.product;
    clean(p.sku,80); clean(p.name,100); clean(cfg.greeting,250);
    if(!Number.isSafeInteger(p.stock)||p.stock<0)deny('STOCK_INVALID');
    const low=p.stock<=3, price=vnd(p.priceVnd);
    let message='', spans=[], kind='TEXT', product=null, photo=null;
    let actions=[];
    switch(proposal.intent) {
      case 'GREETING': message=cfg.greeting;actions=[make('Xem sản phẩm','CATALOG'),make('Gặp nhân viên','ASK_STAFF')];break;
      case 'DISCOVER':
        message='Gợi ý tại '+f.name+': '+p.name+' ('+p.sku+').';
        product={sku:p.sku,name:p.name,priceVnd:p.priceVnd,priceLabel:price,stock:p.stock,imageUrl:null,emoji:p.emoji,source:'SIGNED_QA_FIXTURE_ONLY'};
        actions=[make('Xem giá','QUOTE'),make('Gặp nhân viên','ASK_STAFF')];break;
      case 'QUOTE':
        message=p.name+' ('+p.sku+'): '+price+'. '+(cfg.showStock?'Tồn kho QA: '+p.stock+'. ':'')+'Chưa tạo đơn.';
        spans.push(span(message,price,'PRICE'));actions=[make('Yêu cầu đặt hàng','ORDER_REQUEST')];break;
      case 'LOW_STOCK':
        message=p.name+' ('+p.sku+'): '+price+'. '+(low?'Sắp hết hàng':'Tồn kho còn đủ')+' ('+p.stock+' '+p.unit+').';
        spans.push(span(message,price,'PRICE'));
        if(low)spans.push(span(message,'Sắp hết hàng','WARNING'));
        break;
      case 'POLICY':
        message='Chính sách của '+f.name+' cần được lấy từ Knowledge đã duyệt. Chưa có nguồn xác minh trong QA này.';
        spans.push(span(message,'Chưa có nguồn xác minh','NOTE'));actions=[make('Gặp nhân viên','ASK_STAFF')];break;
      case 'ORDER_REQUEST':
        message='Yêu cầu thử '+p.name+': '+price+'. Cần khách xác nhận; chưa ghi đơn hoặc giữ kho.';
        spans.push(span(message,price,'PRICE'));actions=[make('Gặp nhân viên','ASK_STAFF')];break;
      case 'ORDER_LOOKUP':
        message='Cần xác minh quyền khách hàng hoặc Owner trước khi tra cứu mã đơn. Không tiết lộ dữ liệu từ mã đơn đơn lẻ.';
        spans.push(span(message,'Cần xác minh','WARNING'));break;
      case 'SUPPORT':
        message='Bạn có thể yêu cầu gặp nhân viên. Đây là bản xem trước, chưa chuyển hội thoại.';
        spans.push(span(message,'Đây là bản xem trước','NOTE'));actions=[make('Gặp nhân viên','ASK_STAFF')];break;
    }
    clean(message,2000);
    const desired={intent:proposal.intent,emphasis:spans.map(s=>s.kind),
      wantsProductCard:proposal.intent==='DISCOVER',
      wantsImage:proposal.intent==='DISCOVER',wantsButtons:actions.length>0,
      wantsLink:false,wantsOrderWrite:false};
    const channelCap=CAP[channel];
    const warnings=['EXPERIMENTAL / NO-SEND. Account grants, merchant consent and live provider rendering NOT verified.'];
    const render={type:'TEXT',text:message,segments:spans,buttons:[],cards:[],image:null,
      parse_mode:null,text_styles:[],link:null,layout:null};
    if(channel==='MESSENGER'){
      if(proposal.intent==='DISCOVER'){
        render.type='GENERIC_TEMPLATE_PREVIEW';
        render.cards=[{title:p.name,subtitle:price,sku:p.sku,imageUrl:null,
          buttons:actions,emoji:p.emoji}];
        warnings.push('Meta Generic Template documented; Page entitlement/send not certified. No arbitrary color/HTML.');
      }else if(actions.length){
        render.type='QUICK_REPLIES_PREVIEW';render.buttons=actions;
      }
      render.segments=[]; // native Messenger color/italic not guaranteed
    }else if(channel==='ZALO_BOT'){
      render.text_styles=spans.map(s=>({
        start:s.start,len:s.len,st:s.kind==='PRICE'?['b','c_15a85f']:
          s.kind==='WARNING'?['b','c_db342e']:['i']
      }));
      for(const r of render.text_styles)if(r.st.some(x=>!ALLOWED_STYLES.includes(x)))deny('UNSUPPORTED_STYLE');
      render.type='TEXT_STYLES_PREVIEW';
      if(proposal.intent==='DISCOVER'){
        render.image={emoji:p.emoji,photoUrl:null,caption:message,verifiedImageAsset:false};
        warnings.push('Photo not sent: approved asset URL absent. Native Zalo Bot buttons/carousel NOT verified.');
      }
      if(actions.length){
        render.text += '\n'+actions.map((a,i)=>(i+1)+'. '+a.label).join('\n');
        warnings.push('Zalo Bot choices are numbered TEXT, not native buttons.');
      }
    }else if(channel==='ZALO_OA'){
      render.type='OA_TEXT_FALLBACK_PREVIEW';render.buttons=[];
      if(actions.length)render.text += '\n'+actions.map((a,i)=>(i+1)+'. '+a.label).join('\n');
      warnings.push('OA CTA/menu/templates require verified account permissions and message eligibility. ZBS spend gate LOCKED.');
      render.segments=[];
    }else {
      render.type=proposal.intent==='DISCOVER'?'WEB_PRODUCT_CARD_PREVIEW':'WEB_RICH_TEXT_PREVIEW';
      render.layout={accent:cfg.color,productEmoji:proposal.intent==='DISCOVER'?p.emoji:null,
        htmlAllowed:false,usesTextContent:true};
      render.buttons=actions;
      if(proposal.intent==='DISCOVER')render.cards=[{sku:p.sku,title:p.name,priceLabel:price,
        imageUrl:null,emoji:p.emoji,buttons:actions}];
    }
    const result={contract:'T404_ADV_PRESENTATION_1.0',lifecycle:'EXPERIMENTAL',source:'SYNTHETIC_V147_FIXTURE',
      tenantId:f.tenantId,storeId:f.storeId,shop,channel,botVersion:cfg.bot_profile_version,
      knowledgeVersion:cfg.knowledge_version,capability:channelCap,plan:desired,render,warnings,
      orderCreated:false,orderLookupAuthorized:false,channelVerified:false,providerSends:0,
      customerDataReads:0,orderWrites:0,realAiCalls:0,canPublish:false};
    return stable(result);
  }
  function approveAction() {deny('SERVER_SIGNED_ACTION_AND_AUTH_REQUIRED');}
  function send() {deny('PROVIDER_SEND_FORBIDDEN');}
  return Object.freeze({INTENTS,CHANNELS,ACTIONS,CAP,ALLOWED_STYLES,compile,approveAction,send});
});

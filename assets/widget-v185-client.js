/* TIEN404 V18.5 — Website adapter candidate, dormant unless explicitly
 * enabled in a separate staging config. NO direct n8n webhook or credential.
 * A hosted, independently audited gateway is REQUIRED before real network QA.
 * Browser Widget ID, Origin, sessionStorage or this JS never grants Store auth.
 */
export function mountV185Widget(target, config) {
  'use strict';
  const fallback = document.getElementById('n8n-chat-fallback');
  const panel = document.getElementById('tien404-chat-panel');
  const launcher = document.getElementById('tien404-chat-launcher');
  const close = document.getElementById('tien404-chat-close');
  const form = document.getElementById('tien404-composer');
  const input = document.getElementById('tien404-message');
  const send = document.getElementById('tien404-send');
  const status = document.getElementById('tien404-composer-status');
  if (!target || !form || !input || !send || !panel || !launcher ||
      config?.enabled !== true || config?.staging !== true) {
    throw new Error('V185_WIDGET_NOT_ADMITTED');
  }

  const deny = reason => { throw new Error(reason); };
  function exactGateway(raw) {
    if (typeof raw !== 'string') deny('V185_GATEWAY_NOT_CONFIGURED');
    let parsed;
    try { parsed = new URL(raw); } catch { deny('V185_GATEWAY_NOT_CONFIGURED'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        parsed.pathname !== '/' || parsed.search || parsed.hash ||
        (parsed.port && parsed.port !== '443')) deny('V185_GATEWAY_NOT_CONFIGURED');
    return parsed.origin;
  }
  if (typeof config.widgetId !== 'string' ||
      !/^[A-Za-z0-9_-]{2,90}$/.test(config.widgetId))
    deny('V185_WIDGET_ID_NOT_CONFIGURED');
  const gateway = exactGateway(config.gatewayBase);
  const allowedModes = new Set(['PLATFORM_CONSULTANT','MERCHANT_SANDBOX']);
  // Client only helps display images; ONLY THE BACKEND authorizes URLs/scope.
  const imageOrigins = new Set(Array.isArray(config.allowedImageOrigins)
    ? config.allowedImageOrigins.filter(x => {
        try { return new URL(x).origin === x && x.startsWith('https://'); }
        catch { return false; }
      }) : []);
  const stylesheet = new URL('./widget-v185.css', import.meta.url);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = stylesheet.href;
  document.head.append(link);

  target.replaceChildren();
  const wrap = document.createElement('div');
  wrap.className = 'tien404-v185-widget';
  const banner = document.createElement('div');
  banner.className = 'tien404-v185-banner';
  banner.textContent = 'V18.5 · Staging / Chỉ xem trước · Không tạo đơn thật';
  const log = document.createElement('div');
  log.className = 'tien404-v185-feed';
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live','polite');
  log.setAttribute('aria-label','Hội thoại tư vấn TIEN404 AI - Staging');
  wrap.append(banner, log);
  target.append(wrap);
  form.hidden = false;
  input.maxLength = 800;
  input.placeholder = 'Hỏi về TIEN404 AI hoặc sản phẩm QA đã duyệt...';
  const state = { session: null, mode: null, busy: false, lastEvent: null };

  function line(text, role = 'assistant') {
    const item = document.createElement('div');
    item.className = 'tien404-v185-message ' + (role==='user'?'is-user':'is-assistant');
    item.textContent = String(text).slice(0, 1400);
    log.append(item);
    log.scrollTop = log.scrollHeight;
    return item;
  }
  function safeImage(src) {
    if (typeof src!=='string' || src.length>1500 || imageOrigins.size===0) return null;
    try {
      const u=new URL(src);
      if (u.protocol!=='https:' || u.username || u.password || u.hash ||
          !imageOrigins.has(u.origin) ||
          ['token','access_token','psid','tenant_id','store_id'].some(k=>u.searchParams.has(k)))
        return null;
      return u.href;
    } catch { return null; }
  }
  function present(result) {
    if (!result || result.status!=='PREVIEW_ONLY' ||
        !allowedModes.has(result.mode) ||
        result.providerSends!==0 || result.orderWrites!==0 ||
        result.privateOrderAccess!==false || result.canRelease!==false)
      deny('V185_RENDER_CONTRACT_DENIED');
    const view=result.publicPreview;
    if (!view || typeof view.text !== 'string' || view.text.length>1400)
      deny('V185_RENDER_CONTRACT_DENIED');
    line(view.text);
    const products = Array.isArray(view.products) ? view.products.slice(0, 5) : [];
    for (const p of products) {
      if (!p || typeof p.name!=='string' || p.name.length>100 ||
          !Number.isSafeInteger(p.priceVnd) || p.priceVnd<0 ||
          !Number.isSafeInteger(p.stock) || p.stock<0) continue;
      const card=document.createElement('div');
      card.className='tien404-v185-product';
      const url=safeImage(p.imageUrl);
      if(url){const img=document.createElement('img');img.src=url;img.alt=p.name;
        img.loading='lazy';img.referrerPolicy='no-referrer';card.append(img);}
      const content=document.createElement('div');
      const title=document.createElement('strong');title.textContent=p.name;
      const price=document.createElement('span');
      price.textContent=new Intl.NumberFormat('vi-VN').format(p.priceVnd) + 'đ';
      const stock=document.createElement('small');
      stock.textContent=p.stock>0?'Còn hàng theo dữ liệu QA':'Hết hàng theo dữ liệu QA';
      content.append(title,price,stock);card.append(content);log.append(card);
    }
    if (Array.isArray(view.actions)) {
      const actionBar=document.createElement('div');
      actionBar.className='tien404-v185-actions';
      const allowed = new Set(['PRODUCT_VIEW','PRODUCT_PRICE_CHECK',
        'PRODUCT_VARIANT_SELECT','BROWSE_CATALOG','ASK_STAFF','RETURN_TO_AI']);
      for(const action of view.actions.slice(0,4)) {
        if(!action || !allowed.has(action.id) ||
           typeof action.label!=='string' || action.label.length>40)continue;
        const button=document.createElement('button');
        button.type='button';
        button.textContent=action.label;
        // Explicit click fills composer only; never grants a write/permission.
        button.addEventListener('click',()=>{
          input.value=action.label;input.focus({preventScroll:true});
        });
        actionBar.append(button);
      }
      if(actionBar.childNodes.length)log.append(actionBar);
    }
    log.scrollTop=log.scrollHeight;
  }

  async function post(route, payload) {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),9000);
    try {
      const res=await fetch(gateway+route,{
        method:'POST',mode:'cors',credentials:'omit',redirect:'error',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify(payload),signal:controller.signal,
        cache:'no-store',referrerPolicy:'no-referrer'
      });
      if(!res.ok)deny('V185_GATEWAY_REQUEST_DENIED');
      const length=Number(res.headers.get('content-length')||'0');
      if(length>32768)deny('V185_RESPONSE_TOO_LARGE');
      const body=await res.text();
      if(body.length>32768)deny('V185_RESPONSE_TOO_LARGE');
      return JSON.parse(body);
    } finally { clearTimeout(timeout); }
  }

  async function begin() {
    if(state.session)return;
    const res=await post('/widget/v18.5/session',{
      widgetId:config.widgetId, origin:location.origin
    });
    if(!res || typeof res.session!=='string' || res.session.length>2048 ||
       res.anonymous!==true || res.previewOnly!==true ||
       res.privateOrderAccess!==false || res.providerSends!==0 ||
       res.orderWrites!==0 || !allowedModes.has(res.mode))
      deny('V185_SESSION_REJECTED');
    state.session=res.session;
    state.mode=res.mode;
  }
  async function submit(event) {
    event.preventDefault();
    if(state.busy)return;
    const message=input.value.trim();
    if(!message || message.length>800 || /[\u0000-\u001f\u007f]/.test(message)) {
      status.textContent='Tin nhắn phải dài 1–800 ký tự và không chứa ký tự điều khiển.';
      return;
    }
    state.busy=true;send.disabled=true;status.textContent='';
    try {
      await begin();
      const eventId='evt_'+crypto.randomUUID().replaceAll('-','');
      state.lastEvent=eventId;
      const result=await post('/widget/v18.5/message',{
        widgetId:config.widgetId, origin:location.origin,
        session:state.session, eventId, message
      });
      if(result.mode!==state.mode)deny('V185_MODE_CHANGED');
      line(message,'user');
      present(result);
      input.value='';
      input.focus({preventScroll:true});
    } catch {
      // Never replay uncertain POST delivery after a timeout/connection loss.
      status.textContent='Chưa xác minh được kết quả. Tin nhắn vẫn ở ô soạn; không tự gửi lại.';
    } finally {
      state.busy=false;send.disabled=false;
    }
  }
  function toggle(open) {
    panel.hidden=!open;
    launcher.setAttribute('aria-expanded',String(open));
    if(open) input.focus({preventScroll:true});
    else launcher.focus({preventScroll:true});
  }
  form.addEventListener('submit',submit);
  input.addEventListener('input',()=>{status.textContent='';});
  launcher.addEventListener('click',()=>toggle(panel.hidden));
  close?.addEventListener('click',()=>toggle(false));
  for(const b of document.querySelectorAll('[data-tien404-open-chat]')) {
    b.addEventListener('click',()=>toggle(true));
  }
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && !panel.hidden)toggle(false);
  });
  line('Đây là môi trường QA V18.5. Chỉ sử dụng dữ liệu Sandbox đã phê duyệt.');
  document.documentElement.classList.add('tien404-chat-ready');
  if(fallback)fallback.hidden=true;
  return Object.freeze({ mounted:true,stagingOnly:true,
    noDirectN8n:true,noPersistentSession:true,orderWrites:false });
}

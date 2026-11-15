/* TIEN404 V13.5 Shop B Rich Text QA — staging-only narrow route.
 * No direct customer writes; global sending stays off. No arbitrary text or recipient.
 * Install as an EXTRA function in existing gateway; never replace legacy send guards.
 */
const TIEN404_QA_RICH = Object.freeze({
  testId: 'TIEN404_SHOP_B_RICH_V135_20261115',
  expiresAt: '2026-11-15T10:00:00.000Z',
  claimPrefix: 'TIEN404_SHOP_B_RICH_V135_20261115_'
});
function qaJson(status, obj) {
  return new Response(JSON.stringify(obj),{
    status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}
  });
}
async function qaSafeEqual(a,b){
  if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;
  const h=async x=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)));
  const [x,y]=await Promise.all([h(a),h(b)]);
  let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
  return diff===0;
}
function qaFixture(id){
  switch(id){
    case 'T1':
      return {text:'TIEN404 SHOP B · MENU QA (T1)\n1. Xem sản phẩm\n2. Hỏi giá\n3. Yêu cầu mua hàng\nTin kiểm thử, không tạo đơn.'};
    case 'T2': {
      const text='TIEN404 · RICH TEXT QA (T2)\nChữ nghiêng và emoji 🛒\nChỉ kiểm tra giao diện tin nhắn.';
      const p=text.indexOf('Chữ nghiêng');
      return {text,text_styles:[{start:0,len:7,st:['b','f_18','c_15a85f']},{start:p,len:'Chữ nghiêng và emoji 🛒'.length,st:['i']}]};
    }
    case 'T3':
      return {text:'**TIEN404** · Markdown QA (T3)\n*Chữ nghiêng*\n- Menu mục 1\n- Menu mục 2\n{green}Chữ xanh{/green}\nKhông tạo đơn.',parse_mode:'markdown'};
    default:return null;
  }
}
async function qaRichTextRoute(request,env,path,now=Date.now(),fetchImpl=fetch){
  if(!['/v1/qa-richtext/preflight','/v1/qa-richtext/send'].includes(path))return null;
  if(request.method!=='POST')return qaJson(405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  // Deliberate exception is ONLY possible while the original global send remains OFF.
  if(env.ZALO_SEND_ENABLED!=='false')return qaJson(423,{ok:false,error:'GLOBAL_SEND_GATE_UNEXPECTED'});
  if(now>=Date.parse(TIEN404_QA_RICH.expiresAt) || now>=Date.parse(String(env.ZALO_OWNER_APPROVAL_EXPIRES||'')))
    return qaJson(403,{ok:false,error:'QA_APPROVAL_EXPIRED'});
  const authorization=request.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer ')||!await qaSafeEqual(authorization.slice(7),env.GATEWAY_AUTH_KEY))
    return qaJson(401,{ok:false,error:'UNAUTHORIZED'});
  if(!env.ZALO_BOT_TOKEN||!env.ZALO_OWNER_CHAT_ID||!env.REPLAY_DB)
    return qaJson(503,{ok:false,error:'QA_DEPENDENCY_MISSING'});
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return qaJson(415,{ok:false,error:'JSON_REQUIRED'});
  let req;
  try{
    const raw=await request.text();
    if(raw.length>512)return qaJson(413,{ok:false,error:'BODY_TOO_LARGE'});
    req=JSON.parse(raw);
  }catch{return qaJson(400,{ok:false,error:'INVALID_JSON'})}
  if(!req||Array.isArray(req)||typeof req!=='object')return qaJson(422,{ok:false,error:'BODY_INVALID'});
  const isSend=path.endsWith('/send');
  const keys=Object.keys(req).sort().join(',');
  if(keys!==(isSend?'case_id,chat_id,test_id':'chat_id,test_id')||
     req.test_id!==TIEN404_QA_RICH.testId||typeof req.chat_id!=='string'||
     !(await qaSafeEqual(req.chat_id,env.ZALO_OWNER_CHAT_ID)))
    return qaJson(403,{ok:false,error:'SHOP_B_OWNER_ONLY'});
  if(!isSend){
    try{
      const r=await fetchImpl('https://bot-api.zaloplatforms.com/bot'+env.ZALO_BOT_TOKEN+'/getMe',
        {method:'POST',headers:{'content-type':'application/json'},body:'{}',redirect:'manual',signal:AbortSignal.timeout(6000)});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j.ok!==true)return qaJson(502,{ok:false,error:'BOT_IDENTITY_UNAVAILABLE'});
      const used=[];
      for(const id of ['T1','T2','T3']){
        const found=await env.REPLAY_DB.prepare('SELECT state FROM outbound_claims WHERE idempotency_key = ?1')
          .bind(TIEN404_QA_RICH.claimPrefix+id).first();
        if(found)used.push(id);
      }
      return qaJson(200,{ok:true,shop:'SHOP_B',owner_verified:true,bot_verified:true,
        allowlist_recipient_server_checked:true,global_send_enabled:false,
        supported_cases:['T1','T2','T3'],already_claimed:used,expires_at:TIEN404_QA_RICH.expiresAt,external_sends:0});
    }catch{return qaJson(503,{ok:false,error:'QA_PREFLIGHT_FAILED'});}
  }
  const payload=qaFixture(req.case_id);
  if(!payload)return qaJson(422,{ok:false,error:'CASE_NOT_ALLOWED'});
  const claimKey=TIEN404_QA_RICH.claimPrefix+req.case_id;
  try{
    const claimed=await env.REPLAY_DB.prepare(
      'INSERT INTO outbound_claims (idempotency_key, created_at, state) VALUES (?1, ?2, ?3) ON CONFLICT(idempotency_key) DO NOTHING')
      .bind(claimKey,Math.floor(now/1000),'CLAIMED').run();
    if(Number(claimed?.meta?.changes)!==1)return qaJson(409,{ok:false,error:'QA_ALREADY_CLAIMED_NO_RETRY'});
  }catch{return qaJson(503,{ok:false,error:'IDEMPOTENCY_STORE_UNAVAILABLE'});}
  let state='UNKNOWN',messageId=null;
  try{
    const r=await fetchImpl('https://bot-api.zaloplatforms.com/bot'+env.ZALO_BOT_TOKEN+'/sendMessage',{
      method:'POST',headers:{'content-type':'application/json'},redirect:'manual',
      body:JSON.stringify({chat_id:env.ZALO_OWNER_CHAT_ID,...payload}),signal:AbortSignal.timeout(8000)
    });
    const j=await r.json().catch(()=>({}));
    if(r.ok&&j.ok===true){state='API_ACCEPTED';messageId=typeof j.result?.message_id==='string'?j.result.message_id:null;}
    else state='PROVIDER_REJECTED_OR_UNKNOWN';
  }catch{state='UNKNOWN_AFTER_SEND_ATTEMPT';}
  try{
    await env.REPLAY_DB.prepare('UPDATE outbound_claims SET state = ?1 WHERE idempotency_key = ?2')
      .bind(state,claimKey).run();
  }catch{/* claim remains consumed; never retry a possibly delivered message */}
  return qaJson(state==='API_ACCEPTED'?200:502,{
    ok:state==='API_ACCEPTED',case_id:req.case_id,result:state,
    provider_message_id:messageId,external_send_attempts:1,orders_written:0,retry_allowed:false
  });
}

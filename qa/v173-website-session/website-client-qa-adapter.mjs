/**
 * V17.3 browser-side QA preview adapter — NOT wired into the live website.
 * No keys/Store IDs, no chat migration, no localStorage/cookies, no fallback
 * to existing public n8n marketing chat. Backend endpoints must be private,
 * independently deployed & approved before using real traffic.
 */
export function createWebsiteChatQaClient({apiBase,installationRef,origin,fetchImpl,randomId,now=()=>Date.now()}={}){
 const validOrigin=x=>{try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&u.origin===x;}catch{return false;}};
 if(!validOrigin(apiBase)||!validOrigin(origin)||typeof installationRef!=='string'||
 !/^QA_WEB_WIDGET_[A-Z0-9_]{1,60}$/.test(installationRef)||typeof fetchImpl!=='function'||typeof randomId!=='function')
 throw Error('V173_QA_CLIENT_NOT_CONFIGURED');
 let token=null,expiration=0;
 const request=async(path,data,bearer)=>{
  const headers={'Content-Type':'application/json','Accept':'application/json'};
  if(bearer)headers.Authorization='Bearer '+bearer;
  const res=await fetchImpl(apiBase+path,{method:'POST',mode:'cors',cache:'no-store',
    credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',headers,body:JSON.stringify(data)});
  if(!res?.ok)throw Error('V173_QA_BACKEND_UNAVAILABLE');
  return res.json();
 };
 async function start(){
  const result=await request('/v1/website/sessions',{installation_ref:installationRef},null);
  if(result?.status!=='SESSION_ISSUED'||result.source_scope!=='SYNTHETIC_QA_ONLY'||
    result.customer_identity_verified!==false||typeof result.token!=='string'||
    !/^t404s1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(result.token)||
    !Number.isInteger(result.expires_in_sec)||result.expires_in_sec<1||result.expires_in_sec>300)
   throw Error('V173_QA_SESSION_ISSUER_INVALID');
  token=result.token;expiration=now()+Math.min(result.expires_in_sec,300)*1000;
  return {status:'SESSION_READY',test_only:true};
 }
 async function chat(text){
  if(typeof text!=='string'||text.length<1||text.length>500)throw Error('V173_QA_TEXT_BOUNDS');
  if(!token||now()>=expiration-1000)await start();
  const id=randomId();
  if(typeof id!=='string'||!/^QA_MSG_[A-Z0-9_]{2,80}$/.test(id))throw Error('V173_QA_EVENT_ID_INVALID');
  const data=await request('/v1/website/messages',{installation_ref:installationRef,
    event_id:id,text,requested_tool:'catalog_read'},token);
  if(data?.status!=='QA_CATALOG_REPLY_PREPARED'||data.outbound!=='MOCK_ONLY_NOT_SENT'||
    data.hosted_rls_verified!==false||data.customer_identity_verified!==false||
    data.model_calls!==0||data.provider_sends!==0||data.commerce_writes!==0||
    typeof data.reply!=='string'||data.reply.length>500)throw Error('V173_QA_REPLY_SCOPE_DENIED');
  return {reply:data.reply,test_only:true};
 }
 return Object.freeze({start,chat,clear:()=>{token=null;expiration=0;return {status:'CLEARED'};}});
}

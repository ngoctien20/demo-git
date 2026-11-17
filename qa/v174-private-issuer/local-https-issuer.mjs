/**
 * V17.4 — real local HTTPS transport for private browser UAT only.
 * HARD SECURITY BOUNDARY: binds 127.0.0.1; ephemeral QA key; synthetic
 * V17.2 installation snapshot; no external network, Store DB, LLM or send.
 * NOT a production server and must never be deployed to a public host.
 */
import https from 'node:https';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {issueWebsiteSession,processWebsiteMessage} from '../v173-website-session/website-session-core.mjs';
import {evaluateInstallationOwner} from './owner-proof-gate.mjs';

const MAX_BODY=4096;
const CORE_JS=readFileSync(new URL('../v173-website-session/website-client-qa-adapter.mjs',import.meta.url),'utf8');
const PAGE=readFileSync(new URL('./browser-qa.html',import.meta.url),'utf8');
const UI=readFileSync(new URL('./browser-qa-ui.mjs',import.meta.url),'utf8');
const SNAPSHOT=JSON.parse(readFileSync(new URL('../v173-website-session/inactive-n8n-website-session-qa-snapshot.json',import.meta.url),'utf8'));

function fixture(){
 if(SNAPSHOT.schema_version!=='T404_V173_N8N_WEBSITE_SIGNED_SESSION_QA_SNAPSHOT_V1'||SNAPSHOT.registry.table_id!=='AAlsUnaAxbp0BscT')throw Error('QA_SNAPSHOT_ID_MISMATCH');
 const rows=SNAPSHOT.registry.rows;
 if(rows.length!==7||rows.some(x=>x.approval_scope!=='SYNTHETIC_ONLY'||x.owner_authority_verified!==false||x.read_only!==true))throw Error('QA_REGISTRY_NOT_SYNTHETIC');
 const website=rows.filter(x=>x.channel==='website');
 if(website.length!==1||website[0].installation_ref!=='QA_WEB_WIDGET_A'||website[0].store_ref!=='QA_STORE_A'||website[0].bot_ref!=='QA_BOT_A')throw Error('QA_WEBSITE_INSTALLATION_SCOPE_UNSAFE');
 return {...website[0]};
}
function json(res,status,payload){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Cross-Origin-Resource-Policy':'same-origin','Access-Control-Allow-Credentials':'false'});
 res.end(JSON.stringify(payload));
}
function staticFile(res,value,kind){
 res.writeHead(200,{'Content-Type':kind,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});
 res.end(value);
}
async function readJson(req){
 let total=0,chunks=[];
 for await(const part of req){total+=part.length;if(total>MAX_BODY)throw Error('BODY_LIMIT');chunks.push(part);}
 if(total===0)throw Error('EMPTY_BODY');
 const text=Buffer.concat(chunks).toString('utf8');
 const o=JSON.parse(text);
 if(!o||typeof o!=='object'||Array.isArray(o))throw Error('BODY_NOT_OBJECT');
 return o;
}
const exactKeys=(o,expected)=>Object.keys(o).length===expected.length&&expected.every(k=>Object.hasOwn(o,k));
export function createPrivateLoopbackQaIssuer({keyPem,certPem}={}){
 if(typeof keyPem!=='string'||typeof certPem!=='string'||!keyPem.includes('PRIVATE KEY')||!certPem.includes('CERTIFICATE'))throw Error('TEMPORARY_TLS_FILES_REQUIRED');
 const base=fixture();
 const stats={session_requests:0,message_requests:0,prepared:0,blocked:0,duplicates:0};
 let server,origin=null,active=true;
 const keyring={qa_v174:randomBytes(48).toString('base64url')};
 const config={issuer:'t404-qa-v174',audience:'t404-website-qa',activeKid:'qa_v174',keyring,qaMode:true};
 const claims=new Set();
 const binding=()=>({...base,origin});
 const resolveBinding=async({channel,installation_ref})=>active&&channel==='website'&&installation_ref==='QA_WEB_WIDGET_A'?binding():null;
 const claimMessage=async id=>{if(claims.has(id))return 'duplicate';claims.add(id);return 'claimed';}; // QA ONLY; not durable
 const readQaCatalog=async({tenant_ref,store_ref,sku})=>{
  if(tenant_ref!=='QA_TENANT_1'||store_ref!=='QA_STORE_A'||sku!=='QA_SKU_001')throw Error('QA_CATALOG_SCOPE');
  return {tenant_ref,store_ref,sku,price_vnd:159000,stock:5};
 };
 async function handler(req,res){
  const path=new URL(req.url||'/','https://127.0.0.1').pathname;
  if(!origin||!req.socket.remoteAddress?.includes('127.0.0.1')||req.headers.host!==new URL(origin).host){
   stats.blocked++;return json(res,403,{status:'BLOCKED',reason:'LOOPBACK_ONLY'});
  }
  if(req.method==='GET'){
   if(path==='/healthz')return json(res,200,{status:'V174_QA_LOOPBACK_ONLY',real_owner_verified:false,hosted_store_rls_verified:false,provider_sends:0});
   if(path==='/qa')return staticFile(res,PAGE,'text/html; charset=utf-8');
   if(path==='/qa-ui.mjs')return staticFile(res,UI,'text/javascript; charset=utf-8');
   if(path==='/qa-adapter.mjs')return staticFile(res,CORE_JS,'text/javascript; charset=utf-8');
   return json(res,404,{status:'NOT_FOUND'});
  }
  if(req.method!=='POST'||!['/v1/website/sessions','/v1/website/messages'].includes(path)){
   stats.blocked++;return json(res,405,{status:'BLOCKED',reason:'METHOD_OR_PATH_DENIED'});
  }
  if(req.headers.origin!==origin||!String(req.headers['content-type']||'').startsWith('application/json')){
   stats.blocked++;return json(res,403,{status:'BLOCKED',reason:'ORIGIN_OR_TYPE_DENIED'});
  }
  if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'){
   stats.blocked++;return json(res,403,{status:'BLOCKED',reason:'NON_SAME_ORIGIN_DENIED'});
  }
  let data;
  try{data=await readJson(req);}catch{
   stats.blocked++;return json(res,400,{status:'BLOCKED',reason:'INVALID_BOUNDED_JSON'});
  }
  const owner=evaluateInstallationOwner({binding:binding()});
  if(owner.status!=='QA_FIXTURE_ONLY'){
   stats.blocked++;return json(res,403,{status:'BLOCKED',reason:'OWNER_OR_MODE_NOT_QA'});
  }
  if(path==='/v1/website/sessions'){
   stats.session_requests++;
   if(!exactKeys(data,['installation_ref'])){
    stats.blocked++;return json(res,403,{status:'BLOCKED',reason:'CLIENT_SCOPE_CLAIMS_DENIED'});
   }
   const issued=await issueWebsiteSession({installationRef:data.installation_ref,origin,resolveBinding,config});
   if(issued.status!=='SESSION_ISSUED')stats.blocked++;
   return json(res,issued.status==='SESSION_ISSUED'?200:403,issued);
  }
  stats.message_requests++;
  if(!exactKeys(data,['installation_ref','event_id','text','requested_tool'])||
   typeof req.headers.authorization!=='string'||!req.headers.authorization.startsWith('Bearer ')){
   stats.blocked++;return json(res,401,{status:'BLOCKED',reason:'REQUEST_OR_SESSION_MISSING'});
  }
  const result=await processWebsiteMessage({request:{
   token:req.headers.authorization.slice(7),origin,installationRef:data.installation_ref,
   eventId:data.event_id,text:data.text,requestedTool:data.requested_tool
  },resolveBinding,config,claimMessage,readQaCatalog});
  if(result.status==='QA_CATALOG_REPLY_PREPARED')stats.prepared++;
  else if(result.status==='DUPLICATE_IGNORED')stats.duplicates++;
  else stats.blocked++;
  const status=result.status==='QA_CATALOG_REPLY_PREPARED'||result.status==='DUPLICATE_IGNORED'?200:
    (result.http_status&&Number.isInteger(result.http_status)?result.http_status:403);
  return json(res,status,result);
 }
 return Object.freeze({
  async listen(){
   if(server)throw Error('LOOPBACK_ALREADY_STARTED');
   server=https.createServer({key:keyPem,cert:certPem},(req,res)=>{handler(req,res).catch(()=>{stats.blocked++;if(!res.headersSent)json(res,503,{status:'BLOCKED',reason:'QA_INTERNAL_ERROR'});else res.destroy();});});
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
   origin='https://127.0.0.1:'+server.address().port;
   return origin;
  },
  async close(){if(server){await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));server=null;origin=null;}},
  getStats:()=>Object.freeze({...stats,real_merchant_owner_verified:false,real_website_session_issued:false,
   hosted_store_rls_verified:false,model_calls:0,commerce_writes:0,provider_sends:0}),
  revoke:()=>{active=false;},
  getOrigin:()=>origin
 });
}

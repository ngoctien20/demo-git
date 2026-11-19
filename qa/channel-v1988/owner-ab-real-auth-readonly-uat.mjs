/**
 * TIEN404 V19.8.8 — Real signed Supabase Auth Owner A/B Data API read-only UAT runner.
 *
 * NOT run by CI against any hosted account. NO writes to Commerce.
 * Data queries require a separately approved, disposable Supabase project
 * with the isolated t404_uat1988_* fixtures installed by an authorized operator.
 *
 * Tokens are obtained locally via password Auth, kept in process memory,
 * and never printed/saved. Auth sign-in may create temporary auth sessions.
 */
import {pathToFileURL} from 'node:url';
import process from 'node:process';

const BLOCKED_REFS=new Set(['ifxlvrhyjhbzbrkdsida','svxkwpmxgnfvewzwsbdt']);
const PROJECT_REF=/^[a-z0-9]{20}$/;
export const TABLES=['products','orders','conversations'];
const COLS={
 products:'store_code,sku,price_vnd,stock_on_hand,fixture_tag',
 orders:'store_code,order_ref,fixture_tag',
 conversations:'store_code,conversation_ref,fixture_tag'
};
const FIXTURES={
 A:{sku:'F01',price_vnd:159000,stock_on_hand:5},
 B:{sku:'F01',price_vnd:189000,stock_on_hand:9}
};
const fail=(code)=>{const e=new Error(code);e.code=code;return e;};

export function validateTarget({projectRef,explicit,publishableKey}) {
 if(explicit!=='APPROVED_ISOLATED_READONLY')throw fail('EXPLICIT_UAT_APPROVAL_GATE_REQUIRED');
 if(typeof projectRef!=='string'||!PROJECT_REF.test(projectRef)||
    BLOCKED_REFS.has(projectRef))throw fail('BLOCKED_OR_INVALID_SUPABASE_PROJECT');
 if(typeof publishableKey!=='string'||!publishableKey.trim())throw fail('PUBLIC_API_KEY_REQUIRED');
 if(/^sb_secret_/i.test(publishableKey))throw fail('SECRET_API_KEY_NOT_ALLOWED');
 if(publishableKey.split('.').length===3){
  try{
    const body=JSON.parse(Buffer.from(publishableKey.split('.')[1],'base64url').toString('utf8'));
    if(body.role!=='anon')throw fail('ONLY_ANON_PUBLISHABLE_KEY_ALLOWED');
  }catch {throw fail('ONLY_ANON_PUBLISHABLE_KEY_ALLOWED');}
 }else if(!publishableKey.startsWith('sb_publishable_'))throw fail('ONLY_ANON_PUBLISHABLE_KEY_ALLOWED');
 return 'https://'+projectRef+'.supabase.co';
}

/** Sanitized HTTP wrapper — never returns error bodies in failures. */
async function call(fetchImpl,url,headers,options={}) {
 let result;
 try{result=await fetchImpl(url,{...options,headers,signal:AbortSignal.timeout(10000),cache:'no-store'});}
 catch {throw fail('NETWORK_OR_TIMEOUT');}
 if(!result||typeof result.status!=='number')throw fail('INVALID_HTTP_RESPONSE');
 return result;
}
async function readJson(response) {
 try{return await response.json();}catch{throw fail('MALFORMED_API_RESPONSE');}
}
async function promptHidden(label){
 if(!process.stdin.isTTY||!process.stdout.isTTY||typeof process.stdin.setRawMode!=='function')
  throw fail('LOCAL_INTERACTIVE_TTY_REQUIRED');
 return await new Promise((resolve,reject)=>{
  process.stdout.write(label+': ');
  let typed='';
  const original=process.stdin.isRaw;
  const end=(err)=>{
   process.stdin.off('data',handler);
   process.stdin.setRawMode(Boolean(original));
   process.stdin.pause();
   process.stdout.write('\n');
   if(err)reject(err);else resolve(typed);
  };
  function handler(buf){
   for(const ch of buf.toString('utf8')){
    if(ch==='\r'||ch==='\n'){end();return;}
    if(ch==='\u0003'){typed='';end(fail('CANCELLED_BY_OPERATOR'));return;}
    if(ch==='\u007f'||ch==='\b'){typed=typed.slice(0,-1);}
    else if(ch>=' '&&typed.length<1024)typed+=ch;
   }
  }
  process.stdin.setRawMode(true);process.stdin.resume();process.stdin.on('data',handler);
 });
}
async function login(fetchImpl,base,key,label){
 let email='',password='';
 try{
  email=await promptHidden('QA '+label+' email (hidden)');
  password=await promptHidden('QA '+label+' password (hidden)');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password)throw fail('LOCAL_QA_CREDENTIAL_INVALID');
  const r=await call(fetchImpl,base+'/auth/v1/token?grant_type=password',
   {'apikey':key,'Content-Type':'application/json'},
   {method:'POST',body:JSON.stringify({email,password})});
  if(!r.ok)throw fail('AUTH_'+label+'_FAILED_HTTP_'+r.status);
  const data=await readJson(r);
  if(!data.access_token||typeof data.access_token!=='string')
   throw fail('AUTH_'+label+'_TOKEN_MISSING');
  return data.access_token;
 }finally{email='';password='';}
}
async function validateSignedSession(fetchImpl,base,key,token,label){
 const r=await call(fetchImpl,base+'/auth/v1/user',{apikey:key,Authorization:'Bearer '+token});
 if(!r.ok)throw fail('AUTH_USER_'+label+'_NOT_VERIFIED_HTTP_'+r.status);
 const user=await readJson(r);
 if(typeof user.id!=='string'||user.role!=='authenticated')
   throw fail('AUTH_USER_'+label+'_ROLE_INVALID');
 return user.id;
}
async function listFixture(fetchImpl,base,key,token,table,extra=''){
 const url=base+'/rest/v1/t404_uat1988_'+table+
 '?select='+encodeURIComponent(COLS[table])+
 (extra?'&'+extra:'');
 const headers={apikey:key};
 if(token)headers.Authorization='Bearer '+token;
 const r=await call(fetchImpl,url,headers);
 if(r.status===401||r.status===403)return {blocked:true,rows:[]};
 if(!r.ok)throw fail('REST_'+table+'_HTTP_'+r.status);
 const rows=await readJson(r);
 if(!Array.isArray(rows))throw fail('REST_'+table+'_NON_ARRAY');
 return {blocked:false,rows};
}
export function evaluateRows(table,owner,rows){
 if(!TABLES.includes(table)||!['A','B'].includes(owner)||!Array.isArray(rows))
  return {pass:false,reason:'BAD_INPUT'};
 if(rows.length!==1)return {pass:false,reason:'WRONG_ROW_COUNT'};
 const p=rows[0];
 if(!p||p.fixture_tag!=='V1988_SYNTHETIC_ONLY'||p.store_code!==owner)
  return {pass:false,reason:'CROSS_STORE_OR_NON_FIXTURE'};
 if(table==='products'){
  const f=FIXTURES[owner];
  if(p.sku!==f.sku||p.price_vnd!==f.price_vnd||
     p.stock_on_hand!==f.stock_on_hand)return {pass:false,reason:'PRICE_STOCK_MISMATCH'};
 }else{
  const k=table==='orders'?'order_ref':'conversation_ref';
  if(p[k]!=='V1988_'+owner+'_01')return {pass:false,reason:'WRONG_RESOURCE_SCOPE'};
 }
 return {pass:true,reason:'EXACT_STORE_FIXTURE'};
}
async function runLive(){
 const env=process.env;
 const base=validateTarget({
  projectRef:env.T404_UAT_PROJECT_REF,
  explicit:env.T404_UAT_EXPLICIT,
  publishableKey:env.T404_UAT_PUBLISHABLE_KEY
 });
 const projectRef=env.T404_UAT_PROJECT_REF;
 if(!env.T404_UAT_TARGET_OWNER_APPROVED || env.T404_UAT_TARGET_OWNER_APPROVED!==projectRef)
   throw fail('PROJECT_REF_NOT_SEPARATELY_CONFIRMED');
 process.stdout.write('V19.8.8 READONLY isolated owner UAT. No credentials will be displayed.\n');
 let a='',b='';
 const report=[];
 try{
  a=await login(fetch,base,env.T404_UAT_PUBLISHABLE_KEY,'A');
  b=await login(fetch,base,env.T404_UAT_PUBLISHABLE_KEY,'B');
  const ua=await validateSignedSession(fetch,base,env.T404_UAT_PUBLISHABLE_KEY,a,'A');
  const ub=await validateSignedSession(fetch,base,env.T404_UAT_PUBLISHABLE_KEY,b,'B');
  if(ua===ub)throw fail('OWNERS_A_AND_B_ARE_SAME_AUTH_USER');
  report.push({check:'real_supabase_auth_owner_a_and_b_distinct',pass:true});
  for(const [owner,token] of [['A',a],['B',b]]){
   const foreign=owner==='A'?'B':'A';
   for(const table of TABLES){
    const res=await listFixture(fetch,base,env.T404_UAT_PUBLISHABLE_KEY,token,table);
    const exact=evaluateRows(table,owner,res.rows);
    if(res.blocked||!exact.pass)throw fail('STORE_READ_FAIL_'+owner+'_'+table+'_'+exact.reason);
    report.push({check:owner+'_'+table+'_own_visible_only',pass:true});
    const cross=await listFixture(fetch,base,env.T404_UAT_PUBLISHABLE_KEY,token,table,
      'store_code=eq.'+foreign);
    if(!cross.blocked&&cross.rows.length!==0)throw fail('CROSS_STORE_LEAK_'+owner+'_'+table);
    report.push({check:owner+'_'+table+'_foreign_denied',pass:true});
   }
  }
  for(const table of TABLES){
   const anon=await listFixture(fetch,base,env.T404_UAT_PUBLISHABLE_KEY,null,table);
   if(!anon.blocked&&anon.rows.length!==0)throw fail('ANON_DATA_EXPOSED_'+table);
   report.push({check:'anon_'+table+'_denied',pass:true});
  }
  const invalid=await call(fetch,base+'/auth/v1/user',
    {apikey:env.T404_UAT_PUBLISHABLE_KEY,Authorization:'Bearer intentionally_invalid_v1988'});
  if(invalid.ok)throw fail('INVALID_BEARER_ACCEPTED');
  report.push({check:'invalid_bearer_rejected_by_auth',pass:true});
  // No emails, IDs, tokens, network bodies, raw rows, or sensitive headers printed.
  process.stdout.write(JSON.stringify({
    checkpoint:'V19.8.8_REAL_OWNER_AB_DATA_API_READONLY_UAT',
    environment:'APPROVED_ISOLATED_PROJECT_ONLY',
    realSupabaseAuthVerified:true,
    testsPassed:report.length,
    testsFailed:0,
    result:'READONLY_UAT_PASS_FIXTURE_SCOPE_ONLY',
    warning:'Does not approve live Bot binding, shared Commerce migration, order writes or provider send.',
    report
  },null,2)+'\n');
 }finally {a='';b='';}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 runLive().catch(e=>{
  const safeCode=String(e?.code||'UAT_BLOCKED').replace(/[^A-Z0-9_]/g,'').slice(0,90);
  process.stderr.write('V19.8.8 NO_GO: '+safeCode+'\n');
  process.exitCode=1;
 });
}

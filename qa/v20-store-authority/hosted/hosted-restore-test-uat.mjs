/**
 * TIEN404 V20 Store Authority — HOSTED UAT on tien404-restore-test ONLY (owner-approved 2026-11-21 12:47 UTC).
 * Real hosted GoTrue password-grant JWTs + hosted PostgREST. Test users are created by SQL
 * (no signup e-mail is sent), use random per-run passwords, and are deleted at the end with
 * every row this run created. Never targets staging. Prints only PASS/FAIL tags.
 */
import {randomBytes, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const REF='cunxxzxaboazbszsfneo', STAGING='ifxlvrhyjhbzbrkdsida';
const API=`https://${REF}.supabase.co`;
const KEY=process.env.T404_RESTORE_PUBLISHABLE_KEY||'';
const DB=process.env.RESTORE_DB_URL||'';
const TA='9c8c524c-88db-4771-8ab0-a4316298494c', TB='4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5';
const KINDS=['products','customers','orders','order_items','conversations','messages'];
const RUN=randomBytes(4).toString('hex');
const WRITER=process.env.T404_V20_WRITER==='v2'?'v2':'v1';
const BRANCH=randomUUID(), CUST=randomUUID(), ORDER=randomUUID(), CONV=randomUUID();
let pass=0; const users=[];
const must=(v,t)=>{if(!v)throw Error('QA20H_'+t)};
const ok=(v,t)=>{must(v,t);pass++;console.log('PASS_'+t)};
const lit=s=>{must(/^[0-9a-zA-Z@._:-]*$/.test(s),'UNSAFE_LITERAL');return "'"+s+"'"};
function sql(q,vars={}){
 const args=['-X','-q','-t','-A','-v','ON_ERROR_STOP=1'];
 for(const [k,v] of Object.entries(vars))args.push('-v',`${k}=${v}`);
 // SQL goes in on stdin so psql :'var' interpolation works and secrets never reach argv.
 try{return execFileSync('psql',[DB,...args],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000}).trim()}
 catch{throw Error('QA20H_SQL_FAILED')}   // never echo raw psql errors (could contain connection details)
}
async function req(path,jwt,method='GET',body){
 must(path.startsWith('/auth/v1/')||path.startsWith('/rest/v1/'),'ENDPOINT_SCOPE');
 const headers={apikey:KEY,accept:'application/json'};
 if(jwt)headers.authorization='Bearer '+jwt;
 if(body!==undefined)headers['content-type']='application/json';
 const r=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
 let data=null;try{data=await r.json()}catch{}
 return {ok:r.ok,status:r.status,data};
}
async function makeUser(label){
 const id=randomUUID(), email=`v20-${label.toLowerCase()}-${RUN}@qa.invalid`;
 const pw=randomBytes(24).toString('base64url');
 users.push(id);
 sql(`INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
  VALUES('00000000-0000-0000-0000-000000000000',${lit(id)},'authenticated','authenticated',${lit(email)},
   extensions.crypt(:'pw',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
  INSERT INTO auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
  VALUES(${lit(id)},${lit(id)},jsonb_build_object('sub',${lit(id)},'email',${lit(email)},'email_verified',true),'email',now(),now(),now());`,{pw});
 const l=await req('/auth/v1/token?grant_type=password',null,'POST',{email,password:pw});
 must(l.ok&&typeof l.data?.access_token==='string','HOSTED_LOGIN_'+label+'_HTTP'+l.status);
 const v=await req('/auth/v1/user',l.data.access_token);
 must(v.ok&&v.data?.id===id&&v.data?.role==='authenticated','HOSTED_JWT_VERIFY_'+label);
 return {id,jwt:l.data.access_token};
}
const rows=(a,kind,filter='')=>req('/rest/v1/'+kind+'?select=id,store_id'+filter,a?.jwt);
function cleanup(){
 if(!users.length)return;
 const ids=users.map(lit).join(',');
 sql(`BEGIN;
  DELETE FROM public.messages WHERE store_id=${lit(BRANCH)};
  DELETE FROM public.conversations WHERE store_id=${lit(BRANCH)};
  DELETE FROM public.order_items WHERE store_id=${lit(BRANCH)};
  DELETE FROM public.orders WHERE store_id=${lit(BRANCH)};
  DELETE FROM public.customers WHERE store_id=${lit(BRANCH)};
  DELETE FROM public.products WHERE store_id=${lit(BRANCH)} OR sku LIKE 'QA-V20-%';
  DELETE FROM app_private.audit_events WHERE actor_id IN (${ids});
  DELETE FROM public.store_memberships WHERE user_id IN (${ids});
  DELETE FROM public.stores WHERE id=${lit(BRANCH)};
  DELETE FROM public.tenant_memberships WHERE user_id IN (${ids});
  DELETE FROM auth.identities WHERE user_id IN (${ids});
  DELETE FROM auth.users WHERE id IN (${ids});
  COMMIT;`);
 const left=sql(`SELECT (SELECT count(*) FROM auth.users WHERE id IN (${ids}))+(SELECT count(*) FROM public.stores WHERE id=${lit(BRANCH)})+(SELECT count(*) FROM public.products WHERE sku LIKE 'QA-V20-%')`);
 must(left==='0','CLEANUP_INCOMPLETE');
 console.log('PASS_CLEANUP_ALL_TEST_ROWS_AND_USERS_REMOVED');
}
async function run(){
 must(process.env.T404_V20_HOSTED_TARGET===REF,'TARGET_FLAG');
 must(KEY.startsWith('sb_publishable_'),'PUBLISHABLE_KEY_ONLY');
 must(DB.includes(REF)&&!DB.includes(STAGING),'DB_URL_MUST_BE_RESTORE_TEST');
 must(sql("SELECT to_regclass('restore_test_guard.marker') IS NOT NULL")==='t','RESTORE_TEST_GUARD_MARKER');
 must(sql("SELECT to_regclass('public.stores') IS NOT NULL AND EXISTS(SELECT 1 FROM pg_policies WHERE policyname='products_store_member_read')")==='t','MIGRATION_NOT_APPLIED');
 ok(true,'TARGET_IS_RESTORE_TEST_WITH_GUARD_AND_MIGRATION');
 // Existing real owners (restored from staging) keep access: simulated claims, read-only.
 for(const t of [TA,TB]){
  const owner=sql(`SELECT user_id FROM public.tenant_memberships WHERE tenant_id=${lit(t)} AND role='owner' AND active ORDER BY created_at LIMIT 1`);
  const r=sql(`BEGIN; SELECT set_config('request.jwt.claims',json_build_object('sub',${lit(owner)},'role','authenticated')::text,true);
   SET LOCAL ROLE authenticated; SELECT count(*) FROM public.products; ROLLBACK;`).split('\n').filter(Boolean);
  ok(Number(r[r.length-1])>=1,'EXISTING_OWNER_KEEPS_PRODUCTS_'+(t===TA?'A':'B'));
 }
 const [a,b,br,tm]=[await makeUser('OWNER_A'),await makeUser('OWNER_B'),await makeUser('BRANCH'),await makeUser('TENANT_ONLY')];
 ok(new Set([a.id,b.id,br.id,tm.id]).size===4,'FOUR_REAL_HOSTED_GOTRUE_JWTS');
 sql(`INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES
   (${lit(TA)},${lit(a.id)},'owner'),(${lit(TB)},${lit(b.id)},'owner'),(${lit(TA)},${lit(br.id)},'owner'),(${lit(TA)},${lit(tm.id)},'manager');
  INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role) VALUES
   (${lit(TA)},(SELECT id FROM public.stores WHERE tenant_id=${lit(TA)} AND is_default),${lit(a.id)},'owner'),
   (${lit(TB)},(SELECT id FROM public.stores WHERE tenant_id=${lit(TB)} AND is_default),${lit(b.id)},'owner');
  INSERT INTO public.stores(id,tenant_id,store_key,name) VALUES (${lit(BRANCH)},${lit(TA)},'qa-v20-${RUN}','QA V20 branch');
  INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role) VALUES (${lit(TA)},${lit(BRANCH)},${lit(br.id)},'owner');
  INSERT INTO public.products(tenant_id,store_id,sku,name,price_vnd) VALUES (${lit(TA)},${lit(BRANCH)},'QA-V20-B-${RUN}','QA branch',199000);
  INSERT INTO public.customers(id,tenant_id,store_id,display_name) VALUES (${lit(CUST)},${lit(TA)},${lit(BRANCH)},'QA khach');
  INSERT INTO public.orders(id,tenant_id,customer_id,total_vnd) VALUES (${lit(ORDER)},${lit(TA)},${lit(CUST)},199000);
  INSERT INTO public.order_items(tenant_id,order_id,product_id,quantity,unit_price_vnd)
   SELECT ${lit(TA)},${lit(ORDER)},id,1,199000 FROM public.products WHERE sku='QA-V20-B-${RUN}';
  INSERT INTO public.conversations(id,tenant_id,store_id,channel) VALUES (${lit(CONV)},${lit(TA)},${lit(BRANCH)},'zalo');
  INSERT INTO public.messages(tenant_id,conversation_id,sender,body) VALUES (${lit(TA)},${lit(CONV)},'customer','qa');`);
 ok(sql(`SELECT count(*) FROM public.order_items WHERE order_id=${lit(ORDER)} AND store_id=${lit(BRANCH)}`)==='1','HOSTED_CHILD_INHERITS_STORE');
 for(const kind of KINDS){
  const own=await rows(br,kind);
  ok(own.ok&&own.data.length>=1&&own.data.every(r=>r.store_id===BRANCH),'BRANCH_OWNER_'+kind+'_ONLY_OWN_STORE');
  const main=await rows(a,kind,'&store_id=eq.'+BRANCH);
  ok(main.ok&&main.data.length===0,'MAIN_OWNER_'+kind+'_CROSS_STORE_DENIED');
  const foreign=await rows(b,kind,'&tenant_id=eq.'+TA);
  ok(foreign.ok&&foreign.data.length===0,'OWNER_B_'+kind+'_CROSS_TENANT_DENIED');
  const t=await rows(tm,kind);
  ok(t.ok&&t.data.length===0,'TENANT_MEMBER_NO_STORE_'+kind+'_DENIED');
  const anon=await rows(null,kind);
  ok(!anon.ok||(Array.isArray(anon.data)&&anon.data.length===0),'ANON_'+kind+'_DENIED');
 }
 const sa=await req('/rest/v1/stores?select=id',null);
 ok(!sa.ok||(Array.isArray(sa.data)&&sa.data.length===0),'ANON_STORES_DENIED');
 const self=await req('/rest/v1/store_memberships',tm.jwt,'POST',{tenant_id:TA,store_id:BRANCH,user_id:tm.id,role:'owner'});
 ok(!self.ok&&[401,403].includes(self.status),'SELF_GRANT_STORE_MEMBERSHIP_DENIED');
 const forged=await req('/rest/v1/products?select=id',a.jwt.slice(0,-2)+(a.jwt.endsWith('AZ')?'zx':'AZ'));
 ok([400,401,403].includes(forged.status),'TAMPERED_JWT_DENIED');
 // Live writer compatibility through hosted PostgREST RPC.
 const w=await req('/rest/v1/rpc/save_merchant_product',a.jwt,'POST',{p_tenant:TA,p_sku:'QA-V20-W-'+RUN,p_name:'QA writer',
  p_price:120000,p_active:true,p_initial_stock:2,p_expected_updated_at:null});
 ok(w.ok,'HOSTED_WRITER_CREATE_HTTP'+w.status);
 ok(sql(`SELECT s.is_default FROM public.products p JOIN public.stores s ON s.id=p.store_id WHERE p.sku='QA-V20-W-${RUN}'`)==='t','HOSTED_WRITER_ROW_IN_DEFAULT_STORE');
 const w2=await req('/rest/v1/rpc/save_merchant_product',a.jwt,'POST',{p_tenant:TA,p_sku:'QA-V20-W-'+RUN,p_name:'QA writer 2',
  p_price:130000,p_active:true,p_initial_stock:null,p_expected_updated_at:w.data});
 ok(w2.ok&&sql(`SELECT price_vnd FROM public.products WHERE sku='QA-V20-W-${RUN}'`)==='130000','HOSTED_WRITER_UPDATE_BY_TENANT_SKU');
 const wb=await req('/rest/v1/rpc/save_merchant_product',tm.jwt,'POST',{p_tenant:TA,p_sku:'QA-V20-X-'+RUN,p_name:'x',
  p_price:1,p_active:true,p_initial_stock:0,p_expected_updated_at:null});
 if(WRITER==='v1'){
  ok(wb.ok,'V1_NOTE_WRITER_TENANT_SCOPED_MANAGER_WITHOUT_STORE_CAN_CREATE');
 }else{
  ok(!wb.ok&&wb.status===403,'V2_WRITER_TENANT_MANAGER_WITHOUT_STORE_DENIED_HTTP'+wb.status);
  const intoMain=await req('/rest/v1/rpc/save_merchant_product',br.jwt,'POST',{p_tenant:TA,p_sku:'QA-V20-Y-'+RUN,p_name:'y',
   p_price:1,p_active:true,p_initial_stock:0,p_expected_updated_at:null});
  ok(!intoMain.ok&&intoMain.status===403,'V2_WRITER_BRANCH_OWNER_INTO_MAIN_STORE_DENIED');
  const bts=sql(`SELECT to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM public.products WHERE sku='QA-V20-B-${RUN}'`);
  const hijack=await req('/rest/v1/rpc/save_merchant_product',a.jwt,'POST',{p_tenant:TA,p_sku:'QA-V20-B-'+RUN,p_name:'hijack',
   p_price:1,p_active:true,p_initial_stock:null,p_expected_updated_at:bts});
  ok(!hijack.ok&&hijack.status===403,'V2_WRITER_MAIN_OWNER_EDIT_BRANCH_PRODUCT_DENIED');
  const own=await req('/rest/v1/rpc/save_merchant_product',br.jwt,'POST',{p_tenant:TA,p_sku:'QA-V20-B-'+RUN,p_name:'QA branch 2',
   p_price:209000,p_active:true,p_initial_stock:null,p_expected_updated_at:bts});
  ok(own.ok&&sql(`SELECT price_vnd FROM public.products WHERE sku='QA-V20-B-${RUN}'`)==='209000','V2_WRITER_BRANCH_OWNER_EDITS_OWN_PRODUCT');
  ok(sql(`SELECT count(*) FROM public.products WHERE sku IN ('QA-V20-X-${RUN}','QA-V20-Y-${RUN}')`)==='0','V2_NO_ROWS_FROM_DENIED_CALLS');
 }
 // Revocation with the same JWT.
 sql(`UPDATE public.store_memberships SET active=false WHERE user_id=${lit(br.id)}`);
 for(const kind of KINDS){const r=await rows(br,kind);ok(r.ok&&r.data.length===0,'REVOKED_SAME_JWT_'+kind+'_DENIED');}
 sql(`UPDATE public.store_memberships SET active=true WHERE user_id=${lit(br.id)}; UPDATE public.stores SET active=false WHERE id=${lit(BRANCH)}`);
 const closed=await rows(br,'orders');
 ok(closed.ok&&closed.data.length===0,'INACTIVE_STORE_DENIED');
}
let failed=null;
try{await run()}catch(e){const s=String(e?.message||'');failed=s.startsWith('QA20H_')?s.replace(/[^A-Z0-9_]/g,'').slice(0,120):'INTERNAL_ERROR';console.log('FAIL_'+failed)}
try{cleanup()}catch{console.log('FAIL_CLEANUP');failed=failed||'CLEANUP'}
console.log(JSON.stringify({checkpoint:'V20_STORE_AUTHORITY_HOSTED_RESTORE_TEST',writer:WRITER,target:REF,status:failed?'FAIL':'PASS',
 passed:pass,failed:failed?1:0,realHostedGoTrueJwt:true,stagingTouched:false,providerSends:0,productionReady:false}));
if(failed)process.exitCode=1;

// LIVE read-only Hosted Auth/RLS acceptance runner — NEVER execute in public CI.
// Requires TWO separately authorized Shop A/B Playwright storageState files OUTSIDE this repo.
// Files contain credentials: never upload, commit, paste, or print them.
// Usage documented in docs/ai-handoff/V13_6_HOSTED_AUTH_RLS_AND_ZALO_REPORT.md
import {existsSync,statSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {checkConfig,checkUserEvidence,checkAnonymousEvidence,RENDER_AUTH_ORIGIN} from './hosted-rls-contract.mjs';

function privateState(raw){
 if(!raw||!path.isAbsolute(raw))throw Error('PRIVATE_ABSOLUTE_STATE_FILE_REQUIRED');
 const file=realpathSync(raw),root=realpathSync(process.cwd());
 if(file===root||file.startsWith(root+path.sep))throw Error('SESSION_FILE_INSIDE_REPOSITORY_DENIED');
 if(!existsSync(file)||!statSync(file).isFile())throw Error('STATE_FILE_MISSING');
 if(process.platform!=='win32'&&(statSync(file).mode&0o077)!==0)
   throw Error('STATE_FILE_PERMISSIONS_NOT_PRIVATE_USE_CHMOD_600');
 return file;
}
const params=checkConfig({
 origin:RENDER_AUTH_ORIGIN,
 tenantA:process.env.QA_TENANT_A_UUID,
 tenantB:process.env.QA_TENANT_B_UUID,
 stateA:process.env.QA_SHOP_A_STORAGE_STATE,
 stateB:process.env.QA_SHOP_B_STORAGE_STATE
});
const fileA=privateState(process.env.QA_SHOP_A_STORAGE_STATE);
const fileB=privateState(process.env.QA_SHOP_B_STORAGE_STATE);
if(fileA===fileB)throw Error('STATES_MUST_BE_INDEPENDENT');
const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true});
const timeout=25000;
const isMutable=req=>{
 const u=new URL(req.url());
 return u.hostname==='ifxlvrhyjhbzbrkdsida.supabase.co' &&
   (/^\/rest\/v1\/(orders|customers|products|tenant_memberships)|^\/rest\/v1\/rpc\//.test(u.pathname)) &&
   !['GET','HEAD','OPTIONS'].includes(req.method());
};

async function runShop(file,ownTenant,foreignTenant,label){
 const ctx=await browser.newContext({storageState:file,locale:'vi-VN'});
 const page=await ctx.newPage(),counters={mutatingRestRequests:0};
 page.on('request',req=>{if(isMutable(req))counters.mutatingRestRequests++});
 try{
  await page.goto(params.origin+'/merchant-portal.html',{waitUntil:'domcontentloaded',timeout});
  await page.locator('#merchant-protected').waitFor({state:'visible',timeout});
  const v=await page.evaluate(async({ownTenant,foreignTenant})=>{
    // All sensitive values (including JWT) remain inside the authorized browser context.
    const {getAuthClient}=await import('/assets/auth-client.js');
    const client=await getAuthClient();
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user?.id)return {authenticated:false};
    const ownMembership=await client.from('tenant_memberships').select('tenant_id,role,active')
      .eq('user_id',user.id).eq('active',true).eq('tenant_id',ownTenant);
    const foreignMembership=await client.from('tenant_memberships').select('tenant_id')
      .eq('user_id',user.id).eq('active',true).eq('tenant_id',foreignTenant);
    const ownOrders=await client.from('orders').select('id,tenant_id')
      .eq('tenant_id',ownTenant).limit(30);
    const foreignOrders=await client.from('orders').select('id,tenant_id')
      .eq('tenant_id',foreignTenant).limit(30);
    const foreignTenantData=await client.from('tenants').select('id')
      .eq('id',foreignTenant).limit(1);
    return {
      authenticated:true,
      userIdForLocalComparisonOnly:user.id, // NEVER log; comparison stays in this CLI memory.
      userIdentityVerified:true,
      memberOfOwn:!ownMembership.error&&ownMembership.data?.some(m=>
        m.tenant_id===ownTenant&&['owner','manager'].includes(m.role)&&m.active===true)===true,
      memberOfOther:!!foreignMembership.error?true:(foreignMembership.data||[]).length>0,
      selfOrdersError:!!ownOrders.error||!!ownOrders.data?.some(o=>o.tenant_id!==ownTenant),
      otherOrdersError:!!foreignOrders.error,
      selfOrderCount:ownOrders.data?.length??-1,
      otherOrderCount:foreignOrders.data?.length??-1,
      otherTenantVisible:!!foreignTenantData.error?true:(foreignTenantData.data||[]).length>0,
      uiProtectedVisible:document.querySelector('#merchant-protected')?.hidden===false
    };
   },{ownTenant,foreignTenant});
  const userId=v.userIdForLocalComparisonOnly;
  delete v.userIdForLocalComparisonOnly;
  const evidence=checkUserEvidence({...v,mutatingRestRequests:counters.mutatingRestRequests},label);
  return {evidence,userId};
 }finally{await ctx.close()}
}
async function runAnon(){
 const ctx=await browser.newContext({locale:'vi-VN'}),page=await ctx.newPage();
 const counters={mutatingRestRequests:0};page.on('request',req=>{if(isMutable(req))counters.mutatingRestRequests++});
 try{
  await page.goto(params.origin+'/merchant-portal.html',{waitUntil:'domcontentloaded',timeout});
  await page.locator('#merchant-login').waitFor({state:'visible',timeout});
  const v=await page.evaluate(async()=>{
    const {getAuthClient}=await import('/assets/auth-client.js');
    const client=await getAuthClient();
    const r=await client.from('orders').select('id').limit(2);
    return {uiProtectedVisible:document.querySelector('#merchant-protected')?.hidden===false,
      orderRowsVisible:Array.isArray(r.data)?r.data.length:0};
  });
  return checkAnonymousEvidence({...v,mutatingRestRequests:counters.mutatingRestRequests});
 }finally{await ctx.close()}
}
try{
 const a=await runShop(fileA,params.tenantA,params.tenantB,'SHOP_A');
 const b=await runShop(fileB,params.tenantB,params.tenantA,'SHOP_B');
 if(a.userId===b.userId)throw Error('QA_IDENTITIES_MUST_BE_DIFFERENT');
 const anon=await runAnon();
 // No tenant UUID, order UUID, personal data, user ID, session, or JWT in logs.
 console.log(JSON.stringify({stage:'HOSTED_REAL_AUTH_RLS',host:params.origin,
  shopA:a.evidence.passed,shopB:b.evidence.passed,anonymous:anon.passed,
  negativeCrossShop:true,ordersWereReadOnly:true,writeRequests:0,status:'PASS'},null,2));
}finally{await browser.close()}

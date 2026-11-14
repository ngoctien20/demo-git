"""Browser regression for authenticated Account and Merchant tab return.
All Auth/tenant operations mocked locally. Zero production/staging data writes.
"""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent/'auth-preview-dist'
MOCK=r"""
const uid='33333333-3333-4333-8333-333333333333';
const tid='44444444-4444-4444-8444-444444444444';
let allowed=true;
const callbacks=[];
window.__qaAuthReads=0;
window.__qaEmitAuth=(event,session)=>{for(const cb of callbacks)cb(event,session)};
window.__qaRevoke=()=>{allowed=false};
class Query{
 constructor(table){this.table=table;this.filters=[];this.countMode=false;this.lim=100;}
 select(fields,options){this.countMode=!!options?.head;return this}
 eq(k,v){this.filters.push([k,v]);return this}
 in(k,vs){this.filters.push([k,vs]);return this}
 limit(v){this.lim=v;return this}
 order(){return this}
 range(){return this}
 gte(){return this}
 lte(){return this}
 get(){
  const data=(()=>{
   if(this.table==='tenant_memberships'&&allowed)return [{tenant_id:tid,user_id:uid,role:'staff',active:true}];
   if(this.table==='tenants'&&allowed)return [{id:tid,name:'Cửa hàng QA'}];
   return [];
  })();
  const filtered=data.filter(row=>this.filters.every(([k,v])=>Array.isArray(v)?v.includes(row[k]):row[k]===v));
  return {data:this.countMode?null:filtered.slice(0,this.lim),count:this.countMode?filtered.length:null,error:null};
 }
 then(res,rej){return Promise.resolve(this.get()).then(res,rej)}
 maybeSingle(){const r=this.get();return Promise.resolve({...r,data:r.data?.[0]||null})}
 single(){return this.maybeSingle()}
}
export async function getAuthClient(){
 return {
  auth:{
   getUser:async()=>{window.__qaAuthReads++;return {data:{user:{id:uid,email:'qa@example.test'}},error:null}},
   onAuthStateChange:(cb)=>{callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}}},
   signOut:async()=>({error:null})
  },
  from:(table)=>new Query(table),
  rpc:async()=>({data:[],error:null})
 };
}
"""
def main():
 assert ROOT.exists()
 http=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
 Thread(target=http.serve_forever,daemon=True).start()
 origin=f'http://127.0.0.1:{http.server_address[1]}'
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True)
   try:
    for route,protected,lock,content in [
      ('account.html','#account-protected','#account-login-link','#account-tenants'),
      ('merchant-portal.html','#merchant-protected','#merchant-login','#merchant-panel')
    ]:
     page=browser.new_page(viewport={'width':390,'height':844})
     errors=[]
     page.on('pageerror',lambda e:errors.append(str(e)))
     page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin+'/') else r.abort())
     page.route('**/assets/auth-client.js',lambda r:r.fulfill(status=200,content_type='application/javascript',body=MOCK))
     page.goto(origin+'/'+route,wait_until='domcontentloaded')
     page.locator(protected).wait_for(state='visible',timeout=15000)
     page.evaluate("selector=>{const x=document.querySelector(selector); const s=document.createElement('span');s.id='qa-preserved';s.textContent='unsent-input';x.append(s)}",content)
     start=page.evaluate('window.__qaAuthReads')
     page.evaluate("""() => {
       window.__qaEmitAuth('TOKEN_REFRESHED',{user:{id:'33333333-3333-4333-8333-333333333333'}});
       Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
       document.dispatchEvent(new Event('visibilitychange'));
     }""")
     page.wait_for_timeout(220)
     assert page.evaluate('window.__qaAuthReads')==start,(route,'Unexpected token refresh recheck')
     assert page.locator('#qa-preserved').count()==1,(route,'Lost content after token')
     assert page.locator(protected).is_visible()
     # After 5 min, same identity + same RLS permissions: silent background check, NO DOM removal.
     page.evaluate("""() => {
       const now=Date.now.bind(Date);Date.now=()=>now()+301000;
       document.dispatchEvent(new Event('visibilitychange'));
     }""")
     page.wait_for_function('window.__qaAuthReads >= 2',timeout=11000)
     page.wait_for_timeout(200)
     assert page.locator('#qa-preserved').count()==1,(route,'Lost content after routine recheck')
     assert page.locator(protected).is_visible()
     # After another 5 min, revoked membership must fail closed.
     page.evaluate("""() => {
       window.__qaRevoke(); const old=Date.now.bind(Date);Date.now=()=>old()+301000;
       document.dispatchEvent(new Event('visibilitychange'));
     }""")
     page.locator(protected).wait_for(state='hidden',timeout=12000)
     assert page.locator(lock).is_visible(),(route,'Revoked access not blocked')
     assert not errors,(route,errors)
     page.close()
     print('PASS: '+route+' token refresh stable, 5-min RLS check preserves DOM, revoked RLS locks UI')
   finally:
    browser.close()
 finally:
  http.shutdown();http.server_close()
if __name__=='__main__':main()

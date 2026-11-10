from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from pathlib import Path
import os
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a): pass
def serve(folder):
 h=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=folder))
 Thread(target=h.serve_forever,daemon=True).start()
 return f'http://127.0.0.1:{h.server_port}'
auth=serve('auth-preview-dist')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.getenv('QA_CHROMIUM') or None)
 page=b.new_page(viewport={'width':360,'height':780},is_mobile=True,has_touch=True,color_scheme='dark')
 stub="""let who='A';let cb;const user=()=>({id:who,email:'fixture@example.invalid'});
 const auth={onAuthStateChange(f){cb=f},getUser:async()=>({data:{user:who?user():null}}),signOut:async()=>{who=null;cb('SIGNED_OUT');return {}}};
 window.testAccount=(v)=>{who=v;cb(v?'SIGNED_IN':'SIGNED_OUT',{user:user()})};
 export const authClient={auth,from(table){const q={select(){return q},eq(){return q},in(){return q},limit:async()=>({data:table==='tenants'?[{id:who,name:'Shop '+who}]:[{tenant_id:who,user_id:who,role:'owner',active:true}]})};return q}}
 """
 page.route('**/assets/auth-client.js',lambda r:r.fulfill(content_type='application/javascript',body=stub))
 page.goto(auth+'/account.html');page.get_by_text('Shop A',exact=True).wait_for();page.evaluate("window.testAccount('B')")
 page.get_by_text('Shop B',exact=True).wait_for();assert page.get_by_text('Shop A',exact=True).count()==0
 page.evaluate('window.testAccount(null)');assert not page.locator('#account-protected').is_visible()
 page.goto(auth+'/account.html');page.get_by_text('Shop A',exact=True).wait_for()
 page.goto(auth+'/login.html');page.locator('#auth-password').fill('fixture-visible');print('auth mock identity switch, sign-out and mobile input',page.locator('#auth-password').evaluate("e=>[getComputedStyle(e).color,getComputedStyle(e).backgroundColor]"));assert page.locator('#auth-forgot-password').is_disabled()
 b.close()

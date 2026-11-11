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
widget=serve('.')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.getenv('QA_CHROMIUM') or None)
 page=b.new_page(viewport={'width':360,'height':780},is_mobile=True,has_touch=True,color_scheme='dark')
 page.route('https://**/*',lambda r:r.abort())
 for width in [360,412,1280]:
  page.set_viewport_size({'width':width,'height':800});page.goto(widget+'/about.html')
  btn=page.locator('#tien404-chat-launcher');btn.click();panel=page.locator('#tien404-chat-panel');assert panel.is_visible()
  page.locator('#n8n-chat-fallback').wait_for(state='visible')
  page.add_script_tag(url=widget+'/assets/website-chat-loader.js');assert btn.count()==1
  box=panel.bounding_box(); assert box['height']<800 and box['width']<=width
  page.keyboard.press('Escape');assert not panel.is_visible()
  page.evaluate("window.scrollTo({top:700,behavior:'instant'})");assert page.evaluate('scrollY')>0
  print('widget fallback, duplicate guard, close and scroll',width,box)
 b.close()

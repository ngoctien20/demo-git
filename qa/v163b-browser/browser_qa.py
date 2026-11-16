#!/usr/bin/env python3
"""V16.3B full Chromium UI regression against checked-out source.
No remote URLs, provider callbacks, prompts, secrets, paid APIs, or hosted changes.
Screenshots and JSON contain ONLY synthetic fixed QA result text.
"""
from __future__ import annotations
import functools, json, os, pathlib, shutil, threading, traceback
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1] # qa/
ART=pathlib.Path(os.environ.get('QA_BROWSER_ARTIFACTS',str(pathlib.Path(__file__).parent/'artifacts')))
ART.mkdir(parents=True,exist_ok=True)
QA_HTML='v163-studios/preview.html'
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

checks=[]; errors=[]; external=[]
def case(name,fn):
    try:
        value=fn()
        checks.append({'case':name,'result':'PASS','detail':str(value)[:180] if value is not None else ''})
    except Exception as e:
        checks.append({'case':name,'result':'FAIL','detail':str(e)[:350]})
def eq(actual,expected):
    if actual!=expected:raise AssertionError(f'expected {expected!r}, found {actual!r}')
def ok(value,why):
    if not value:raise AssertionError(why)
def result(page,name):
    raw=page.locator('#'+name+'-result').inner_text()
    return json.loads(raw)
def click_tab(page,name):
    page.locator('button[data-tab="'+name+'"]').click()
    eq(page.locator('#panel-'+name).evaluate('(el)=>getComputedStyle(el).display'),'block')
def button(page,name):page.locator('#'+name).click()
def browser_qa(browser,url):
    for width,height in [(320,700),(360,780),(390,844),(768,1024),(1280,800),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
        page.on('pageerror',lambda exc:errors.append('pageerror: '+str(exc)[:400]))
        page.on('console',lambda msg:errors.append('console: '+msg.text[:400]) if msg.type=='error' else None)
        def allow(route):
            if route.request.url.startswith(url.split('/v163-studios/')[0]):route.continue_()
            else: external.append(route.request.url[:160]);route.abort()
        page.route('**/*',allow)
        page.goto(url,wait_until='networkidle')
        def layout():
            eq(page.title(),'TIEN404 V16.3 — QA Preview | No Send')
            eq(page.locator('button[data-tab]').count(),5)
            dim=page.evaluate('({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth})')
            ok(dim['doc']<=dim['width']+2,'horizontal overflow '+str(dim))
            ok(page.locator('#panel-faq').is_visible(),'FAQ initial panel hidden')
            return 'viewport '+str(width)+' no overflow'
        case('RWD_'+str(width),layout)
        if width in (390,1280):page.screenshot(path=str(ART/f'preview-{width}.png'),full_page=True)
        page.close()

    page=browser.new_page(viewport={'width':390,'height':844})
    page.on('pageerror',lambda exc:errors.append('pageerror: '+str(exc)[:400]))
    page.on('console',lambda msg:errors.append('console: '+msg.text[:400]) if msg.type=='error' else None)
    page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(url.split('/v163-studios/')[0]) else (external.append(route.request.url[:160]),route.abort()))
    page.goto(url,wait_until='networkidle')
    case('TABS_5',lambda:[(click_tab(page,k),eq(page.locator('.panel.active').count(),1)) for k in ['faq','cost','queue','handoff','lab']])
    def faq_a():
        click_tab(page,'faq')
        page.locator('#store').select_option('QA_STORE_A')
        page.locator('#faq-key').select_option('GREETING')
        eq(page.locator('#faq-val option').count(),1)
        eq(page.locator('#faq-val').input_value(),'Xin chao tu Shop QA A')
        button(page,'faq-draft');eq(result(page,'faq')['status'],'DRAFT_QA')
        button(page,'faq-preview');eq(result(page,'faq')['reply'],None)
        button(page,'faq-review');eq(result(page,'faq')['status'],'QA_REVIEWED')
        button(page,'faq-preview');eq(result(page,'faq')['reply'],'Xin chao tu Shop QA A')
        button(page,'faq-history');eq([x['status'] for x in result(page,'faq')],['DRAFT_QA','QA_REVIEWED'])
    case('FAQ_A_DRAFT_REVIEW_TTL_VERSION',faq_a)
    def switch_shop():
        page.locator('#store').select_option('QA_STORE_B')
        for k in ['faq','cost','queue','handoff','lab']:
            ok('QA_STORE_B' in page.locator('#'+k+'-result').inner_text(),'stale '+k+' result after switch')
        eq(page.locator('#faq-val').input_value(),'Xin chao tu Shop QA B')
        button(page,'faq-preview');eq(result(page,'faq')['status'],'NO_VERIFIED_FAQ')
        button(page,'faq-draft');eq(result(page,'faq')['version'],1)
        button(page,'faq-review')
        button(page,'faq-preview');eq(result(page,'faq')['reply'],'Xin chao tu Shop QA B')
        page.locator('#store').select_option('QA_STORE_A')
        button(page,'faq-preview');eq(result(page,'faq')['reply'],'Xin chao tu Shop QA A')
        page.locator('#store').select_option('QA_STORE_C')
        eq(page.locator('#faq-val').input_value(),'Xin chao tu Shop QA C')
        button(page,'faq-preview');eq(result(page,'faq')['status'],'NO_VERIFIED_FAQ')
    case('FAQ_STORE_A_B_C_NO_STALE_DATA',switch_shop)
    def cost():
        click_tab(page,'cost')
        page.locator('#store').select_option('QA_STORE_A')
        button(page,'cost-configure');eq(result(page,'cost')['status'],'QA_BUDGET_CONFIGURED')
        button(page,'cost-reserve');eq(result(page,'cost')['ledger']['estimated_spent_micro_usd'],350)
        button(page,'cost-reserve');eq(result(page,'cost')['ledger']['estimated_spent_micro_usd'],700)
        ok(70 in result(page,'cost')['ledger']['warning_levels'],'missing 70 warning')
        button(page,'cost-reserve');eq(result(page,'cost')['reservation']['status'],'HARD_CAP_BLOCKED_SYNTHETIC')
        eq(result(page,'cost')['ledger']['estimated_spent_micro_usd'],700)
        page.locator('#store').select_option('QA_STORE_B')
        ok('QA_STORE_B' in page.locator('#cost-result').inner_text(),'stale A cost ledger')
        button(page,'cost-configure')
        eq(result(page,'cost')['status'],'QA_BUDGET_CONFIGURED')
        button(page,'cost-reserve')
        eq(result(page,'cost')['ledger']['estimated_spent_micro_usd'],350)
    case('COST_QUOTA_ALERTS_NO_CROSS_STORE',cost)
    def queue():
        click_tab(page,'queue')
        page.locator('#store').select_option('QA_STORE_C')
        button(page,'queue-preview')
        out=result(page,'queue')
        eq(out['pending_total'],3)
        eq(out['store_scope'],'QA_STORE_C')
        eq(out['tenant_scope'],'QA_TENANT_TWO')
        eq(out['actual_queue_depth'],None)
        page.locator('#store').select_option('QA_STORE_A')
        ok('QA_STORE_A' in page.locator('#queue-result').inner_text(),'stale C queue visible')
        button(page,'queue-preview')
        eq(result(page,'queue')['tenant_scope'],'QA_TENANT_ONE')
    case('QUEUE_3_LANES_TENANT_ISOLATION',queue)
    def handoff():
        click_tab(page,'handoff')
        page.locator('#store').select_option('QA_STORE_A')
        button(page,'handoff-open');eq(result(page,'handoff')['status'],'QA_OPEN')
        button(page,'handoff-assign');eq(result(page,'handoff')['status'],'QA_ASSIGNED')
        button(page,'handoff-close');eq(result(page,'handoff')['status'],'RESOLVED_QA')
        eq(result(page,'handoff')['customer_notified'],False)
        page.locator('#store').select_option('QA_STORE_B')
        ok('QA_STORE_B' in page.locator('#handoff-result').inner_text(),'stale A ticket')
        button(page,'handoff-assign')
        ok('HANDOFF_CASE_NOT_IN_SHOP' in page.locator('#notice').inner_text(),'cross-store assignment not denied')
    case('HANDOFF_ASSIGN_RESOLVE_NO_SEND',handoff)
    def ab():
        click_tab(page,'lab')
        button(page,'lab-preview')
        z=result(page,'lab');eq(z['case_count'],132);eq(z['planned_evaluations'],396)
        eq(z['scorecard']['NOT_RUN'],396);eq(z['scorecard']['certified_pass'],0)
        eq(z['actual_api_calls'],0)
        eq(z['manifest_stats']['total_turns_in_multi_pack'],71)
        eq(z['manifest_stats']['multi_pack_one_turn'],9)
    case('AB_132_71_TURNS_396_NOT_RUN',ab)
    def reload_clean():
        page.reload(wait_until='networkidle')
        eq(page.locator('#faq-result').inner_text(),'Chưa thực hiện')
        eq(page.locator('#cost-result').inner_text(),'Chưa cấu hình')
    case('EPHEMERAL_RELOAD_NO_PERSISTENCE',reload_clean)
    def ui_labels():
        for x in ['store','faq-key','faq-val']:
            eq(page.locator('label[for="'+x+'"]').count(),1)
        eq(page.locator('html').get_attribute('lang'),'vi')
        eq(page.locator('meta[name=robots]').get_attribute('content'),'noindex,nofollow')
    case('A11Y_LABELS_LANG_ROBOTS_SMOKE',ui_labels)
    page.screenshot(path=str(ART/'interactions-390.png'),full_page=True)
    page.close()

def main():
    handler=functools.partial(QuietHandler,directory=str(ROOT))
    server=ThreadingHTTPServer(('127.0.0.1',0),handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/{QA_HTML}'
    browser_path=next((p for p in [shutil.which('google-chrome'),shutil.which('chromium'),shutil.which('chromium-browser')] if p),None)
    if not browser_path:raise RuntimeError('REAL_CHROMIUM_NOT_INSTALLED: cannot claim full-browser PASS')
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=browser_path,headless=True,
                args=['--no-sandbox','--disable-dev-shm-usage'])
            try:browser_qa(browser,url)
            finally:browser.close()
    finally:server.shutdown()
    ok_errors=(len(errors)==0 and len(external)==0)
    checks.append({'case':'NO_CONSOLE_ERRORS_OR_EXTERNAL_REQUESTS','result':'PASS' if ok_errors else 'FAIL',
       'detail':f'errors={len(errors)}, external={len(external)}'})
    output={'contract':'T404_V163B_REAL_CHROMIUM_BROWSER_QA_V1','source':'CHECKED_OUT_REPOSITORY_LOCALHOST',
       'browser_executable':browser_path,'viewport_count':6,'total':len(checks),
       'passed':sum(x['result']=='PASS' for x in checks),'failed':sum(x['result']=='FAIL' for x in checks),
       'checks':checks,'console_errors':errors[:20],'external_requests_blocked':external[:20],
       'actual_provider_send':False,'actual_model_api_calls':0,'production_certified':False}
    (ART/'browser-results.json').write_text(json.dumps(output,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'total':output['total'],'passed':output['passed'],'failed':output['failed'],
        'failed_checks':[x for x in checks if x['result']=='FAIL'],'screenshots':len(list(ART.glob('*.png')))},ensure_ascii=False))
    return 0 if output['failed']==0 else 1

if __name__=='__main__':raise SystemExit(main())

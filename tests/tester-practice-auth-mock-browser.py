"""Browser tester flow with locally stubbed Supabase client.
No real Auth tokens, no internet, no Supabase DB writes or bot invocation.
The real public portal JavaScript runs against a synthetic approved tester RLS-shaped dataset.
"""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent/'auth-preview-dist'
STUB=r"""
const uid='22222222-2222-4222-8222-222222222222';
const results=[];
const tables={
 tien404_tester_access:[{user_id:uid,access_status:'approved',expires_at:'2027-01-01T00:00:00Z'}],
 tien404_tester_staff:[],
 tien404_tester_assignments:[{user_id:uid,module_id:'sheets',active:true}],
 tien404_tester_modules:[{module_id:'sheets',title:'Dữ liệu mẫu (Sheets)',summary:'Dữ liệu mô phỏng riêng',channel:'sheets',readiness:'ready',setup_note:'Mẫu, không phải hàng thật',sort_order:1}],
 tien404_tester_cases:[{case_id:'SHEET-SIM-002',module_id:'sheets',title:'Báo giá đúng cho 2 áo trắng',instructions:'Thử SKU QA-DEMO-01, số lượng 2',sample_prompt:'SKU QA-DEMO-01, số lượng 2',expected_result:'Tổng 318.000đ (mẫu)',readiness:'ready',sort_order:1}],
 tien404_tester_runs:results
};
class Query{
 constructor(name){this.name=name;this.eqFilters=[];this.inFilters=[];this.action='select';this.insertPayload=null;this.max=null;}
 select(){return this}
 eq(k,v){this.eqFilters.push([k,v]);return this}
 in(k,v){this.inFilters.push([k,v]);return this}
 order(k,{ascending=false}={}){this.sortField=k;this.asc=ascending;return this}
 limit(v){this.max=v;return this}
 insert(p){this.action='insert';this.insertPayload=p;return this}
 getData(){
  if(this.action==='insert'){
   if(this.name==='tien404_tester_runs')results.unshift({...this.insertPayload,run_id:'test-run-local',created_at:new Date().toISOString()});
   return {data:null,error:null};
  }
  let data=[...(tables[this.name]||[])];
  for(const [k,v] of this.eqFilters)data=data.filter(x=>x[k]===v);
  for(const [k,arr] of this.inFilters)data=data.filter(x=>arr.includes(x[k]));
  if(this.sortField)data.sort((a,b)=>this.asc?String(a[this.sortField]).localeCompare(String(b[this.sortField])):String(b[this.sortField]).localeCompare(String(a[this.sortField])));
  if(this.max!==null)data=data.slice(0,this.max);
  return {data,error:null};
 }
 maybeSingle(){const result=this.getData();return Promise.resolve({data:result.data[0]||null,error:null});}
 then(resolve,reject){return Promise.resolve(this.getData()).then(resolve,reject)}
}
export async function getAuthClient(){
 return {
  auth:{getUser:async()=>({data:{user:{id:uid,email:'qa@example.test',email_confirmed_at:'2026-11-14T00:00:00Z'}},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  from:(name)=>new Query(name)
 };
}
"""
def run():
    assert ROOT.exists(),'Build preview first'
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_address[1]}'
    try:
      with sync_playwright() as p:
       browser=p.chromium.launch(headless=True)
       try:
        page=browser.new_page(viewport={'width':390,'height':844})
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(origin+'/') else route.abort())
        page.route('**/assets/auth-client.js',lambda route:route.fulfill(status=200,content_type='application/javascript',body=STUB))
        page.goto(origin+'/tester.html',wait_until='domcontentloaded')
        page.locator('#tp-workspace').wait_for(state='visible',timeout=12000)
        assert page.locator('#tp-total').inner_text()=='1'
        page.locator('button[data-page="practice"]').click()
        page.locator('#tp-sim-sku').select_option('QA-DEMO-01')
        page.locator('#tp-sim-qty').fill('2')
        page.locator('button',has_text='Kiểm tra dữ liệu mẫu').click()
        assert '318.000đ' in page.locator('#tp-sim-result').inner_text()
        page.locator('#tp-sim-qty').fill('26')
        page.locator('button',has_text='Kiểm tra dữ liệu mẫu').click()
        assert 'out_of_stock' in page.locator('#tp-sim-result').inner_text()
        page.locator('button[data-page="modules"]').click()
        page.locator('button',has_text='Xem 1 bài thử').click()
        page.locator('button',has_text='Bắt đầu bài này').click()
        page.locator('button',has_text='Lưu kết quả tự đánh giá').click()
        page.locator('#tp-done').wait_for(state='attached')
        page.wait_for_function("document.querySelector('#tp-done')?.textContent==='1'",timeout=10000)
        assert not errors,errors
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
        page.close()
        print('PASS: approved tester local Auth stub -> Sheets practice -> price/stock -> self-report state; no external requests')
       finally:browser.close()
    finally:
     server.shutdown();server.server_close()
if __name__=='__main__':run()

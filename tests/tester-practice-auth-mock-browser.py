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
const callbacks=[];
window.__qaUserReads=0;
window.__qaEmitAuth=(event,session)=>callbacks.forEach(cb=>cb(event,session));
window.__qaRevokeTester=()=>{tables.tien404_tester_access[0].access_status='revoked'};

const tables={
 tien404_tester_access:[{user_id:uid,access_status:'approved',expires_at:'2027-01-01T00:00:00Z'}],
 tien404_tester_staff:[],
 tien404_tester_assignments:[{user_id:uid,module_id:'sheets',active:true}],
 tien404_tester_modules:[{module_id:'sheets',title:'Dữ liệu mẫu (Sheets)',summary:'Dữ liệu mô phỏng riêng',channel:'sheets',readiness:'ready',setup_note:'Mẫu, không phải hàng thật',sort_order:1}],
 tien404_tester_cases:[
 {case_id:'SHEET-SIM-002',module_id:'sheets',title:'Báo giá đúng cho 2 áo trắng',instructions:'Thử SKU QA-DEMO-01, số lượng 2',sample_prompt:'SKU QA-DEMO-01, số lượng 2',expected_result:'Tổng 318.000đ (mẫu)',readiness:'ready',sort_order:1},
 {case_id:'SHEET-SIM-004',module_id:'sheets',title:'Chặn vượt tồn',instructions:'Thử SKU QA-DEMO-01, số lượng 26',sample_prompt:'SKU QA-DEMO-01, số lượng 26',expected_result:'out_of_stock',readiness:'ready',sort_order:2},
 {case_id:'SHEET-SIM-009',module_id:'sheets',title:'Từ chối trả giá',instructions:'Thử SKU QA-DEMO-01, số lượng 2, giá 100000',sample_prompt:'SKU QA-DEMO-01, số lượng 2',expected_result:'price_mismatch',readiness:'ready',sort_order:3},
 {case_id:'SHEET-SIM-003',module_id:'sheets',title:'Mua đúng tồn',instructions:'Dữ liệu mẫu',expected_result:'ok',readiness:'ready',sort_order:4},
 {case_id:'SHEET-SIM-005',module_id:'sheets',title:'SKU sai',instructions:'Dữ liệu mẫu',expected_result:'not_found',readiness:'ready',sort_order:5},
 {case_id:'SHEET-SIM-006',module_id:'sheets',title:'Số lượng 0',instructions:'Dữ liệu mẫu',expected_result:'invalid_quantity',readiness:'ready',sort_order:6},
 {case_id:'SHEET-SIM-010',module_id:'sheets',title:'Đúng giá VND',instructions:'Dữ liệu mẫu',expected_result:'ok',readiness:'ready',sort_order:7},
 {case_id:'SHEET-SIM-011',module_id:'sheets',title:'VND sai',instructions:'Dữ liệu mẫu',expected_result:'invalid_price',readiness:'ready',sort_order:8},
 {case_id:'SHEET-AI-REVIEW-001',module_id:'sheets',title:'Báo cáo AI độc lập',instructions:'Tự đánh giá kết quả mẫu',expected_result:'self reported',readiness:'ready',sort_order:9}
],
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
   if(this.name==='tien404_tester_runs'){
     const inserted={...this.insertPayload,run_id:'test-run-local-'+(results.length+1),created_at:new Date().toISOString()};
     results.unshift(inserted);
     return {data:inserted,error:null};
   }
   return {data:null,error:null};
  }
  let data=[...(tables[this.name]||[])];
  for(const [k,v] of this.eqFilters)data=data.filter(x=>x[k]===v);
  for(const [k,arr] of this.inFilters)data=data.filter(x=>arr.includes(x[k]));
  if(this.sortField)data.sort((a,b)=>this.asc?String(a[this.sortField]).localeCompare(String(b[this.sortField])):String(b[this.sortField]).localeCompare(String(a[this.sortField])));
  if(this.max!==null)data=data.slice(0,this.max);
  return {data,error:null};
 }
 maybeSingle(){const result=this.getData();return Promise.resolve({data:result.data?.[0]||result.data||null,error:null});}
 single(){const result=this.getData();return Promise.resolve({data:result.data?.[0]||result.data||null,error:null});}
 then(resolve,reject){return Promise.resolve(this.getData()).then(resolve,reject)}
}
export async function getAuthClient(){
 return {
  auth:{getUser:async()=>{window.__qaUserReads++;return {data:{user:{id:uid,email:'qa@example.test',email_confirmed_at:'2026-11-14T00:00:00Z'}},error:null}},
  onAuthStateChange:(cb)=>{callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}}}},
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
        assert 'Một trợ lý bán hàng' in page.locator('.tp-intro h2').inner_text()
        assert 'chưa phải trò chuyện với AI thật' in page.locator('.tp-hero-hint').inner_text()
        assert page.locator('button[data-page="practice"]').is_hidden()  # Advanced menu is closed.
        assert page.locator('#tp-more').evaluate('(el)=>el.open') is False
        assert page.locator('#tp-total').text_content()=='9'
        assert page.locator('.tp-quick-choice').count()==3

        assert page.locator('#tp-ai-studio').is_visible()
        assert page.locator('#tp-ai-submit').is_disabled()
        # Previous quick test mode remains optional and collapsible.
        page.locator('#tp-quick-details summary').click()
        # Friend-first default: tap a situation, see result, tap one quick feedback.
        page.get_by_role('button',name='Mua 2 áo trắng').click()
        assert '318.000đ' in page.locator('#tp-quick-response').inner_text()
        page.get_by_role('button',name='👍 Dễ hiểu').click()
        page.locator('#tp-quick-saved').wait_for(state='visible',timeout=10000)
        assert 'Đã nhận góp ý!' in page.locator('#tp-quick-saved').inner_text()
        page.wait_for_function("document.querySelector('#tp-done')?.textContent==='1'",timeout=10000)

        # Friend reports a problem using a short note; no AI inference/network.
        page.get_by_role('button',name='Mua nhiều hơn tồn').click()
        assert 'out_of_stock' in page.locator('#tp-quick-response').get_attribute('data-result')
        page.get_by_role('button',name='💬 Cần cải thiện').click()
        page.locator('.tp-note-box textarea').fill('Câu trả lời còn hơi khó hiểu.')

        # SDK token refresh and routine tab switch MUST preserve unsent feedback.
        initial_reads=page.evaluate('window.__qaUserReads')
        page.evaluate("""() => {
          window.__qaEmitAuth('TOKEN_REFRESHED',{user:{id:'22222222-2222-4222-8222-222222222222'}});
          Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
          document.dispatchEvent(new Event('visibilitychange'));
        }""")
        page.wait_for_timeout(220)
        assert page.evaluate('window.__qaUserReads')==initial_reads
        assert page.locator('.tp-note-box textarea').input_value()=='Câu trả lời còn hơi khó hiểu.'
        assert page.locator('#tp-quick-review').is_visible()

        page.get_by_role('button',name='Gửi góp ý').click()
        page.locator('#tp-quick-saved').wait_for(state='visible',timeout=10000)
        assert 'Đã nhận góp ý!' in page.locator('#tp-quick-saved').inner_text()
        page.wait_for_function("document.querySelector('#tp-done')?.textContent==='2'",timeout=10000)

        page.get_by_role('button',name='Trả giá thấp hơn').click()
        assert page.locator('#tp-quick-response').get_attribute('data-result')=='price_mismatch'
        page.get_by_role('button',name='Không thử được').click()
        page.locator('#tp-quick-saved').wait_for(state='visible',timeout=10000)
        assert 'Đã nhận góp ý!' in page.locator('#tp-quick-saved').inner_text()
        page.wait_for_function("document.querySelector('#tp-done')?.textContent==='3'",timeout=10000)

        # New expert path: run 8 synthetic checks, preview prompt, human-review, save to RLS-shaped mock.
        page.locator('#tp-ai-run').click()
        assert '8 bài' in page.locator('#tp-ai-run-status').inner_text()
        assert page.locator('.tp-ai-result').count()==8
        assert page.locator('#tp-ai-copy').is_enabled()
        page.get_by_role('button',name='Xem nội dung gửi AI').click()
        assert 'CHƯA XÁC MINH' in page.locator('#tp-ai-prompt').input_value()
        page.evaluate("""() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
          writeText:async(value)=>{window.__qaCopiedPrompt=value}
        }})""")
        page.locator('#tp-ai-copy').click()
        page.wait_for_function("window.__qaCopiedPrompt?.includes('CHƯA XÁC MINH')",timeout=8000)
        assert 'Đã sao chép' in page.locator('#tp-ai-copy-status').inner_text()
        page.locator('#tp-ai-notes').fill('Bearer abcdefghijklmnopsecret')
        page.locator('#tp-ai-attest').check()
        page.locator('#tp-ai-submit').click()
        assert 'thông tin nhạy cảm' in page.locator('#tp-ai-submit-status').inner_text()
        assert page.locator('#tp-done').inner_text()=='3'
        page.locator('#tp-ai-notes').fill('Tôi đề xuất thêm kiểm tra lượng tồn vượt 1 tỷ; chưa thử trên bot AI thật.')
        page.locator('#tp-ai-severity').select_option('P1')
        page.locator('#tp-ai-verdict').select_option('needs_review')
        page.locator('#tp-ai-attest').check()
        page.locator('#tp-ai-submit').click()
        page.wait_for_function("document.querySelector('#tp-ai-submit-status')?.textContent.includes('Đã lưu báo cáo')",timeout=12000)
        page.wait_for_function("document.querySelector('#tp-done')?.textContent==='4'",timeout=12000)

        # Legacy advanced QA and freeform practice must remain usable.
        page.locator('#tp-more summary').click()
        assert page.locator('button[data-page="practice"]').is_visible()
        page.locator('button[data-page="practice"]').click()
        page.locator('#tp-sim-sku').select_option('QA-DEMO-01')
        page.locator('#tp-sim-qty').fill('2')
        page.locator('button',has_text='Kiểm tra dữ liệu mẫu').click()
        assert '318.000đ' in page.locator('#tp-sim-result').inner_text()
        page.locator('#tp-sim-qty').fill('26')
        page.locator('button',has_text='Kiểm tra dữ liệu mẫu').click()
        assert 'out_of_stock' in page.locator('#tp-sim-result').inner_text()
        page.locator('button[data-page="modules"]').click()
        page.locator('button',has_text='Xem 9 bài thử').click()
        page.locator('button',has_text='Bắt đầu bài này').first.click()
        page.locator('button',has_text='Lưu kết quả tự đánh giá').click()
        assert not errors,errors
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')

        # After a long absence the server authorization is re-read.
        # A revoked grant closes the portal instead of retaining stale protected content.
        page.evaluate("""() => {
          window.__qaRevokeTester();
          const now=Date.now.bind(Date);
          Date.now=()=>now()+301000;
          document.dispatchEvent(new Event('visibilitychange'));
        }""")
        page.locator('#tp-locked').wait_for(state='visible',timeout=10000)
        assert page.locator('#tp-workspace').is_hidden()
        assert not errors,errors
        page.close()
        print('PASS: friend-first tester -> 3 scenario reports -> advanced existing practice; zero external requests')
       finally:browser.close()
    finally:
     server.shutdown();server.server_close()
if __name__=='__main__':run()

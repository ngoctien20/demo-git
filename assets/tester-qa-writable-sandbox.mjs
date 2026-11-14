/* TIEN404 V12.4 — REAL Supabase QA sandbox CRUD. NEVER real Commerce or DEMO Orders.
 * All writes are isolated per logged-in approved Tester by Supabase RLS.
 * No model or n8n workflow is invoked here; QA model gateway remains a separate release gate.
 */
import {withDeadline} from './auth-runtime.mjs';
import {QA_PRODUCTS_SNAPSHOT} from './tester-qa-products-snapshot.mjs';
import {QA_RANDOM_CASES,drawQaCase} from './tester-random-qa-cases.mjs';
const PRODUCTS='tien404_qa_sandbox_products';
const ORDERS='tien404_qa_sandbox_orders';
function e(tag,text,cls){
 const n=document.createElement(tag);
 if(text!==undefined&&text!==null)n.textContent=String(text);
 if(cls)n.className=cls;return n;
}
function button(parent,label,fn,cls='tp-secondary'){
 const n=e('button',label,cls);n.type='button';n.addEventListener('click',fn);parent.append(n);return n;
}
function label(parent,title,element){
 const n=e('label',title,'tp-field');n.append(element);parent.append(n);return element;
}
function input(type,placeholder=''){
 const n=e('input',null,'tp-input');n.type=type;n.placeholder=placeholder;n.autocomplete='off';return n;
}
function select(){return e('select',null,'tp-select')}
function opt(parent,value,text){const n=e('option',text);n.value=value;parent.append(n);}
const vnd=n=>new Intl.NumberFormat('vi-VN').format(Number(n||0))+'đ';
function numeric(s,low,high){const v=String(s||'').trim();if(!/^\d+$/.test(v))return null;const n=Number(v);return Number.isSafeInteger(n)&&n>=low&&n<=high?n:null}
function safeText(s,max=140){const v=String(s||'').trim();if(v.length<2||v.length>max||/[\u0000-\u001f]/.test(v)||/(?:Bearer\s+\S+|sk-[A-Za-z0-9_-]{15,}|sb_secret_)/i.test(v))return null;return v}
export function mountQaSandbox(root,{state,onSaved=()=>{}}){
 if(!(state.access?.access_status==='approved'&&Date.parse(state.access.expires_at)>Date.now()&&
     state.modules.some(x=>x.module_id==='sheets')))return;
 const box=e('section',null,'tp-card tp-qa-write');box.id='tp-qa-write';
 box.append(e('p','V12.4 · DỮ LIỆU QA RIÊNG · CHỈ TRÊN STAGING','tp-overline'),
  e('h2','Thử tạo/sửa dữ liệu và nhận câu hỏi ngẫu nhiên'),
  e('p','Mỗi tài khoản có sản phẩm và đơn QA riêng. Không ghi vào Google Sheets DEMO gốc, không gửi tin và chưa chạy chatbot thật.','tp-ai-description'));
 const status=e('p','Đang kiểm tra quyền và tải kho QA…','tp-ai-message');status.id='tp-qa-write-status';status.setAttribute('role','status');
 const productBox=e('section',null,'tp-qa-write-section');
 productBox.append(e('h3','Sản phẩm QA (giá / tồn)'),e('p','Giá và tồn ban đầu lấy từ bản sao Google Sheets QA, sau đó bạn có thể tự chỉnh sửa để thử nghiệm.','tp-quiet'));
 const productsLine=e('p','Chưa tải dữ liệu.','tp-quiet');productsLine.id='tp-qa-product-count';
 const productChoices=select();productChoices.id='tp-qa-product-select';
 const pName=input('text','Tên sản phẩm QA');pName.maxLength=140;
 const pPrice=input('text','Giá VND (ví dụ 159000)');pPrice.inputMode='numeric';
 const pStock=input('text','Tồn kho QA');pStock.inputMode='numeric';
 const productForm=e('div',null,'tp-ai-fields');
 label(productForm,'Tên sản phẩm',pName);label(productForm,'Giá bán (VND)',pPrice);label(productForm,'Tồn kho',pStock);
 const productBtns=e('div',null,'tp-actions');
 const seedBtn=button(productBtns,'Nạp 21 sản phẩm mẫu',seed,'tp-primary');
 const saveBtn=button(productBtns,'Lưu sửa sản phẩm',saveProduct);
 const newProduct=e('details',null,'tp-qa-add-product');newProduct.append(e('summary','+ Tạo sản phẩm QA mới'));
 const createFields=e('div',null,'tp-ai-fields');
 const newSku=input('text','QA-NEW-001');newSku.maxLength=24;
 const newName=input('text','Tên sản phẩm giả lập');newName.maxLength=140;
 const newPrice=input('text','159000');newPrice.inputMode='numeric';
 const newStock=input('text','12');newStock.inputMode='numeric';
 label(createFields,'Mã sản phẩm QA',newSku);label(createFields,'Tên sản phẩm QA',newName);
 label(createFields,'Giá (VND)',newPrice);label(createFields,'Tồn kho',newStock);
 newProduct.append(createFields);
 button(newProduct,'Tạo sản phẩm QA',createProduct,'tp-primary');
 productBox.append(productsLine,label(e('div',null,'tp-qa-selector'),'Chọn sản phẩm',productChoices),productForm,productBtns,newProduct);

 const orderBox=e('section',null,'tp-qa-write-section');
 orderBox.append(e('h3','Tạo/sửa đơn QA'),e('p','Đơn hàng chỉ tồn tại trong workspace QA. Server kiểm tra giá, tồn kho và số lượng đã giữ khi tạo/sửa.','tp-quiet'));
 const orderChoices=select();orderChoices.id='tp-qa-order-sku';
 const orderQty=input('text','1');orderQty.inputMode='numeric';orderQty.value='1';
 const orderCreation=e('div',null,'tp-ai-fields');
 label(orderCreation,'Sản phẩm',orderChoices);label(orderCreation,'Số lượng',orderQty);
 const createOrder=button(orderBox,'Tạo đơn QA',submitOrder,'tp-primary');createOrder.id='tp-qa-order-create';
 const orderList=e('div',null,'tp-qa-order-list');orderList.id='tp-qa-orders';
 orderBox.append(orderCreation,createOrder,orderList);

 const randomBox=e('section',null,'tp-qa-write-section');
 randomBox.append(e('h3','Câu hỏi ngẫu nhiên cho AI SALES'),e('p','96 tình huống từ bộ QA hiện có. Bạn có thể lấy ngẫu nhiên và sao chép để thử với model QA khi gateway an toàn được mở.','tp-quiet'));
 const categories=select();categories.id='tp-qa-random-mode';
 for(const [key,text] of [['all','Tất cả 96 câu'],['catalog','Sản phẩm / giá / tồn'],['consult','Tư vấn'],['language','Ngôn ngữ tự nhiên'],['create','Tạo đơn'],['edit','Sửa đơn'],['security','Bảo mật'],['policy','Chính sách / tình huống']])opt(categories,key,text);
 const prompt=e('p','Bấm Lấy câu hỏi ngẫu nhiên để bắt đầu.','tp-qa-random-prompt');prompt.id='tp-qa-random-prompt';
 const expected=e('p','', 'tp-quiet');expected.id='tp-qa-random-expected';
 const randomButtons=e('div',null,'tp-actions');
 button(randomButtons,'Lấy câu hỏi ngẫu nhiên',draw,'tp-primary').id='tp-qa-random-draw';
 const copyBtn=button(randomButtons,'Sao chép câu hỏi',copy);copyBtn.disabled=true;
 const copyStatus=e('p','', 'tp-quiet');copyStatus.setAttribute('role','status');
 randomBox.append(label(e('div',null,'tp-qa-selector'),'Nhóm câu hỏi',categories),prompt,expected,randomButtons,copyStatus,
  e('p','Lưu ý: câu hỏi kiểm thử có thể yêu cầu tạo/sửa đơn, nhưng nút này KHÔNG tự gọi n8n, không cấp quyền cho AI vào đơn thật.','tp-ai-warning'));
 box.append(productBox,orderBox,randomBox,status);root.append(box);

 let products=[],orders=[],picked=null,busy=false;
 const alive=()=>state.access?.access_status==='approved'&&Date.parse(state.access.expires_at)>Date.now()&&state.modules.some(m=>m.module_id==='sheets');
 async function verified(){
  if(!alive())throw Error('QA_ACCESS_EXPIRED');
  const auth=await withDeadline(state.client.auth.getUser(),12000);
  if(auth.error||auth.data?.user?.id!==state.user?.id)throw Error('QA_IDENTITY_CHANGED');
  return state.user.id;
 }
 function show(message,ok=false){status.textContent=message;status.dataset.tone=ok?'ok':'error'}
 async function perform(fn){
  if(busy||state.busy)return;busy=true;seedBtn.disabled=true;saveBtn.disabled=true;createOrder.disabled=true;
  try{await verified();await fn();show('Thao tác QA đã được xác minh qua Supabase. Không ảnh hưởng dữ liệu gốc.',true);}
  catch(err){show('Chưa ghi được dữ liệu QA: '+(String(err?.message||'').match(/QA_[A-Z_]+/)?.[0]||'quyền, giá hoặc tồn không hợp lệ')+'. Hãy kiểm tra lại và thử tiếp.');}
  finally{busy=false;seedBtn.disabled=false;saveBtn.disabled=false;createOrder.disabled=false}
 }
 async function load(){
  if(!alive()){show('Quyền Tester đã hết hạn. Không mở dữ liệu QA.');return}
  const uid=await verified();
  const [pr,or]=await Promise.all([
   withDeadline(state.client.from(PRODUCTS).select('sku,name,unit_price,stock').eq('owner_id',uid).order('sku'),13000),
   withDeadline(state.client.from(ORDERS).select('id,sku,quantity,unit_price,total,status,created_at').eq('owner_id',uid).order('created_at',{ascending:false}).limit(100),13000)
  ]);
  if(pr.error||or.error)throw Error('QA_READBACK_ERROR');
  products=Array.isArray(pr.data)?pr.data:[];orders=Array.isArray(or.data)?or.data:[];
  renderProducts();renderOrders();
 }
 function renderProducts(){
  const current=productChoices.value;
  productChoices.replaceChildren();orderChoices.replaceChildren();
  for(const p of products){opt(productChoices,p.sku,p.sku+' — '+p.name);opt(orderChoices,p.sku,p.sku+' · '+vnd(p.unit_price))}
  if(products.some(p=>p.sku===current))productChoices.value=current;
  productsLine.textContent=products.length+' sản phẩm QA của tài khoản này. Nạp mẫu không ghi đè các chỉnh sửa đã có.';
  updateProductForm();
 }
 function updateProductForm(){
  const p=products.find(x=>x.sku===productChoices.value);
  pName.value=p?.name||'';pPrice.value=p?String(p.unit_price):'';pStock.value=p?String(p.stock):'';
 }
 productChoices.addEventListener('change',updateProductForm);
 function renderOrders(){
  orderList.replaceChildren();
  const head=e('p',orders.length+' đơn QA. Chọn trạng thái hoặc sửa số lượng, hệ thống sẽ kiểm tra tồn còn lại.','tp-quiet');orderList.append(head);
  for(const ord of orders.slice(0,30)){
   const row=e('div',null,'tp-qa-order-card');
   row.append(e('strong',ord.sku+' · '+vnd(ord.total)+' · '+ord.status));
   const inputs=e('div',null,'tp-ai-fields');
   const qty=input('text');qty.value=String(ord.quantity);qty.inputMode='numeric';
   const st=select();for(const k of ['pending','confirmed','cancelled'])opt(st,k,k==='pending'?'Chờ xử lý':k==='confirmed'?'Đã xác nhận (QA)':'Đã hủy (QA)');
   st.value=ord.status;
   label(inputs,'Số lượng',qty);label(inputs,'Trạng thái',st);row.append(inputs);
   button(row,'Lưu sửa đơn QA',()=>perform(async()=>{
    const value=numeric(qty.value,1,1000);if(value===null)throw Error('QA_INVALID_QTY');
    const p=products.find(x=>x.sku===ord.sku);if(!p)throw Error('QA_SKU_NOT_FOUND');
    const uid=await verified();
    const wr=await withDeadline(state.client.from(ORDERS).update({quantity:value,unit_price:p.unit_price,status:st.value})
       .eq('id',ord.id).eq('owner_id',uid).select('id'),14000);
    if(wr.error||wr.data?.length!==1)throw Error('QA_UPDATE_FAILED');
    await load();
   }));
   orderList.append(row);
  }
 }
 async function seed(){await perform(async()=>{
   const uid=await verified();
   const payload=QA_PRODUCTS_SNAPSHOT.map(p=>({sku:p.sku,name:p.name,unit_price:p.unit_price,stock:p.stock}));
   const wr=await withDeadline(state.client.from(PRODUCTS).upsert(payload,{onConflict:'owner_id,sku',ignoreDuplicates:true}),20000);
   if(wr.error)throw Error('QA_SEED_DENIED');
   await load();
   if(products.length===0)throw Error('QA_SEED_READBACK_FAILED');
 });}
 async function createProduct(){await perform(async()=>{
  const sku=String(newSku.value||'').trim().toUpperCase(),name=safeText(newName.value);
  const price=numeric(newPrice.value,0,1000000000),stock=numeric(newStock.value,0,1000000);
  if(!/^[A-Z0-9_-]{2,24}$/.test(sku)||!name||price===null||stock===null)throw Error('QA_INVALID_PRODUCT');
  const wr=await withDeadline(state.client.from(PRODUCTS).insert({sku,name,unit_price:price,stock}).select('sku').single(),14000);
  if(wr.error||wr.data?.sku!==sku)throw Error('QA_CREATE_PRODUCT_FAILED');
  await load();newProduct.open=false;
 });}
 async function saveProduct(){await perform(async()=>{
  const sku=productChoices.value,name=safeText(pName.value),price=numeric(pPrice.value,0,1000000000),stock=numeric(pStock.value,0,1000000);
  if(!sku||!name||price===null||stock===null)throw Error('QA_INVALID_PRODUCT');
  const uid=await verified();
  const wr=await withDeadline(state.client.from(PRODUCTS).update({name,unit_price:price,stock})
   .eq('owner_id',uid).eq('sku',sku).select('sku,unit_price,stock').single(),14000);
  if(wr.error||wr.data?.sku!==sku)throw Error('QA_UPDATE_PRODUCT_FAILED');
  await load();
 });}
 async function submitOrder(){await perform(async()=>{
  const sku=orderChoices.value,qty=numeric(orderQty.value,1,1000);
  const p=products.find(x=>x.sku===sku);if(!p||qty===null)throw Error('QA_INVALID_ORDER');
  const wr=await withDeadline(state.client.from(ORDERS).insert({sku,quantity:qty,unit_price:p.unit_price,status:'pending'}).select('id,total').single(),14000);
  if(wr.error||!wr.data?.id||wr.data.total!==qty*p.unit_price)throw Error('QA_CREATE_ORDER_FAILED');
  await load();onSaved();
 });}
 function draw(){
  const modes=categories.value==='all'?null:[categories.value];
  const next=drawQaCase(picked?.id||null,modes);
  if(!next)return;
  picked=next;prompt.textContent=next.id+' · '+next.prompt;
  expected.textContent='Tiêu chí đánh giá: '+next.expected;
  copyBtn.disabled=false;copyStatus.textContent='Đây là câu hỏi trong bộ QA, không phải câu trả lời AI.';
 }
 async function copy(){
  if(!picked)return;
  try{await navigator.clipboard.writeText(picked.prompt);copyStatus.textContent='Đã sao chép câu hỏi QA.'}
  catch{copyStatus.textContent='Trình duyệt không cho sao chép tự động. Chọn nội dung câu hỏi rồi sao chép thủ công.'}
 }
 load().then(()=>{status.textContent='Workspace QA sẵn sàng. Sản phẩm và đơn chỉ thuộc tài khoản của bạn.';status.dataset.tone='ok'})
 .catch(()=>{show('Không truy cập được dữ liệu QA. Hãy kiểm tra lại quyền và tải lại trang.')});
 return box;
}

import {withDeadline} from './auth-runtime.mjs';

const money = new Intl.NumberFormat('vi-VN', {style:'currency', currency:'VND'});
const date = value => new Date(value).toLocaleString('vi-VN');
const statuses = {pending:'Chờ xử lý', confirmed:'Đã xác nhận', paid:'Đã thanh toán', cancelled:'Đã hủy', refunded:'Đã hoàn tiền'};
const senders = {customer:'Khách hàng', agent:'AI', human:'Nhân viên'};
const orderFields = 'id,tenant_id,status,total_vnd,created_at';
const orderText = row => [row.id, statuses[row.status] || row.status, money.format(row.total_vnd), date(row.created_at)].join(' · ');
const pageSize = 20;

function button(label) {
  const result = document.createElement('button');
  result.type = 'button';
  result.textContent = label;
  return result;
}

const specs = {
  products: {
    title:'Xem sản phẩm', reload:'Tải lại danh mục', label:'sản phẩm',
    fields:'tenant_id,sku,name,price_vnd,stock_on_hand,is_active', order:'sku',
    filters:[['sku','Mã SKU chính xác'],['name','Tên sản phẩm']],
    statuses:{active:'Đang bán', inactive:'Ngừng bán', all:'Tất cả sản phẩm'},
    format:r => [r.name,r.sku,money.format(r.price_vnd),'Tồn '+r.stock_on_hand,r.is_active?'Đang bán':'Ngừng bán'].join(' · ')
  },
  orders: {
    title:'Xem đơn hàng', reload:'Tải lại đơn hàng', label:'đơn hàng', fields:orderFields,
    order:'created_at', filters:[['id','Mã đơn đầy đủ']], statuses:{'':'Mọi trạng thái',...statuses}, format:orderText,
    detail:{table:'order_items', parent:'order_id'}
  },
  order_items: {
    title:'Chi tiết đơn',label:'dòng hàng',order:'id',
    fields:'id,tenant_id,order_id,product_id,quantity,unit_price_vnd,line_total_vnd',
    format:r => ['Sản phẩm '+r.product_id,'SL '+r.quantity,money.format(r.unit_price_vnd),'Thành tiền '+money.format(r.line_total_vnd)].join(' · ')
  },
  customers: {
    title:'Xem khách hàng',label:'khách hàng',fields:'id,tenant_id,display_name,created_at',
    order:'created_at',filters:[['display_name','Tên khách hàng']],
    format:r => [r.display_name,date(r.created_at)].join(' · '),
    detail:{table:'orders',parent:'customer_id',title:'Lịch sử mua hàng'}
  },
  conversations: {
    title:'Xem hội thoại',label:'hội thoại',fields:'id,tenant_id,channel,created_at',
    order:'created_at',statuses:{'':'Mọi kênh',web:'Website',messenger:'Messenger',zalo:'Zalo',line:'LINE'},
    format:r => [r.channel,r.id,date(r.created_at)].join(' · '),
    detail:{table:'messages',parent:'conversation_id'}
  },
  tenant_agent_configs: {
    title:'Xem AI Agent',label:'cấu hình AI',order:'channel',
    fields:'tenant_id,channel,bot_id,workflow_version,prompt_version,knowledge_version,model,lifecycle,updated_at',
    format:r => [r.bot_id,r.channel==='pilot_lab'?'Kênh thử nghiệm':r.channel,
      r.lifecycle==='paused'?'Tạm nghỉ':'Bản thử nghiệm',r.model,'Workflow '+r.workflow_version,
      'Prompt '+r.prompt_version,'Kiến thức '+r.knowledge_version,date(r.updated_at)].join(' · ')
  },
  messages: {
    title:'Lịch sử tương tác',label:'tin nhắn',fields:'id,tenant_id,conversation_id,sender,body,created_at',
    order:'created_at',format:r => [date(r.created_at),senders[r.sender] || r.sender,r.body].join(' · ')
  }
};

function options(pairs, label) {
  const select = document.createElement('select');
  select.setAttribute('aria-label',label);
  for (const [value,title] of pairs) select.add(new Option(title,value));
  return select;
}

export function addMerchantList(container, table, context, parent) {
  const spec = specs[table];
  const section = document.createElement('section');
  const opener = button(parent?.title || spec.title);
  const filters = document.createElement('form');
  const input = document.createElement('input');
  const searchBy = options(spec.filters || [], 'Tìm '+spec.label+' theo');
  const state = options(Object.entries(spec.statuses || {}),table==='conversations'?'Kênh hội thoại':'Trạng thái '+spec.label);
  const apply = button('Áp dụng');
  const status = document.createElement('p');
  const results = document.createElement('ul');
  const navigation = document.createElement('div');
  const prev = button('Trang trước');
  const next = button('Trang sau');
  let offset = 0;
  let applied = {column:searchBy.value, value:'', state:state.value};
  const canFilter = !parent && (spec.filters || spec.statuses);
  status.setAttribute('role','status');
  navigation.className='merchant-pagination';
  navigation.append(prev,next);
  navigation.hidden = filters.hidden = true;
  if (spec.filters?.length) {
    if (spec.filters.length>1) filters.append(searchBy);
    function updateHint() {
      input.placeholder = searchBy.selectedOptions[0].text;
      input.setAttribute('aria-label',input.placeholder);
    }
    searchBy.addEventListener('change',updateHint);
    updateHint();
    input.maxLength = 128;
    filters.append(input);
  }
  if (spec.statuses) filters.append(state);
  apply.type='submit';
  filters.append(apply);
  section.append(opener,filters,status,results,navigation);
  container.append(section);

  async function load(start) {
    if (!context.current() || !section.isConnected || opener.disabled) return;
    results.replaceChildren();
    navigation.hidden = true;
    filters.hidden = !canFilter;
    opener.disabled = apply.disabled = true;
    status.textContent='Đang tải '+spec.label+'…';
    try {
      const fields = parent && !spec.fields.split(',').includes(parent.column)
        ? spec.fields+','+parent.column : spec.fields;
      let query = context.client.from(table).select(fields,{count:'exact'}).eq('tenant_id',context.tenantId);
      if (parent) query=query.eq(parent.column,parent.id);
      if (applied.value) {
        if (applied.column==='sku' || applied.column==='id') query=query.eq(applied.column,applied.value);
        else query=query.ilike(applied.column,'%'+applied.value.replace(/[\\%_*]/g,c=>'\\'+c)+'%');
      }
      if (table==='products' && applied.state!=='all') query=query.eq('is_active',applied.state==='active');
      if (table==='orders' && applied.state) query=query.eq('status',applied.state);
      if (table==='conversations' && applied.state) query=query.eq('channel',applied.state);
      query=query.order(spec.order,{ascending:spec.order!=='created_at'});
      if (spec.order==='created_at') query=query.order('id');
      const {data,count,error} = await withDeadline(query.range(start,start+pageSize-1),13000);
      if (!context.current() || !section.isConnected) return;
      if (error || !Number.isSafeInteger(count) || !Array.isArray(data) || data.length>pageSize ||
          data.some(r=>r?.tenant_id!==context.tenantId || (parent && r[parent.column]!==parent.id))) throw Error('scope');
      offset=start;
      for (const row of data) {
        const item=document.createElement('li');
        item.textContent=spec.format(row);
        results.append(item);
        if (spec.detail) addMerchantList(item,spec.detail.table,context,{column:spec.detail.parent,id:row.id,title:spec.detail.title});
      }
      status.textContent=data.length ? (start+1)+'–'+(start+data.length)+' / '+count+' '+spec.label : 'Không có '+spec.label+' phù hợp.';
      prev.disabled=start===0;
      next.disabled=start+pageSize>=count;
      navigation.hidden=prev.disabled && next.disabled;
      if (!parent && spec.reload) opener.textContent=spec.reload;
    } catch {
      if (!context.current() || !section.isConnected) return;
      status.textContent='Chưa tải được '+(table==='products'?'danh mục':spec.label)+'. Hãy kiểm tra lại quyền hoặc thử lại.';
      // Keep a way back if the data shrank and the provider rejects the requested range.
      prev.disabled=start===0;
      next.disabled=true;
      navigation.hidden=prev.disabled;
      offset=start;
    } finally {
      opener.disabled=apply.disabled=false;
    }
  }
  opener.addEventListener('click',()=>load(0));
  prev.addEventListener('click',()=>load(Math.max(0,offset-pageSize)));
  next.addEventListener('click',()=>load(offset+pageSize));
  filters.addEventListener('submit',event=>{
    event.preventDefault();
    if (opener.disabled) return;
    const value=input.value.trim();
    if (searchBy.value==='id' && value && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
      status.textContent='Nhập đầy đủ mã đơn hoặc để trống.';
      return;
    }
    applied={column:searchBy.value,value,state:state.value};
    load(0);
  });
}

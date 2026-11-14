const iso = day => day.toISOString().slice(0,10);
export function period(key, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const field = type => Number(parts.find(p => p.type === type).value);
  const y=field('year'), m=field('month')-1, d=field('day');
  const date = (month,day) => iso(new Date(Date.UTC(y,month,day)));
  switch (key) {
    case 'today': return [date(m,d),date(m,d)];
    case 'yesterday': return [date(m,d-1),date(m,d-1)];
    case 'week': return [date(m,d-6),date(m,d)];
    case 'month': return [date(m,1),date(m,d)];
    case 'year': return [date(0,1),date(m,d)];
    default: throw Error('invalid period');
  }
}

export function mountRevenuePanel(root,client,shop) {
  const section=document.createElement('section');
  const title=document.createElement('h2');
  title.textContent='Báo cáo kinh doanh';
  const select=document.createElement('select');
  select.setAttribute('aria-label','Kỳ báo cáo');
  for(const [key,label] of Object.entries({today:'Hôm nay',yesterday:'Hôm qua',week:'7 ngày',month:'Tháng này',year:'Năm nay',custom:'Tùy chọn'}))
    select.add(new Option(label,key));
  const fields=['Từ ngày','Đến ngày'].map(label=>{
    const input=document.createElement('input');
    input.type='date';input.setAttribute('aria-label',label);return input;
  });
  const run=document.createElement('button');
  run.type='button';run.textContent='Xem báo cáo';
  const output=document.createElement('div');
  output.setAttribute('role','status');
  let current=0;
  function change() {
    current++; output.replaceChildren();
    if(select.value!=='custom'){
      const dates=period(select.value);
      fields.forEach((f,i)=>{f.value=dates[i];});
    }
    fields.forEach(f=>{f.hidden=select.value!=='custom';});
  }
  async function load() {
    const round=++current;
    const [start,end]=fields.map(f=>f.value);
    if(!start || !end || start>end || Date.parse(end)-Date.parse(start)>365*86400000){
      output.textContent='Chọn kỳ báo cáo từ 1 đến 366 ngày.';return;
    }
    output.textContent='Đang tải…';
    try {
      const {data,error}=await client.rpc('merchant_revenue_v3',{p_shop:shop,p_start:start,p_end:end});
      if(current!==round || !root.contains(section)) return;
      if(error || data.basis!=='created_at_current_status') throw Error();
      const stats=data.periods.current;
      const money=v=>new Intl.NumberFormat('vi-VN').format(BigInt(v))+' đ';
      const lines=['Theo ngày tạo đơn, giờ Việt Nam',
        'Giá trị đơn đã thanh toán: '+money(stats.paid_order_value_vnd),
        'Kỳ trước: '+money(data.periods.previous.paid_order_value_vnd),
        'Tổng đơn: '+stats.orders+' · Chờ xử lý: '+stats.pending+' · Đã thanh toán: '+stats.paid+' · Đã hủy: '+stats.cancelled,
        'Giá trị chưa thanh toán: '+money(stats.unpaid_order_value_vnd)];
      for(const row of data.top_skus_by_units) lines.push(row.sku+' · '+row.units+' sản phẩm · '+money(row.paid_line_vnd));
      lines.push('Chưa có dữ liệu giá vốn và dòng tiền thực thu.');
      output.replaceChildren(...lines.map(t=>{const p=document.createElement('p');p.textContent=t;return p;}));
    } catch { if(current===round && root.contains(section)) output.textContent='Chưa tải được báo cáo của cửa hàng.'; }
  }
  select.onchange=change;fields.forEach(f=>{f.oninput=()=>{current++;output.replaceChildren();};});
  run.onclick=load;section.append(title,select,...fields,run,output);root.append(section);change();
  return ()=>{current++;section.remove();};
}

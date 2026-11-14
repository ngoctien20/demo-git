// Candidate for the existing signed-in merchant account page. Pass its Supabase client.
const labels = {
  zalo_bot:'Bot Zalo của cửa hàng', held:'Tạm giữ', zalo:'Zalo · Tùy chọn', telegram:'Telegram', gmail:'Gmail', messenger:'Messenger', dashboard:'Hộp thư',
  waiting_for_owner:'Chờ xác minh OA', policy_qa:'Đang kiểm thử chính sách', unconfigured:'Chưa cấu hình',
  disabled:'Đang tắt', internal:'Nội bộ', qa_route_only:'Đã cấu hình thử nghiệm',
  queued:'Đang chờ', sending:'Đang xử lý', accepted:'Đã tiếp nhận', failed:'Thất bại',
  needs_review:'Cần đối soát', blocked:'Bị chặn', cancelled:'Đã hủy'
};

export function mountNotificationCenter(root, client, shop, openOrder) {
  const scope = document.createElement('section');
  root.replaceChildren(scope);
  let generation = 0;
  const element = (tag,text) => {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  };
  const title = element('h2','Kênh thông báo');
  const refresh = element('button','Tải lại');
  refresh.type='button';
  const status = element('p','');
  status.setAttribute('role','status');
  const content = element('div','');
  scope.append(title,refresh,status,content);

  async function load() {
    const id = ++generation;
    const current = () => root.contains(scope) && id === generation;
    content.replaceChildren();
    status.textContent='Đang tải…';
    refresh.disabled=true;
    try {
      const [settings,inbox] = await Promise.all(['merchant_notification_channels','merchant_notification_inbox']
        .map(name => client.rpc(name,{p_shop:shop})));
      if (!current()) return;
      if (settings.error || inbox.error || !Array.isArray(settings.data) || !Array.isArray(inbox.data))
        throw Error('load');
      if (!settings.data.length) { status.textContent='Bạn chưa có quyền xem kênh của cửa hàng này.'; return; }
      const list = element('ul','');
      for (const row of settings.data)
        list.append(element('li',(labels[row.channel] ?? 'Kênh khác')+' · '+(labels[row.connection_state] ?? 'Chưa xác định')));
      content.append(list,element('h3','Thông báo đơn hàng'));
      if (!inbox.data.length) content.append(element('p','Chưa có thông báo đơn hàng.'));
      for (const event of inbox.data) {
        const card=element('article','');
        card.append(element('h4','Đơn '+event.order_id));
        const date=new Date(event.created_at);
        if (!Number.isNaN(date.valueOf())) card.append(element('p',date.toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})));
        for (const delivery of event.deliveries) {
          const error = delivery.last_error_code === 'SEND_DISABLED' ? ' · Đang khóa gửi tin' : delivery.last_error_code ? ' · '+delivery.last_error_code : '';
          card.append(element('p',(labels[delivery.channel] ?? 'Kênh khác')+' · '+(labels[delivery.status] ?? 'Chưa xác định')
            +' · Số lần thử: '+delivery.attempts+error));
        }
        if (typeof openOrder==='function') {
          const order=element('button','Xem chi tiết đơn');
          order.type='button';
          order.onclick=()=>{ if (current()) openOrder(shop,event.order_id); };
          card.append(order);
        }
        const seen=element('button',event.viewed_at ? 'Đã xem trong hộp thư' : 'Đánh dấu đã xem');
        seen.type='button';
        seen.disabled=Boolean(event.viewed_at);
        seen.onclick=async()=>{
          if (!current()) return;
          seen.disabled=true;
          try {
            const answer=await client.rpc('mark_merchant_notification_viewed',{p_shop:shop,p_event:event.event_id});
            if (!current()) return;
            if (answer.error || answer.data!==true) throw Error('denied');
            seen.textContent='Đã xem trong hộp thư';
          } catch {
            if (current()) { seen.disabled=false; status.textContent='Chưa lưu được trạng thái đã xem.'; }
          }
        };
        card.append(seen);
        content.append(card);
      }
      status.textContent='';
    } catch {
      if (current()) {content.replaceChildren();status.textContent='Chưa tải được thông báo. Vui lòng thử lại.';}
    } finally { if(current()) refresh.disabled=false; }
  }
  refresh.onclick=load;
  void load();
  return () => { generation++; scope.remove(); };
}

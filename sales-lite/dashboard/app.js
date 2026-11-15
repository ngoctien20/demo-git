const $ = (s) => document.querySelector(s),
  content = $('#content'),
  status = $('#status'),
  dialog = $('#dialog');
const labels = { new: 'Đơn mới', orders: 'Đơn hàng', revenue: 'Doanh thu', settings: 'Cài đặt' };
const states = {
  NEW_PENDING_OWNER: 'Chờ xác nhận',
  OWNER_CONFIRMED: 'Đã xác nhận',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Đã từ chối'
};
const fmt = (v) => BigInt(v).toLocaleString('vi-VN') + 'đ';
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
const button = (s, fn, cls) => {
  const b = el('button', s, cls);
  b.type = 'button';
  b.onclick = fn;
  return b;
};
let tab = 'new',
  period = 'today',
  generation = 0,
  pending = null;
async function api(path, payload) {
  const r = await fetch('/api/' + path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...(payload
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      : {})
  });
  if (r.status === 401) throw Error('Cần đăng nhập bằng tài khoản chủ shop.');
  if (r.status === 403) throw Error('Tài khoản hiện tại chưa có quyền truy cập cửa hàng này.');
  if (r.status === 409) throw Error('Thông tin đã thay đổi hoặc không còn hợp lệ. Hãy tải lại yêu cầu.');
  if (!r.ok || !r.headers.get('content-type')?.includes('application/json'))
    throw Error('Chưa kết nối được sổ bán hàng.');
  return r.json();
}
async function decide(item, action) {
  try {
    const response = await api('decision', { action, code: item.code, event: crypto.randomUUID() });
    if (response.state !== 'OWNER_CONFIRMATION_REQUIRED') throw Error('Không thể xử lý yêu cầu.');
    pending = { action, code: item.code, proof: response.proof, event: crypto.randomUUID() };
    $('#dialog-title').textContent = action === 'confirm' ? 'Xác nhận yêu cầu này?' : 'Từ chối yêu cầu này?';
    $('#dialog-text').textContent =
      item.code + ' · ' + item.sku + ' × ' + item.quantity + ' · ' + fmt(item.total_vnd);
    dialog.showModal();
  } catch (e) {
    status.textContent = e.message;
  }
}
$('#back').onclick = () => {
  pending = null;
  dialog.close();
};
$('#apply').onclick = async () => {
  if (!pending) return;
  const b = $('#apply');
  b.disabled = true;
  try {
    await api('decision', pending);
    pending = null;
    dialog.close();
    await load();
  } catch (e) {
    $('#dialog-text').textContent = e.message;
  } finally {
    b.disabled = false;
  }
};
function entry(r) {
  const c = el('article', undefined, 'card');
  c.append(
    el('div', r.code, 'code'),
    el('h2', r.sku + ' · ' + r.product_label),
    el('p', r.quantity + ' × ' + fmt(r.unit_vnd) + ' · ' + fmt(r.total_vnd)),
    el('p', states[r.status], 'muted')
  );
  if (r.status === 'NEW_PENDING_OWNER') {
    const a = el('div', undefined, 'actions');
    a.append(
      button('Xác nhận', () => decide(r, 'confirm'), 'primary'),
      button('Từ chối', () => decide(r, 'cancel'))
    );
    c.append(a);
  }
  return c;
}
async function load(before = null) {
  const run = ++generation,
    more = Boolean(before);
  if (!more) content.replaceChildren();
  status.textContent = 'Đang tải…';
  $('#heading').textContent = labels[tab];
  document.querySelectorAll('[data-tab]').forEach((b) => {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  try {
    const q = new URLSearchParams({ tab, period });
    if (before) q.set('before', before);
    const data = await api('view?' + q);
    if (run !== generation) return;
    status.textContent = '';
    if (tab === 'settings') {
      const c = el('section', undefined, 'card');
      c.append(
        el('h2', 'Cửa hàng ' + data.shop),
        el('p', 'Bot Zalo · đã ghép chủ shop'),
        el('p', 'Quyền thử nghiệm còn hiệu lực'),
        el('p', 'Thông báo thử nghiệm chỉ được lưu để xem trước.')
      );
      c.append(
        button(data.alertsEnabled ? 'Tắt thông báo thử nghiệm' : 'Bật thông báo thử nghiệm', async (ev) => {
          ev.target.disabled = true;
          try {
            await api('settings', { enabled: !data.alertsEnabled, event: crypto.randomUUID() });
            await load();
          } catch (e) {
            status.textContent = e.message;
            ev.target.disabled = false;
          }
        })
      );
      content.append(c);
      return;
    }
    if (tab === 'revenue') {
      const l = el('label', 'Kỳ báo cáo '),
        select = el('select');
      for (const [k, s] of Object.entries({ today: 'Hôm nay', week: '7 ngày', month: 'Tháng này' }))
        select.add(new Option(s, k));
      select.value = period;
      select.onchange = () => {
        period = select.value;
        load();
      };
      l.append(select);
      content.append(l);
      const v = data.report,
        c = el('section', undefined, 'card');
      c.append(
        el('h2', 'Tiền đã thu'),
        el('p', v.paid_vnd === null ? 'Chưa đủ chứng cứ thanh toán' : fmt(v.paid_vnd), 'amount'),
        el('p', v.start + ' – ' + v.end + ' · Giờ Việt Nam', 'muted'),
        el('p', 'Giá trị yêu cầu tạo trong kỳ: ' + fmt(v.requested_vnd)),
        el(
          'p',
          'Chờ xử lý ' +
            v.pending +
            ' · Đã xác nhận ' +
            v.confirmed +
            ' · Đã thanh toán ' +
            v.marked_paid +
            ' · Đã hủy ' +
            v.cancelled
        )
      );
      content.append(c);
      return;
    }
    document.getElementById('more')?.remove();
    for (const r of data.requests) content.append(entry(r));
    if (!content.children.length)
      status.textContent = tab === 'new' ? 'Chưa có yêu cầu chờ xác nhận.' : 'Chưa có yêu cầu đặt hàng.';
    if (data.next) {
      const b = button('Xem thêm', () => load(data.next));
      b.id = 'more';
      content.append(b);
    }
  } catch (e) {
    if (run !== generation) return;
    content.replaceChildren();
    status.textContent = e.message;
    content.append(button('Thử lại', () => load()));
  }
}
document.querySelectorAll('[data-tab]').forEach(
  (b) =>
    (b.onclick = () => {
      tab = b.dataset.tab;
      load();
    })
);
$('#settings').onclick = () => {
  tab = 'settings';
  load();
};
load();

/*! TIEN404 chat widget V24 — gắn bot AI bán hàng chung vào website của shop.
 * Nhúng:  <script src="tien404-chat-widget.js" data-endpoint="https://<n8n>/webhook/tien404-web-chat-v24"
 *                 data-title="Shop Tien404" data-color="#0f766e" defer></script>
 * Không cần thư viện ngoài. Không lưu dữ liệu khách ngoài một mã phiên ngẫu nhiên trong localStorage.
 */
(function () {
  'use strict';
  var me = document.currentScript;
  if (!me || window.__tien404Widget) return;
  window.__tien404Widget = true;
  var endpoint = me.getAttribute('data-endpoint') || '';
  var title = me.getAttribute('data-title') || 'Tư vấn mua hàng';
  var color = /^#[0-9a-fA-F]{3,8}$/.test(me.getAttribute('data-color') || '') ? me.getAttribute('data-color') : '#0f766e';
  var greeting = me.getAttribute('data-greeting') || 'Chào bạn! Shop có thể giúp gì ạ? Bạn có thể gõ mã mẫu như "Xem A003".';
  if (!/^https:\/\//.test(endpoint)) { console.warn('[tien404] data-endpoint phải là https'); return; }

  function rid(n) {
    var a = new Uint8Array(n), s = '', abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < n; i++) s += abc[a[i] % abc.length];
    return s;
  }
  var KEY = 'tien404_widget_session';
  var session;
  try { session = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  if (!session || !/^[A-Za-z0-9_-]{16,64}$/.test(session)) {
    session = rid(24);
    try { localStorage.setItem(KEY, session); } catch (e) { /* ignore */ }
  }

  var css = '' +
    '.t4w-fab{position:fixed;right:16px;bottom:16px;width:56px;height:56px;border-radius:50%;border:0;background:' + color + ';color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer;z-index:2147483000;font:600 24px/1 system-ui}' +
    '.t4w-panel{position:fixed;right:16px;bottom:84px;width:min(360px,calc(100vw - 32px));height:min(520px,calc(100vh - 110px));display:flex;flex-direction:column;background:#fff;color:#111;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden;z-index:2147483000;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '.t4w-panel[hidden]{display:none}' +
    '.t4w-head{background:' + color + ';color:#fff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;font-weight:600}' +
    '.t4w-head button{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}' +
    '.t4w-log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f6f7f9}' +
    '.t4w-msg{max-width:85%;padding:8px 11px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}' +
    '.t4w-bot{background:#fff;border:1px solid #e5e7eb;align-self:flex-start}' +
    '.t4w-me{background:' + color + ';color:#fff;align-self:flex-end}' +
    '.t4w-qr{display:flex;flex-wrap:wrap;gap:6px}' +
    '.t4w-qr button{border:1px solid ' + color + ';color:' + color + ';background:#fff;border-radius:999px;padding:4px 10px;cursor:pointer;font:inherit}' +
    '.t4w-form{display:flex;gap:6px;padding:10px;border-top:1px solid #e5e7eb;background:#fff}' +
    '.t4w-form input{flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font:inherit;min-width:0}' +
    '.t4w-form button{background:' + color + ';color:#fff;border:0;border-radius:8px;padding:8px 12px;font:inherit;cursor:pointer}' +
    '.t4w-form button:disabled{opacity:.5}' +
    '@media (prefers-color-scheme:dark){.t4w-panel{background:#111827;color:#f3f4f6}.t4w-log{background:#0b1220}.t4w-bot{background:#1f2937;border-color:#374151}.t4w-form{background:#111827;border-color:#374151}.t4w-form input{background:#1f2937;color:#f3f4f6;border-color:#374151}.t4w-qr button{background:#111827}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var fab = document.createElement('button');
  fab.className = 't4w-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Mở chat tư vấn'); fab.setAttribute('aria-expanded', 'false'); fab.textContent = '💬';
  var panel = document.createElement('div');
  panel.className = 't4w-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', title);
  panel.innerHTML = '<div class="t4w-head"><span></span><button type="button" aria-label="Đóng">✕</button></div>' +
    '<div class="t4w-log" aria-live="polite"></div>' +
    '<form class="t4w-form"><input maxlength="500" autocomplete="off" aria-label="Tin nhắn" placeholder="Nhập tin nhắn…"><button type="submit">Gửi</button></form>';
  panel.querySelector('.t4w-head span').textContent = title;
  document.body.appendChild(fab); document.body.appendChild(panel);
  var log = panel.querySelector('.t4w-log'), form = panel.querySelector('form'), input = form.querySelector('input'), btn = form.querySelector('button');

  function bubble(text, who) {
    var d = document.createElement('div'); d.className = 't4w-msg ' + (who === 'me' ? 't4w-me' : 't4w-bot');
    d.textContent = String(text).replace(/\*\*([^*\n]+)\*\*/g, '$1');
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function quick(list) {
    if (!list || !list.length) return;
    var row = document.createElement('div'); row.className = 't4w-qr';
    list.slice(0, 3).forEach(function (q) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = q.label;
      b.addEventListener('click', function () { row.remove(); send(q.text); });
      row.appendChild(b);
    });
    log.appendChild(row); log.scrollTop = log.scrollHeight;
  }
  var busy = false;
  function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    busy = true; btn.disabled = true; bubble(text, 'me');
    var wait = bubble('…', 'bot');
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sendMessage', sessionId: session, messageId: rid(16), chatInput: text }) })
      .then(function (r) { if (!r.ok) throw new Error('http_' + r.status); return r.json(); })
      .then(function (data) {
        wait.remove();
        var msgs = Array.isArray(data.messages) && data.messages.length ? data.messages : [data.output || 'Dạ shop đang kiểm tra, mình nhắn lại giúp shop nhé.'];
        msgs.slice(0, 3).forEach(function (m) { bubble(m, 'bot'); });
        quick(data.quickReplies);
      })
      .catch(function () { wait.textContent = 'Kết nối đang chậm, mình gửi lại giúp shop nhé.'; })
      .then(function () { busy = false; btn.disabled = false; input.focus(); });
  }
  var greeted = false;
  function toggle(open) {
    panel.hidden = !open; fab.setAttribute('aria-expanded', String(open));
    if (open) { if (!greeted) { bubble(greeting, 'bot'); greeted = true; } input.focus(); }
  }
  fab.addEventListener('click', function () { toggle(panel.hidden); });
  panel.querySelector('.t4w-head button').addEventListener('click', function () { toggle(false); fab.focus(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); var t = input.value; input.value = ''; send(t); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
})();

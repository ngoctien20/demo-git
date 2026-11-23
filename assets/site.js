/* TIEN404 AI public site — V23/V25. Menu, illustration tabs, AI chat (n8n chat webhook) and real lead form. */
(() => {
  'use strict';
  const conf = window.TIEN404_CONFIG || {};

  // Mobile menu
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    });
    menu.addEventListener('click', e => { if (e.target.closest('a')) { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); } });
  }

  // ---------- Tabs (illustrations only, no data) ----------
  document.querySelectorAll('[data-tabs]').forEach(box => {
    const tabs = [...box.querySelectorAll('[role="tab"]')];
    const select = t => tabs.forEach(x => {
      const on = x === t;
      x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
      const pane = document.getElementById(x.getAttribute('aria-controls'));
      if (pane) pane.hidden = !on;
    });
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; select(n); n.focus();
      });
    });
  });

  // ---------- Motion (kế thừa motion V2): progressive enhancement, tắt khi prefers-reduced-motion ----------
  const motionOK = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (motionOK) {
    const bar = document.createElement('div');
    bar.className = 'reading-progress'; bar.setAttribute('aria-hidden', 'true');
    document.body.append(bar);
    let ticking = false;
    const paint = () => { const max = document.documentElement.scrollHeight - innerHeight; bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')'; ticking = false; };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
    paint();
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-revealed'); e.target.classList.remove('motion-pending'); io.unobserve(e.target); }
      }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
      document.querySelectorAll('main .section h2, main .section .lead, .cards > *, .steps > li, .industry-list > *, .channel-cards > *, .plans > *, .split > *, .tabs-demo, .scope').forEach(el => {
        if (el.getBoundingClientRect().top < innerHeight) return; // already on screen: never hide it
        const sib = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
        el.style.setProperty('--reveal-delay', Math.min(sib, 5) * 85 + 'ms');
        el.setAttribute('data-reveal', ''); el.classList.add('motion-pending'); io.observe(el);
      });
    }
    if (finePointer) {
      document.querySelectorAll('.card, .core-diagram').forEach(c => {
        c.classList.add('spotlight');
        c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); c.style.setProperty('--px', (e.clientX - r.left) + 'px'); c.style.setProperty('--py', (e.clientY - r.top) + 'px'); });
      });
      const scene = document.querySelector('[data-tilt]');
      if (scene) {
        scene.addEventListener('pointermove', e => {
          const r = scene.getBoundingClientRect();
          scene.style.setProperty('--tilt-x', (((e.clientY - r.top) / r.height - .5) * -5).toFixed(2) + 'deg');
          scene.style.setProperty('--tilt-y', (((e.clientX - r.left) / r.width - .5) * 6).toFixed(2) + 'deg');
        });
        scene.addEventListener('pointerleave', () => { scene.style.removeProperty('--tilt-x'); scene.style.removeProperty('--tilt-y'); });
      }
    }
  }

  // ---------- AI chat ----------
  const SESSION_KEY = 'tien404_chat_session';
  function sessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()); sessionStorage.setItem(SESSION_KEY, id); }
      return id;
    } catch { return 'anon-' + Date.now(); }
  }
  function addMsg(log, text, cls) {
    const p = document.createElement('p');
    p.className = 'msg ' + cls;
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }
  async function ask(text) {
    if (!conf.chatWebhook) throw new Error('chat_not_configured');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(conf.chatWebhook, {
        method: 'POST', credentials: 'omit', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', sessionId: sessionId(), chatInput: text }),
      });
      if (!res.ok) throw new Error('http_' + res.status);
      const raw = await res.text();
      try { const j = JSON.parse(raw); return (j.output || j.text || j.message || '').toString() || raw; } catch { return raw; }
    } finally { clearTimeout(t); }
  }
  function mountChat(panel) {
    const log = panel.querySelector('.chat-log');
    const form = panel.querySelector('.chat-form');
    const input = form.querySelector('input');
    const btn = form.querySelector('button');
    if (!log.children.length) addMsg(log, 'Xin chào! Bạn muốn hỏi về tính năng, cách kết nối kênh hay chi phí của TIEN404 AI?', 'in');
    let busy = false;
    async function send(text) {
      text = text.trim().slice(0, 500);
      if (!text || busy) return;
      busy = true; btn.disabled = true; input.value = '';
      addMsg(log, text, 'out');
      const wait = addMsg(log, 'Đang trả lời…', 'in typing');
      try {
        const reply = await ask(text);
        wait.className = 'msg in'; wait.textContent = reply || 'Mình chưa có câu trả lời cho câu này.';
      } catch {
        wait.className = 'msg in err';
        wait.textContent = 'Trợ lý đang bận hoặc bạn đã dùng hết lượt hôm nay. Bạn có thể gửi câu hỏi ở trang Liên hệ.';
      } finally { busy = false; btn.disabled = false; input.focus(); }
    }
    form.addEventListener('submit', e => { e.preventDefault(); send(input.value); });
    panel.querySelectorAll('.chat-suggest button').forEach(b => b.addEventListener('click', () => send(b.textContent)));
  }
  const inline = document.querySelector('[data-chat="inline"]');
  if (inline) mountChat(inline);
  const holder = document.getElementById('chat-widget');
  if (holder && !inline && conf.chatWebhook) {
    holder.innerHTML = `<button class="fab" type="button" aria-expanded="false" aria-controls="fab-panel" aria-label="Chat với trợ lý AI"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg></button>
<div class="card chat-panel fab-panel" id="fab-panel" role="dialog" aria-label="Trợ lý TIEN404" hidden>
 <div class="chat-head"><b>Trợ lý TIEN404</b><button class="btn btn-ghost" type="button" data-close aria-label="Đóng">✕</button></div>
 <div class="chat-log" aria-live="polite"></div>
 <form class="chat-form"><label class="sr" for="chat-input-fab">Tin nhắn</label><input id="chat-input-fab" maxlength="500" autocomplete="off" placeholder="Nhập câu hỏi…"><button class="btn btn-primary" type="submit">Gửi</button></form>
</div>`;
    const fab = holder.querySelector('.fab');
    const panel = holder.querySelector('.fab-panel');
    let mounted = false;
    const setOpen = open => {
      panel.hidden = !open; fab.setAttribute('aria-expanded', String(open));
      if (open) { if (!mounted) { mountChat(panel); mounted = true; } panel.querySelector('input').focus(); }
    };
    fab.addEventListener('click', () => setOpen(panel.hidden));
    panel.querySelector('[data-close]').addEventListener('click', () => { setOpen(false); fab.focus(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); fab.focus(); } });
  }

  // ---------- Lead form ----------
  const lead = document.getElementById('lead-form');
  if (lead) {
    const status = lead.querySelector('.form-status');
    const plan = new URLSearchParams(location.search).get('goi');
    if (plan && lead.plan.querySelector(`option[value="${CSS.escape(plan)}"]`)) lead.plan.value = plan;
    const say = (msg, cls) => { status.textContent = msg; status.className = 'form-status ' + (cls || ''); };
    const normPhone = v => {
      let d = v.replace(/[\s.\-()]/g, '');
      if (d.startsWith('+84')) d = '0' + d.slice(3); else if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
      return d;
    };
    lead.addEventListener('submit', async e => {
      e.preventDefault();
      const f = lead.elements;
      if (f.website.value) return; // honeypot
      const name = f.name.value.trim(), email = f.email.value.trim(), phone = normPhone(f.phone.value.trim());
      const message = f.message.value.trim();
      if (!name) return say('Vui lòng nhập họ tên.', 'err'), f.name.focus();
      if (!phone && !email) return say('Vui lòng để lại số điện thoại hoặc email.', 'err'), f.phone.focus();
      if (phone && !/^0[35789]\d{8}$/.test(phone)) return say('Số điện thoại chưa đúng định dạng Việt Nam (10 số, bắt đầu bằng 03, 05, 07, 08, 09).', 'err'), f.phone.focus();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('Email chưa đúng định dạng.', 'err'), f.email.focus();
      if (message.length < 5) return say('Vui lòng mô tả ngắn nhu cầu của bạn.', 'err'), f.message.focus();
      if (!f.consent.checked) return say('Vui lòng đồng ý để chúng tôi liên hệ lại.', 'err');
      if (!conf.supabaseUrl || !conf.supabaseKey) return say('Biểu mẫu chưa được kết nối. Vui lòng thử lại sau.', 'err');
      const btn = lead.querySelector('button[type="submit"]');
      btn.disabled = true; say('Đang gửi…');
      try {
        const res = await fetch(`${conf.supabaseUrl}/rest/v1/rpc/submit_lead`, {
          method: 'POST', credentials: 'omit',
          headers: { 'Content-Type': 'application/json', apikey: conf.supabaseKey },
          body: JSON.stringify({ p_name: name, p_shop: f.shop.value.trim() || null, p_phone: phone || null, p_email: email || null,
            p_industry: f.industry.value || null, p_plan: f.plan.value || null, p_message: message, p_source: location.pathname.slice(-60) }),
        });
        if (!res.ok) throw new Error(String(res.status));
        lead.reset();
        say('Đã nhận yêu cầu. Đội TIEN404 sẽ liên hệ lại với bạn sớm.', 'ok');
      } catch {
        say('Chưa gửi được yêu cầu. Vui lòng thử lại sau ít phút.', 'err');
      } finally { btn.disabled = false; }
    });
  }
})();

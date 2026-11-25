// TIEN404 V27.4/V27.5 web widget block renderer (browser, no deps). Renders toWebWidget() blocks with
// textContent only (never innerHTML), https links with rel=noopener, and calls onAction(payload)
// for action buttons — the server re-resolves every payload against the published config.
// V27.8: optional item.badge (label over photo), item.soldOut, action.disabled.
// V27.5: optional `theme` from toWebWidget() (owner card_style) → CSS vars + classes, styled by widget-theme.css.
const VAR_RE = /^--t404-[a-z-]+$/;
const SAFE_VAL = /^[#0-9a-zA-Z .%-]{1,32}$/;
const ENUMS = { variant: ['solid', 'outline', 'soft'], layout: ['stack', 'row'], animation: ['none', 'fade', 'slide', 'pop', 'shine'], card: ['photo_top', 'compact'], image_ratio: ['horizontal', 'square'] };

export function applyTheme(root, theme) {
  if (!theme) return;
  for (const [k, v] of Object.entries(theme.vars ?? {})) if (VAR_RE.test(k) && SAFE_VAL.test(String(v))) root.style.setProperty(k, String(v));
  for (const [k, allowed] of Object.entries(ENUMS)) {
    const v = theme[k];
    if (allowed.includes(v)) root.dataset['t4' + k[0].toUpperCase() + k.slice(1).replace(/_(\w)/g, (_, c) => c.toUpperCase())] = v;
  }
}

export function renderBlocks(root, blocks, { onAction = () => {}, theme } = {}) {
  applyTheme(root, theme);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const actionEl = (a, cls) => {
    if (a.kind === 'link' && /^https:\/\//.test(a.url)) { const l = el('a', cls, a.label); l.href = a.url; l.target = '_blank'; l.rel = 'noopener noreferrer'; return l; }
    const b = el('button', cls, a.label); b.type = 'button'; b.addEventListener('click', () => onAction(a.payload)); return b;
  };
  const card = (it, cls, i = 0) => {
    const c = el('article', cls);
    c.style.setProperty('--t404-i', String(i)); // stagger index for animations
    if (it.image) {
      const f = el('div', 't4-media'); const img = el('img'); img.src = it.image; img.alt = it.title; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; f.append(img);
      // V27.8: owner label drawn over the photo (web only; Messenger keeps it in the subtitle).
      if (typeof it.badge === 'string' && it.badge) f.append(el('span', 't4-badge', it.badge.slice(0, 16)));
      c.append(f);
    }
    if (it.soldOut === true) c.classList.add('t4-soldout');
    const body = el('div', 't4-body');
    body.append(el('strong', 't4-title', it.title));
    if (it.subtitle) body.append(el('span', 't4-sub', it.subtitle));
    const acts = el('div', 't4-card-actions');
    (it.actions ?? []).forEach((a, k) => { const n = actionEl(a, 't4-card-btn' + (k === 0 ? ' t4-primary' : '')); if (a.disabled === true && n.tagName === 'BUTTON') n.disabled = true; acts.append(n); });
    body.append(acts); c.append(body);
    return c;
  };
  for (const b of blocks) {
    if (b.type === 'text') root.append(el('p', 't4-bubble', b.text));
    else if (b.type === 'carousel') { const r = el('div', 't4-carousel'); r.setAttribute('role', 'list'); b.items.forEach((it, i) => { const c = card(it, 't4-card', i); c.setAttribute('role', 'listitem'); r.append(c); }); root.append(r); }
    else if (b.type === 'card') root.append(card(b, 't4-card t4-card-wide'));
    else if (b.type === 'buttons') { const r = el('div', 't4-buttons'); b.actions.forEach((a, k) => r.append(actionEl(a, 't4-btn' + (k === 0 ? ' t4-primary' : '')))); root.append(r); }
    else if (b.type === 'chips') { const r = el('div', 't4-chips'); for (const a of b.actions) r.append(actionEl(a, 't4-chip')); root.append(r); }
  }
}

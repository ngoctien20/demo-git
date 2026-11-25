// TIEN404 V27.4 web widget block renderer (browser, no deps). Renders toWebWidget() blocks with
// textContent only (never innerHTML), https links with rel=noopener, and calls onAction(payload)
// for action buttons — the server re-resolves every payload against the published config.
export function renderBlocks(root, blocks, { onAction = () => {} } = {}) {
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const actionEl = (a, cls) => {
    if (a.kind === 'link' && /^https:\/\//.test(a.url)) { const l = el('a', cls, a.label); l.href = a.url; l.target = '_blank'; l.rel = 'noopener noreferrer'; return l; }
    const b = el('button', cls, a.label); b.type = 'button'; b.addEventListener('click', () => onAction(a.payload)); return b;
  };
  const card = (it, cls) => {
    const c = el('article', cls);
    if (it.image) { const i = el('img'); i.src = it.image; i.alt = it.title; i.loading = 'lazy'; i.referrerPolicy = 'no-referrer'; c.append(i); }
    c.append(el('strong', 't4-title', it.title));
    if (it.subtitle) c.append(el('span', 't4-sub', it.subtitle));
    const acts = el('div', 't4-card-actions'); for (const a of it.actions ?? []) acts.append(actionEl(a, 't4-card-btn')); c.append(acts);
    return c;
  };
  for (const b of blocks) {
    if (b.type === 'text') root.append(el('p', 't4-bubble', b.text));
    else if (b.type === 'carousel') { const r = el('div', 't4-carousel'); r.setAttribute('role', 'list'); for (const it of b.items) { const c = card(it, 't4-card'); c.setAttribute('role', 'listitem'); r.append(c); } root.append(r); }
    else if (b.type === 'card') root.append(card(b, 't4-card t4-card-wide'));
    else if (b.type === 'buttons') { const r = el('div', 't4-buttons'); for (const a of b.actions) r.append(actionEl(a, 't4-btn')); root.append(r); }
    else if (b.type === 'chips') { const r = el('div', 't4-chips'); for (const a of b.actions) r.append(actionEl(a, 't4-chip')); root.append(r); }
  }
}

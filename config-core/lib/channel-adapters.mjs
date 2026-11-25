// TIEN404 V27.4 channel adapters (pure, no I/O, NOT wired into any live bot).
// planCards() always produces a Messenger-shaped plan (quick_replies / generic / button / text).
// Each adapter turns that plan into the richest form its channel really supports, and degrades
// item by item (never silently dropping an action without saying so in `degraded`).
//
//   Messenger  : native (unchanged)
//   Telegram   : HTML text + inline_keyboard (callback_data ≤64 bytes), sendPhoto for 1 image card
//   Web widget : own blocks (chips, carousel with images, cards, buttons) — fully custom CSS
//   Zalo Bot   : plain text + numbered choices (no buttons on the official Bot API we use)

const enc = new TextEncoder();
const bytes = (s) => enc.encode(String(s)).length;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cps = (s) => [...String(s)];
const clip = (s, n) => (cps(s).length <= n ? String(s) : cps(s).slice(0, n - 1).join('') + '…');

export const TELEGRAM_LIMITS = Object.freeze({ text: 4096, caption: 1024, callback: 64, buttonsPerRow: 3, rows: 8 });
export const WEB_LIMITS = Object.freeze({ chips: 6, carousel: 10, buttons: 4, label: 40, text: 2000 });

// One normalized action from any Messenger button / quick reply.
function action(b) {
  if (b.type === 'web_url') return { label: b.title, url: b.url };
  return { label: b.title, payload: b.payload };
}
function collect(plan) {
  const out = { texts: [], cards: [], buttons: [], chips: [], kind: plan.kind };
  for (const m of plan.messages) {
    if (typeof m.text === 'string') out.texts.push(m.text);
    const p = m.attachment?.payload;
    if (p?.template_type === 'generic') {
      for (const e of p.elements) out.cards.push({ title: e.title, subtitle: e.subtitle, image: e.image_url, actions: e.buttons.map(action) });
    } else if (p?.template_type === 'button') {
      out.texts.push(p.text);
      out.buttons.push(...p.buttons.map(action));
    }
    if (m.quick_replies) out.chips.push(...m.quick_replies.map((q) => ({ label: q.title, payload: q.payload })));
  }
  return out;
}

// ---------- Telegram ----------
function tgButton(a, degraded) {
  if (a.url) return /^https:\/\//.test(a.url) ? { text: clip(a.label, 32), url: a.url } : (degraded.push('tg_url_invalid'), null);
  if (bytes(a.payload) > TELEGRAM_LIMITS.callback) { degraded.push('tg_callback_too_long:' + a.label); return null; }
  return { text: clip(a.label, 32), callback_data: a.payload };
}
function rows(buttons, perRow) {
  const r = [];
  for (let i = 0; i < buttons.length; i += perRow) r.push(buttons.slice(i, i + perRow));
  return r.slice(0, TELEGRAM_LIMITS.rows);
}

/** @returns {{method:string, params:object}[]} Bot API calls (≤3), plus degraded reasons. */
export function toTelegram(plan) {
  const degraded = [...(plan.degraded ?? [])];
  const c = collect(plan);
  const calls = [];
  if (c.cards.length === 1 && c.cards[0].image) {
    // Content card with a verified photo: one sendPhoto, caption + buttons (mock-up 04 on Telegram).
    const card = c.cards[0];
    const kb = card.actions.map((a) => tgButton(a, degraded)).filter(Boolean);
    calls.push({ method: 'sendPhoto', params: { photo: card.image, parse_mode: 'HTML',
      caption: clip('<b>' + esc(card.title) + '</b>' + (card.subtitle ? '\n' + esc(card.subtitle) : ''), TELEGRAM_LIMITS.caption),
      ...(kb.length ? { reply_markup: { inline_keyboard: rows(kb, 1) } } : {}) } });
  } else if (c.cards.length) {
    // Carousel → one list message; each card becomes a bold line + its own button; 3 per row.
    const lines = c.cards.map((k) => '<b>' + esc(k.title) + '</b>' + (k.subtitle ? '\n' + esc(k.subtitle) : '') +
      k.actions.filter((a) => a.url).map((a) => '\n' + esc(a.url)).join(''));
    const kb = c.cards.flatMap((k) => k.actions.filter((a) => !a.url)).map((a) => tgButton(a, degraded)).filter(Boolean);
    const nav = c.chips.map((a) => tgButton(a, degraded)).filter(Boolean);
    const text = clip(lines.join('\n\n') + (c.texts.length ? '\n\n' + c.texts.map(esc).join('\n') : ''), TELEGRAM_LIMITS.text);
    calls.push({ method: 'sendMessage', params: { text, parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [...rows(kb, TELEGRAM_LIMITS.buttonsPerRow), ...(nav.length ? [nav] : [])] } } });
    if (c.cards.some((k) => k.image)) degraded.push('tg_carousel_images_as_list');
  } else {
    const kb = [...c.buttons, ...c.chips].map((a) => tgButton(a, degraded)).filter(Boolean);
    const vertical = c.buttons.length > 0; // button card = important actions, one per row (mock-up 03)
    const text = clip(c.texts.map(esc).join('\n\n') || '…', TELEGRAM_LIMITS.text);
    calls.push({ method: 'sendMessage', params: { text, parse_mode: 'HTML',
      ...(kb.length ? { reply_markup: { inline_keyboard: rows(kb, vertical ? 1 : TELEGRAM_LIMITS.buttonsPerRow) } } : {}) } });
  }
  return { calls: calls.slice(0, 3), degraded };
}

// ---------- Web widget (own HTML/CSS, highest customisation) ----------
/** @returns {{blocks:object[], degraded:string[]}} render-only blocks; the widget never trusts labels for authority. */
export function toWebWidget(plan, { imageOrigins = [] } = {}) {
  const degraded = [...(plan.degraded ?? [])];
  const c = collect(plan);
  const okImg = (u) => { if (!u) return undefined; try { const x = new URL(u); return x.protocol === 'https:' && imageOrigins.includes(x.origin) ? x.href : (degraded.push('web_image_dropped'), undefined); } catch { return undefined; } };
  const act = (a) => (a.url ? { kind: 'link', label: clip(a.label, WEB_LIMITS.label), url: a.url } : { kind: 'action', label: clip(a.label, WEB_LIMITS.label), payload: a.payload });
  const blocks = [];
  for (const t of c.texts) blocks.push({ type: 'text', text: clip(t, WEB_LIMITS.text) });
  if (c.cards.length > 1) blocks.unshift({ type: 'carousel', items: c.cards.slice(0, WEB_LIMITS.carousel).map((k) => ({ title: k.title, subtitle: k.subtitle, image: okImg(k.image), actions: k.actions.map(act) })) });
  else if (c.cards.length === 1) blocks.unshift({ type: 'card', title: c.cards[0].title, subtitle: c.cards[0].subtitle, image: okImg(c.cards[0].image), actions: c.cards[0].actions.map(act) });
  if (c.buttons.length) blocks.push({ type: 'buttons', layout: 'vertical', actions: c.buttons.slice(0, WEB_LIMITS.buttons).map(act) });
  if (c.chips.length) blocks.push({ type: 'chips', placement: 'sticky-bottom', actions: c.chips.slice(0, WEB_LIMITS.chips).map(act) });
  return { blocks, degraded };
}

// ---------- Zalo Bot (text only) ----------
export function toZaloText(plan) {
  const c = collect(plan);
  const acts = [...c.cards.flatMap((k) => k.actions), ...c.buttons, ...c.chips];
  const lines = [...c.cards.map((k) => k.title + (k.subtitle ? ' — ' + k.subtitle : '')), ...c.texts];
  const menu = acts.map((a, i) => (i + 1) + '. ' + a.label + (a.url ? ': ' + a.url : ''));
  return { text: clip(lines.join('\n') + (menu.length ? '\n\n' + menu.join('\n') + '\n\nBạn gõ số để chọn nhé.' : ''), 2000),
    numberMap: Object.fromEntries(acts.map((a, i) => [String(i + 1), a.payload ?? a.url])) };
}

export function adaptPlan(plan, channel, opts) {
  if (channel === 'messenger') return { messages: plan.messages, degraded: plan.degraded ?? [] };
  if (channel === 'telegram') return toTelegram(plan);
  if (channel === 'web') return toWebWidget(plan, opts);
  return toZaloText(plan);
}

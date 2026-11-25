// TIEN404 Demo page: wires the scripted sales bot to the shared web card renderer + style controls.
import { renderBlocks, applyTheme } from './widget-blocks.js';
import { normalizeCardStyle, toCssVars } from './card-style.mjs';
import { greeting, reply } from './shop-bot.mjs';

const root = document.querySelector('[data-shop-demo]');
if (root) {
  const log = root.querySelector('.sd-log');
  const form = root.querySelector('.sd-form');
  const input = form.querySelector('input');
  const controls = document.querySelector('[data-shop-style]');
  const turns = []; // {me:text} | {bot:input|null}
  let style = normalizeCardStyle({}).style;

  const readStyle = () => {
    if (!controls) return normalizeCardStyle({}).style;
    const v = (n) => controls.querySelector('[name="' + n + '"]:checked')?.value;
    const show = {};
    controls.querySelectorAll('[name="show"]').forEach((c) => { show[c.value] = c.checked; });
    return normalizeCardStyle({ primary: v('primary'), size: v('size'), shape: v('shape'), variant: v('variant'), layout: v('layout'), animation: v('animation'), image_ratio: v('image_ratio'), show }).style;
  };
  const theme = () => ({ vars: toCssVars(style), variant: style.variant, layout: style.layout, animation: style.animation, card: style.card, image_ratio: style.image_ratio });

  const onAction = (payload, label) => { turns.push({ me: label }, { bot: payload }); draw(true); };
  const blocksFor = (t) => (t.bot === null ? greeting() : reply(t.bot, style));
  const renderTurn = (t, into) => {
    if (t.me != null) { const p = document.createElement('p'); p.className = 't4-bubble t4-me'; p.textContent = t.me; into.append(p); return; }
    const box = document.createElement('div'); box.className = 'sd-turn';
    renderBlocks(box, blocksFor(t), { onAction: (payload) => onAction(payload, labelOf(box, payload)) });
    into.append(box);
  };
  // Button label shown as the visitor's bubble (looked up from the rendered turn, never from payload text).
  const labels = new Map();
  const labelOf = (_box, payload) => labels.get(payload) ?? 'Đã chọn';
  const remember = (blocks) => {
    for (const b of blocks) for (const a of [...(b.actions ?? []), ...(b.items ?? []).flatMap((i) => i.actions ?? [])]) if (a.payload) labels.set(a.payload, a.label);
  };

  function draw(onlyLast) {
    applyTheme(log, theme());
    if (!onlyLast) log.replaceChildren();
    const start = onlyLast ? turns.length - 2 : 0;
    for (let i = Math.max(0, start); i < turns.length; i++) { if (turns[i].bot !== undefined) remember(blocksFor(turns[i])); renderTurn(turns[i], log); }
    // Only the newest bot turn keeps live chips/buttons, like a real chat.
    const all = log.querySelectorAll('.sd-turn');
    all.forEach((t, i) => t.classList.toggle('sd-old', i < all.length - 1));
    log.scrollTop = log.scrollHeight;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim().slice(0, 200);
    if (!text) return;
    input.value = '';
    turns.push({ me: text }, { bot: text });
    draw(true);
  });
  root.querySelector('[data-sd-reset]')?.addEventListener('click', () => { turns.length = 0; turns.push({ bot: null }); draw(false); });
  controls?.addEventListener('change', () => { style = readStyle(); draw(false); });

  style = readStyle();
  turns.push({ bot: null });
  draw(false);
}

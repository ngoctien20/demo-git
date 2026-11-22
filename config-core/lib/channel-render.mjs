// TIEN404 Channel Renderer + inbound menu resolver (pure, no I/O).
// One published Assistant config -> what each channel can actually show. Channels differ
// (button count, label length, persistent menu, links), so every render reports which items were
// shown, which were degraded (warnings) and which are unsupported, instead of assuming parity.

import { ACTION_REGISTRY, HANDOFF_DEFAULT_ACK } from './action-registry.mjs';

export const PAYLOAD_PREFIX = 'T404:M:';

// Capabilities as VERIFIED in this repo / live tests (see docs/config-core/PHASE0_AUDIT.md).
// verified:false = adapter not live-tested for menus; render is a safe text fallback only.
export const CHANNEL_CAPS = Object.freeze({
  messenger: { mode: 'buttons', persistentMenu: true, maxPersistent: 20, persistentLabel: 30, maxQuick: 13, quickLabel: 20, links: true, verified: true },
  web: { mode: 'buttons', persistentMenu: false, maxButtons: 12, buttonLabel: 40, links: true, verified: true },
  telegram: { mode: 'text', links: true, verified: true },
  zalo_bot: { mode: 'text', links: true, verified: true },
  zalo_oa: { mode: 'text', links: true, verified: false },
});

const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + '…');

// Items the customer may see on this channel, in owner order. Overrides never change the action.
export function visibleItems(config, channel) {
  return (config.menu ?? [])
    .map((it) => {
      const o = it.channel_overrides?.[channel] ?? {};
      return { ...it, label: o.label ?? it.label, enabled: o.enabled ?? it.enabled };
    })
    .filter((it) => it.enabled === true && ACTION_REGISTRY[it.action_type]?.status === 'released')
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}

export function render(config, channel) {
  const caps = CHANNEL_CAPS[channel];
  if (!caps) return { channel, supported: false, reason: 'channel_unknown' };
  const items = visibleItems(config, channel);
  const warnings = [];
  const unsupported = [];
  const out = { channel, verified: caps.verified, mode: caps.mode, greeting: config.greeting, warnings, unsupported };
  if (!caps.links) for (const it of items) if (it.action_type === 'OPEN_LINK') unsupported.push({ id: it.id, reason: 'links_not_supported' });
  const shown = items.filter((it) => !unsupported.some((u) => u.id === it.id));

  if (channel === 'messenger') {
    if (shown.length > caps.maxPersistent) warnings.push({ code: 'too_many_items', limit: caps.maxPersistent });
    const menuItems = shown.slice(0, caps.maxPersistent);
    out.persistent_menu = [{
      locale: 'default',
      composer_input_disabled: false,
      call_to_actions: menuItems.map((it) => {
        if (it.label.length > caps.persistentLabel) warnings.push({ id: it.id, code: 'label_truncated', limit: caps.persistentLabel });
        const title = clip(it.label, caps.persistentLabel);
        const url = it.action_config?.url;
        return (it.action_type === 'OPEN_LINK' || it.action_type === 'SHOW_PLAYLIST') && url
          ? { type: 'web_url', title, url }
          : { type: 'postback', title, payload: PAYLOAD_PREFIX + it.id };
      }),
    }];
    // Quick replies cannot open links: link items stay in the persistent menu only.
    const qrItems = shown.filter((it) => it.action_type !== 'OPEN_LINK').slice(0, caps.maxQuick);
    out.greeting_message = {
      text: config.greeting,
      quick_replies: qrItems.map((it) => {
        if (it.label.length > caps.quickLabel) warnings.push({ id: it.id, code: 'quick_label_truncated', limit: caps.quickLabel });
        return { content_type: 'text', title: clip(it.label, caps.quickLabel), payload: PAYLOAD_PREFIX + it.id };
      }),
    };
    out.shown = menuItems.map((it) => it.id);
    return out;
  }
  if (channel === 'web') {
    if (shown.length > caps.maxButtons) warnings.push({ code: 'too_many_items', limit: caps.maxButtons });
    out.buttons = shown.slice(0, caps.maxButtons).map((it) => (it.action_type === 'OPEN_LINK'
      ? { kind: 'link', label: clip(it.label, caps.buttonLabel), url: it.action_config.url }
      : { kind: 'action', label: clip(it.label, caps.buttonLabel), payload: PAYLOAD_PREFIX + it.id }));
    out.shown = shown.slice(0, caps.maxButtons).map((it) => it.id);
    return out;
  }
  // Text-only fallback: numbered list, customer replies with the number. Same actions, no buttons.
  const lines = shown.map((it, i) => (i + 1) + '. ' + it.label + (it.action_type === 'OPEN_LINK' ? ': ' + it.action_config.url : ''));
  out.text = config.greeting + (lines.length ? '\n\n' + lines.join('\n') + '\n\nBạn gõ số để chọn nhé.' : '');
  out.number_map = Object.fromEntries(shown.map((it, i) => [String(i + 1), it.id]));
  out.shown = shown.map((it) => it.id);
  return out;
}

// Payloads that live Messenger (Z7Fd d1ec9147) already sends. They keep their CURRENT behaviour;
// the resolver only labels them so old buttons in customers' threads never break.
export const LEGACY_PAYLOADS = Object.freeze({
  'TIEN404:START': { action_type: 'GREETING' },
  'TIEN404:ASK:catalog': { action_type: 'SHOW_CATALOG' },
  'TIEN404:ASK:ao': { action_type: 'SHOW_CATALOG', category: 'ao' },
  'TIEN404:ASK:quan': { action_type: 'SHOW_CATALOG', category: 'quan' },
  'TIEN404:ASK:order': { action_type: 'ORDER_LOOKUP' },
  'TIEN404:ASK:human': { action_type: 'HUMAN_HANDOFF', team: 'sales' },
});

// Server-side resolution of a customer tap / reply. The payload only names an item id; action type
// and config are always read from the PUBLISHED config the server resolved for this tenant/channel.
export function resolveInbound({ channel, payload, text, numberMap }, config) {
  if (typeof payload === 'string' && payload.length <= 1000) {
    if (payload.startsWith(PAYLOAD_PREFIX)) {
      const id = payload.slice(PAYLOAD_PREFIX.length);
      if (!/^[a-z][a-z0-9_]{1,31}$/.test(id)) return { kind: 'rejected', reason: 'payload_invalid' };
      const item = visibleItems(config, channel).find((it) => it.id === id);
      return item ? actionFor(item) : { kind: 'rejected', reason: 'item_not_active' };
    }
    const view = /^TIEN404:VIEW:([A-Z][0-9]{3})$/.exec(payload);
    if (view) return { kind: 'legacy', action_type: 'PRODUCT_DETAIL', sku: view[1] };
    if (Object.hasOwn(LEGACY_PAYLOADS, payload)) return { kind: 'legacy', ...LEGACY_PAYLOADS[payload] };
    if (payload.startsWith('TIEN404:') || payload.startsWith('T404:')) return { kind: 'rejected', reason: 'payload_unknown' };
  }
  if (numberMap && typeof text === 'string' && /^\s*\d{1,2}\s*$/.test(text)) {
    const id = numberMap[text.trim()];
    const item = id && visibleItems(config, channel).find((it) => it.id === id);
    if (item) return actionFor(item);
  }
  return { kind: 'free_text' };
}

function actionFor(item) {
  const r = { kind: 'menu', item_id: item.id, action_type: item.action_type, action_config: structuredClone(item.action_config ?? {}) };
  if (item.action_type === 'HUMAN_HANDOFF') r.ack_text = item.action_config.ack_text ?? HANDOFF_DEFAULT_ACK[item.action_config.team];
  return r;
}

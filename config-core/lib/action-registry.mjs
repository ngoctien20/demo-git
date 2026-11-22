// TIEN404 Universal Configuration Core — Action Registry + config validator (schema_version 1).
// Pure functions, no I/O. The SAME rules are enforced server-side in
// db/config-core/10_config_core.sql (app_private.t404_cfg_validate); qa/config-core/offline-pg-uat.sh
// checks both sides accept/reject the same fixtures. The database is the authority; this file is
// for previews in the App and for channel adapters.
//
// Security rules (do not relax without review):
//  * The owner chooses an action_type from this registry and fills a small, typed action_config.
//    Unknown keys are REJECTED everywhere, so no tool name, SQL, URL of an API, JS, tenant_id,
//    credential or webhook can ride along in a menu item.
//  * A button label is display text only. The business key is the item `id` (stable_action_id)
//    and the server re-reads the action from the published config; payloads never carry actions.
//  * EXPERIMENTAL actions can be saved in a draft but cannot be published.

export const SCHEMA_VERSION = 1;
export const MAX_MENU_ITEMS = 12;
export const LABEL_MAX = 40;
export const CHANNELS = ['messenger', 'web', 'zalo_bot', 'zalo_oa', 'telegram'];
export const HANDOFF_TEAMS = ['sales', 'page_admin', 'booking', 'consultant', 'support', 'manager'];

// Who the customer is told they will reach. Never promises the artist/owner in person.
export const HANDOFF_DEFAULT_ACK = {
  sales: 'Mình đã chuyển yêu cầu tới nhân viên bán hàng. Nhân viên sẽ trả lời bạn sớm nhất có thể.',
  page_admin: 'Mình đã chuyển yêu cầu tới quản trị viên Fanpage. Quản trị viên sẽ trả lời bạn sớm nhất có thể.',
  booking: 'Mình đã chuyển yêu cầu tới đội ngũ booking. Đội ngũ sẽ liên hệ lại với bạn sớm nhất có thể.',
  consultant: 'Mình đã chuyển yêu cầu tới chuyên viên tư vấn. Chuyên viên sẽ trả lời bạn sớm nhất có thể.',
  support: 'Mình đã chuyển yêu cầu tới bộ phận chăm sóc khách hàng. Bộ phận sẽ trả lời bạn sớm nhất có thể.',
  manager: 'Mình đã chuyển yêu cầu tới đội ngũ quản lý. Đội ngũ quản lý sẽ phản hồi bạn sớm nhất có thể.',
};

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];
const LINK_KIND_HOSTS = {
  youtube: YOUTUBE_HOSTS,
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'm.me'],
  tiktok: ['tiktok.com', 'www.tiktok.com', 'vt.tiktok.com'],
  zalo: ['zalo.me', 'oa.zalo.me'],
  website: null, // any public https host
};

// Templates ship links containing this marker; an ENABLED item with it cannot be published.
export const PLACEHOLDER_MARK = 'THAY-LINK';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;

// https only, public DNS host, no credentials, no port, no IP literal, no localhost/internal names.
// Deliberately NOT new URL(): WHATWG parsing accepts "https:example.com", "\\" etc. The same
// regexes run in SQL (app_private.t404_cfg_url_error) so both sides agree.
export function checkHttpsUrl(raw, allowedHosts = null) {
  if (typeof raw !== 'string' || raw.length > 500) return 'url_invalid';
  if (/^http:\/\//i.test(raw)) return 'url_not_https';
  const m = /^https:\/\/([^/?#\s\\]+)([/?#][^\s\\]*)?$/i.exec(raw);
  if (!m || /[@:]/.test(m[1])) return 'url_invalid';
  const host = m[1].toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^[0-9.]+$/.test(host)) return 'url_host_invalid';
  if (/(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) return 'url_host_invalid';
  if (allowedHosts && !allowedHosts.includes(host)) return 'url_host_not_allowed';
  return null;
}

export function normalizeVnPhone(raw) {
  if (typeof raw !== 'string') return null;
  let d = raw.replace(/[\s.()-]/g, '');
  if (d.startsWith('+84')) d = '0' + d.slice(3);
  else if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
  return /^0[35789][0-9]{8}$/.test(d) || /^02[0-9]{9}$/.test(d) ? d : null;
}

// ---------- registry ----------
// keys: allowed action_config keys -> validator returning error code or null.
const optStr = (max) => (v) => (v === undefined || str(v, 1, max) ? null : 'config_value_invalid');
export const ACTION_REGISTRY = Object.freeze({
  SHOW_CATALOG: { status: 'released', title: 'Hiển thị danh mục', keys: { category: optStr(40) } },
  SHOW_CONTENT: {
    status: 'released', title: 'Hiển thị nội dung',
    keys: { title: optStr(80), text: (v) => (str(v, 1, 1000) ? null : 'content_text_required') },
    required: ['text'],
  },
  SHOW_PROFILE: { status: 'released', title: 'Giới thiệu cá nhân/tổ chức', keys: {} },
  OPEN_LINK: {
    status: 'released', title: 'Mở đường dẫn',
    keys: {
      url: (v) => (v === undefined ? 'url_required' : null),
      link_kind: (v) => (v === undefined || Object.hasOwn(LINK_KIND_HOSTS, v) ? null : 'link_kind_invalid'),
    },
    required: ['url'],
    check: (c) => checkHttpsUrl(c.url, LINK_KIND_HOSTS[c.link_kind ?? 'website']),
  },
  SHOW_PLAYLIST: {
    status: 'released', title: 'Danh sách nhạc/video',
    keys: { url: (v) => (v === undefined ? 'url_required' : null), title: optStr(80) },
    required: ['url'],
    check: (c) => checkHttpsUrl(c.url, YOUTUBE_HOSTS),
  },
  SEARCH_KNOWLEDGE: { status: 'experimental', title: 'Tra cứu kiến thức', keys: {} },
  ORDER_LOOKUP: { status: 'released', title: 'Tra cứu đơn hàng', keys: {} },
  HUMAN_HANDOFF: {
    status: 'released', title: 'Chuyển nhân viên',
    keys: {
      team: (v) => (HANDOFF_TEAMS.includes(v) ? null : 'handoff_team_invalid'),
      ack_text: optStr(300),
    },
    required: ['team'],
  },
  BOOKING_REQUEST: { status: 'experimental', title: 'Tiếp nhận lịch hẹn', keys: { note: optStr(200) } },
  CONTACT_INFO: {
    status: 'released', title: 'Hiển thị liên hệ',
    keys: {
      phone: (v) => (v === undefined || normalizeVnPhone(v) ? null : 'phone_invalid'),
      email: (v) => (v === undefined || (typeof v === 'string' && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ? null : 'email_invalid'),
      address: optStr(200),
      hours: optStr(120),
    },
    check: (c) => (['phone', 'email', 'address', 'hours'].some((k) => c[k] !== undefined) ? null : 'contact_empty'),
  },
  SHOW_SERVICES: {
    status: 'released', title: 'Danh sách dịch vụ',
    keys: {
      items: (v) => {
        if (!Array.isArray(v) || v.length > 20) return 'services_invalid';
        for (const s of v) {
          if (!isObj(s) || Object.keys(s).some((k) => !['name', 'price_vnd', 'note'].includes(k))) return 'services_invalid';
          if (!str(s.name, 1, 80)) return 'services_invalid';
          if (s.price_vnd !== undefined && s.price_vnd !== null && !(Number.isSafeInteger(s.price_vnd) && s.price_vnd >= 0 && s.price_vnd <= 10_000_000_000)) return 'services_invalid';
          if (s.note !== undefined && !str(s.note, 1, 200)) return 'services_invalid';
        }
        return null;
      },
    },
  },
  FAQ: { status: 'released', title: 'Câu hỏi thường gặp', keys: { topic: optStr(60) } },
});

const ROOT_KEYS = ['schema_version', 'greeting', 'addressing', 'profile', 'menu'];
const ITEM_KEYS = ['id', 'action_type', 'label', 'description', 'enabled', 'sort_order', 'action_config', 'channel_overrides'];
const PROFILE_KEYS = ['display_name', 'bio'];

// Returns { ok, errors: [{path, code}] }. mode 'publish' additionally rejects experimental actions
// and requires at least one enabled item.
export function validateConfig(cfg, { mode = 'draft' } = {}) {
  const errors = [];
  const err = (path, code) => errors.push({ path, code });
  if (!isObj(cfg)) return { ok: false, errors: [{ path: '$', code: 'config_not_object' }] };
  for (const k of Object.keys(cfg)) if (!ROOT_KEYS.includes(k)) err(k, 'unknown_key');
  if (cfg.schema_version !== SCHEMA_VERSION) err('schema_version', 'schema_version_unsupported');
  if (!str(cfg.greeting, 1, 640)) err('greeting', 'greeting_invalid');
  if (cfg.addressing !== undefined) {
    if (!isObj(cfg.addressing)) err('addressing', 'addressing_invalid');
    else {
      for (const k of Object.keys(cfg.addressing)) if (!['self', 'customer'].includes(k)) err('addressing.' + k, 'unknown_key');
      for (const k of ['self', 'customer']) if (cfg.addressing[k] !== undefined && !str(cfg.addressing[k], 1, 20)) err('addressing.' + k, 'addressing_invalid');
    }
  }
  if (cfg.profile !== undefined) {
    if (!isObj(cfg.profile)) err('profile', 'profile_invalid');
    else {
      for (const k of Object.keys(cfg.profile)) if (!PROFILE_KEYS.includes(k)) err('profile.' + k, 'unknown_key');
      if (cfg.profile.display_name !== undefined && !str(cfg.profile.display_name, 1, 100)) err('profile.display_name', 'profile_invalid');
      if (cfg.profile.bio !== undefined && !str(cfg.profile.bio, 1, 1000)) err('profile.bio', 'profile_invalid');
    }
  }
  if (!Array.isArray(cfg.menu)) { err('menu', 'menu_invalid'); return { ok: false, errors }; }
  if (cfg.menu.length > MAX_MENU_ITEMS) err('menu', 'menu_too_long');
  const ids = new Set();
  cfg.menu.forEach((it, i) => {
    const p = 'menu[' + i + ']';
    if (!isObj(it)) { err(p, 'item_invalid'); return; }
    for (const k of Object.keys(it)) if (!ITEM_KEYS.includes(k)) err(p + '.' + k, 'unknown_key');
    if (typeof it.id !== 'string' || !/^[a-z][a-z0-9_]{1,31}$/.test(it.id)) err(p + '.id', 'item_id_invalid');
    else if (ids.has(it.id)) err(p + '.id', 'item_id_duplicate');
    else ids.add(it.id);
    const def = Object.hasOwn(ACTION_REGISTRY, it.action_type) ? ACTION_REGISTRY[it.action_type] : null;
    if (!def) err(p + '.action_type', 'action_type_unknown');
    else if (mode === 'publish' && def.status !== 'released' && it.enabled !== false) err(p + '.action_type', 'action_not_released');
    if (mode === 'publish' && it.enabled === true && isObj(it.action_config) && typeof it.action_config.url === 'string'
      && it.action_config.url.includes(PLACEHOLDER_MARK)) err(p + '.action_config.url', 'url_placeholder');
    if (!str(it.label, 1, LABEL_MAX)) err(p + '.label', 'label_invalid');
    if (it.description !== undefined && !str(it.description, 1, 120)) err(p + '.description', 'description_invalid');
    if (typeof it.enabled !== 'boolean') err(p + '.enabled', 'enabled_invalid');
    if (!Number.isSafeInteger(it.sort_order) || it.sort_order < 0 || it.sort_order > 1000) err(p + '.sort_order', 'sort_order_invalid');
    const c = it.action_config ?? {};
    if (!isObj(c)) err(p + '.action_config', 'action_config_invalid');
    else if (def) {
      for (const k of Object.keys(c)) if (!Object.hasOwn(def.keys, k)) err(p + '.action_config.' + k, 'unknown_key');
      for (const k of def.required ?? []) if (c[k] === undefined) err(p + '.action_config.' + k, 'required');
      for (const [k, fn] of Object.entries(def.keys)) if (c[k] !== undefined) { const e = fn(c[k]); if (e) err(p + '.action_config.' + k, e); }
      if (def.check && errors.every((e) => !e.path.startsWith(p + '.action_config'))) { const e = def.check(c); if (e) err(p + '.action_config', e); }
    }
    if (it.channel_overrides !== undefined) {
      if (!isObj(it.channel_overrides)) err(p + '.channel_overrides', 'overrides_invalid');
      else for (const [ch, o] of Object.entries(it.channel_overrides)) {
        if (!CHANNELS.includes(ch)) { err(p + '.channel_overrides.' + ch, 'channel_unknown'); continue; }
        if (!isObj(o)) { err(p + '.channel_overrides.' + ch, 'overrides_invalid'); continue; }
        for (const k of Object.keys(o)) if (!['label', 'enabled'].includes(k)) err(p + '.channel_overrides.' + ch + '.' + k, 'unknown_key');
        if (o.label !== undefined && !str(o.label, 1, LABEL_MAX)) err(p + '.channel_overrides.' + ch + '.label', 'label_invalid');
        if (o.enabled !== undefined && typeof o.enabled !== 'boolean') err(p + '.channel_overrides.' + ch + '.enabled', 'enabled_invalid');
      }
    }
  });
  if (mode === 'publish' && !cfg.menu.some((it) => isObj(it) && it.enabled === true)) err('menu', 'menu_no_enabled_item');
  return { ok: errors.length === 0, errors };
}

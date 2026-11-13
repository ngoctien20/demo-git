/** TIEN404 AI V11.5 - notification V5 pure policy contract.
 * Review-only / no IO, no credentials, no messaging. Production routing must
 * rederive tenant and owner identity from an authenticated server session.
 */
'use strict';

const CHANNELS = Object.freeze(['zalo', 'telegram', 'gmail', 'messenger', 'dashboard']);
const EXTERNAL = Object.freeze(CHANNELS.filter(c => c !== 'dashboard'));
const MODES = Object.freeze(['single', 'parallel', 'fallback']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function nonblank(value, max = 160) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}
function money(value) {
  return Number.isSafeInteger(value) && value > 0;
}
function validateSavedOrder(event) {
  if (!event || typeof event !== 'object') fail('EVENT_REQUIRED');
  if (event.event_type !== 'order_created' || event.event_version !== 1) fail('EVENT_TYPE_UNSUPPORTED');
  for (const key of ['tenant_id', 'store_id', 'merchant_id', 'order_id', 'source_receipt_ref']) {
    if (!nonblank(event[key])) fail('EVENT_FIELD_INVALID_' + key.toUpperCase());
  }
  if (event.saved_order_verified !== true) fail('ORDER_NOT_VERIFIED');
  if (event.customer_confirmed !== true) fail('CUSTOMER_NOT_CONFIRMED');
  if (event.status !== 'pending') fail('ORDER_STATUS_INVALID');
  if (!money(event.quantity) || !money(event.unit_price) || !money(event.total) ||
      event.quantity * event.unit_price !== event.total) fail('ORDER_AMOUNT_INVALID');
  const expected = [event.tenant_id, event.store_id, event.order_id, 'order_created', 'v1'].join(':');
  if (event.event_id !== expected || event.event_id.length > 512) fail('EVENT_ID_INVALID');
  return Object.freeze({
    tenant_id: event.tenant_id, store_id: event.store_id,
    merchant_id: event.merchant_id, order_id: event.order_id,
    event_id: event.event_id, event_type: event.event_type,
    source_receipt_ref: event.source_receipt_ref, total: event.total
  });
}

function channelEligibility(channel, settings, nowIso) {
  if (!CHANNELS.includes(channel)) return { allowed: false, reason: 'UNKNOWN_CHANNEL' };
  if (channel === 'dashboard') return { allowed: true, reason: 'INTERNAL_ONLY' };
  if (!settings || settings.enabled !== true) return { allowed: false, reason: 'CHANNEL_DISABLED' };
  if (settings.owner_verified !== true || settings.consent !== true ||
      settings.recipient_verified !== true) return { allowed: false, reason: 'RECIPIENT_NOT_VERIFIED' };
  if (!nonblank(settings.recipient_ref, 240)) return { allowed: false, reason: 'RECIPIENT_MISSING' };
  if (channel === 'zalo') {
    if (settings.oa_status !== 'connected' || settings.api_permission_verified !== true)
      return { allowed: false, reason: 'ZALO_OA_NOT_AUTHORIZED' };
    // A technical preview is not an assertion that Zalo policy permits any message.
    if (settings.message_policy_approved !== true || settings.template_approved !== true)
      return { allowed: false, reason: 'ZALO_POLICY_NOT_APPROVED' };
    if (settings.billing_approved !== true || !Number.isSafeInteger(settings.estimated_cost_vnd) ||
        !Number.isSafeInteger(settings.cost_ceiling_vnd) || settings.estimated_cost_vnd < 0 ||
        settings.estimated_cost_vnd > settings.cost_ceiling_vnd)
      return { allowed: false, reason: 'ZALO_COST_NOT_APPROVED' };
  } else if (channel === 'telegram') {
    if (!/^\d{5,20}$/.test(settings.recipient_ref))
      return { allowed: false, reason: 'TELEGRAM_CHAT_ID_INVALID' };
  } else if (channel === 'gmail') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.recipient_ref))
      return { allowed: false, reason: 'GMAIL_ADDRESS_INVALID' };
  } else if (channel === 'messenger') {
    if (settings.meta_page_verified !== true || !/^\d{6,25}$/.test(settings.recipient_ref))
      return { allowed: false, reason: 'META_PSID_OR_PAGE_INVALID' };
    if (settings.meta_policy_approved !== true || settings.inbound_hmac_verified !== true)
      return { allowed: false, reason: 'META_POLICY_NOT_VERIFIED' };
    const now = Date.parse(nowIso);
    const last = Date.parse(settings.last_interaction_utc);
    if (!Number.isFinite(now) || !Number.isFinite(last) || last > now ||
        now - last >= 24 * 3600 * 1000)
      return { allowed: false, reason: 'META_INTERACTION_WINDOW_CLOSED' };
  }
  return { allowed: true, reason: 'ELIGIBLE_FOR_PREVIEW_ONLY' };
}

function prepareNotificationPlan(event, channels, options = {}) {
  const order = validateSavedOrder(event);
  if (!Array.isArray(channels) || channels.length > CHANNELS.length) fail('CHANNEL_SETTINGS_INVALID');
  if (!MODES.includes(options.mode)) fail('ROUTING_MODE_INVALID');
  if (!nonblank(options.authenticated_tenant_id) ||
      options.authenticated_tenant_id !== order.tenant_id) fail('TENANT_AUTH_FAILED');
  if (!nonblank(options.authenticated_merchant_id) ||
      options.authenticated_merchant_id !== order.merchant_id) fail('MERCHANT_AUTH_FAILED');
  const names = new Set();
  const eligible = [], blocked = [];
  const byChannel = new Map();
  for (const c of channels) {
    if (!c || !CHANNELS.includes(c.channel)) fail('CHANNEL_NAME_INVALID');
    if (names.has(c.channel)) fail('DUPLICATE_CHANNEL_CONFIGURATION');
    names.add(c.channel);
    if (c.tenant_id !== order.tenant_id || c.store_id !== order.store_id ||
        c.merchant_id !== order.merchant_id) fail('CROSS_TENANT_RECIPIENT');
    const policy = channelEligibility(c.channel, c, options.now_iso);
    byChannel.set(c.channel, c);
    if (policy.allowed) eligible.push(c.channel);
    else blocked.push({ channel: c.channel, reason: policy.reason });
  }
  const selected = eligible.filter(c => EXTERNAL.includes(c));
  const primary = options.primary_channel;
  if (primary && !CHANNELS.includes(primary)) fail('PRIMARY_CHANNEL_INVALID');
  let destinations = [];
  if (options.mode === 'single') {
    if (primary && selected.includes(primary)) destinations = [primary];
    else if (!primary && selected.length) destinations = [selected[0]];
  } else if (options.mode === 'parallel') {
    destinations = selected;
  } else {
    if (primary && selected.includes(primary)) destinations = [primary];
    else if (!primary && selected.length) destinations = [selected[0]];
  }
  const routing = destinations.map(channel => Object.freeze({
    channel, tenant_id: order.tenant_id, store_id: order.store_id,
    merchant_id: order.merchant_id, order_id: order.order_id,
    event_id: order.event_id, idempotency_key: order.event_id + ':' + channel,
    recipient_ref: byChannel.get(channel).recipient_ref,
    status: 'proposed_only'
  }));
  return Object.freeze({
    mode: options.mode, primary: primary || null, event_id: order.event_id,
    routes: routing, eligible_channels: selected, blocked, dashboard_inbox: true, no_external_sends: true,
    authorization_source: 'SERVER_SESSION_REQUIRED'
  });
}

function nextFallback(plan, primaryStatus, alternateChannel) {
  if (!plan || plan.mode !== 'fallback') fail('FALLBACK_MODE_REQUIRED');
  if (primaryStatus !== 'failed_definitive') return { allowed: false, reason: 'PRIMARY_NOT_DEFINITIVELY_FAILED' };
  if (!plan.routes.length) return { allowed: false, reason: 'PRIMARY_NOT_SELECTED' };
  const blocked = new Set(plan.blocked.map(x => x.channel));
  if (!EXTERNAL.includes(alternateChannel) || !Array.isArray(plan.eligible_channels) || !plan.eligible_channels.includes(alternateChannel) || blocked.has(alternateChannel) ||
      alternateChannel === plan.routes[0].channel) return { allowed: false, reason: 'FALLBACK_NOT_ELIGIBLE' };
  // Approval and recipient lookup MUST be repeated at dispatch time.
  return { allowed: true, reason: 'RECHECK_POLICY_AND_RECIPIENT_BEFORE_DISPATCH' };
}

module.exports = { CHANNELS, MODES, validateSavedOrder, channelEligibility,
  prepareNotificationPlan, nextFallback };

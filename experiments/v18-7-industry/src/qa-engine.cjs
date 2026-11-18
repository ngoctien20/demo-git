"use strict";

// TIEN404 V18.7 offline QA contract, not production authorization.
// No network, DB, AI, provider send, or commerce write operations exist here.
const READ_TOOLS = Object.freeze(["search_products", "read_price", "check_inventory", "preview_cart", "preview_quote"]);
const FORBIDDEN_TOOLS = Object.freeze(["create_order", "update_order", "cancel_order", "update_stock", "update_debt", "provider_send", "read_private_order", "admin_action"]);
const CHANNELS = Object.freeze(["messenger", "zalo_oa", "website"]);
const TONES = Object.freeze(["friendly", "practical", "professional", "brief"]);
const SKILLS = Object.freeze(["product_lookup", "unit_conversion", "stock_check", "quote_preview", "human_handoff", "specification_clarification"]);
const QA_ACTORS = Object.freeze({
  qa_owner_a: Object.freeze({ tenant_key: "qa_tenant_a", store_key: "qa_store_a", profile_id: "grocery" }),
  qa_owner_b: Object.freeze({ tenant_key: "qa_tenant_b", store_key: "qa_store_b", profile_id: "building_materials" }),
});
const QA_CATALOG = Object.freeze([
  Object.freeze({ origin: "SYNTHETIC_QA", tenant_key: "qa_tenant_a", store_key: "qa_store_a", sku: "QA-G001", price_vnd: 12500, stock_base: 100, units: Object.freeze({ goi: 1, loc: 6, thung: 24 }) }),
  Object.freeze({ origin: "SYNTHETIC_QA", tenant_key: "qa_tenant_b", store_key: "qa_store_b", sku: "QA-B001", price_vnd: 85000, stock_base: 60, units: Object.freeze({ bao: 1 }) }),
]);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const exactKeys = (o, allowed) => plain(o) && Object.keys(o).every((k) => allowed.includes(k) && k !== "__proto__" && k !== "constructor" && k !== "prototype");
const text = (x, n) => typeof x === "string" && x.length > 0 && x.length <= n;
const stringArray = (a, choices, max) => Array.isArray(a) && a.length <= max && new Set(a).size === a.length && a.every((v) => typeof v === "string" && choices.includes(v));
const fail = (code) => ({ ok: false, status: "DENY", code, origin: "SYNTHETIC_QA", canWrite: false, canSend: false });
function validateProfile(p) {
  if (!exactKeys(p, ["schema_version", "id", "version", "stage", "name_vi", "locale", "fields", "skills", "business_rules", "capabilities", "defaults"])) return fail("PROFILE_KEYS_INVALID");
  if (p.schema_version !== "1.0.0" || !["grocery", "building_materials"].includes(p.id) || !/^\d+\.\d+\.\d+$/.test(p.version || "") || p.stage !== "EXPERIMENTAL" || p.locale !== "vi-VN" || !text(p.name_vi, 90)) return fail("PROFILE_VERSION_OR_STAGE_INVALID");
  if (!exactKeys(p.fields, ["product", "customer"]) || !Array.isArray(p.fields.product) || !Array.isArray(p.fields.customer)) return fail("PROFILE_FIELDS_INVALID");
  for (const list of [p.fields.product, p.fields.customer]) {
    if (list.length < 1 || list.length > 24 || new Set(list).size !== list.length || !list.every((s) => typeof s === "string" && /^[a-z][a-z_]{1,40}$/.test(s))) return fail("PROFILE_FIELDS_INVALID");
  }
  if (p.fields.product.length < 4 || !stringArray(p.skills, SKILLS, 12) || p.skills.length < 3) return fail("PROFILE_SKILLS_INVALID");
  if (!exactKeys(p.business_rules, ["price_source", "stock_source", "unknown_price", "unknown_stock", "cross_store", "order_write", "provider_send"]) || p.business_rules.price_source !== "canonical_commerce" || p.business_rules.stock_source !== "canonical_commerce" || ["unknown_price", "unknown_stock", "cross_store", "order_write", "provider_send"].some((k) => p.business_rules[k] !== "DENY")) return fail("PROFILE_BUSINESS_GUARD_INVALID");
  if (!exactKeys(p.capabilities, ["channels", "tools"]) || !stringArray(p.capabilities.channels, CHANNELS, 3) || !p.capabilities.channels.length || !exactKeys(p.capabilities.tools, ["allow", "deny"])) return fail("PROFILE_CAPABILITIES_INVALID");
  if (!stringArray(p.capabilities.tools.allow, READ_TOOLS, READ_TOOLS.length) || !stringArray(p.capabilities.tools.deny, FORBIDDEN_TOOLS, FORBIDDEN_TOOLS.length) || FORBIDDEN_TOOLS.some((k) => !p.capabilities.tools.deny.includes(k))) return fail("PROFILE_TOOL_POLICY_INVALID");
  if (!exactKeys(p.defaults, ["tone", "greeting"]) || !TONES.includes(p.defaults.tone) || !text(p.defaults.greeting, 240)) return fail("PROFILE_DEFAULTS_INVALID");
  return { ok: true, origin: "SYNTHETIC_QA" };
}
function validateOverride(o) {
  if (!exactKeys(o, ["tenant_key", "store_key", "profile_id", "profile_version", "greeting", "tone", "faq", "requested_tools"])) return fail("OVERRIDE_KEYS_INVALID");
  if (![o.tenant_key, o.store_key, o.profile_id, o.profile_version].every((x) => text(x, 64)) || !text(o.greeting, 240) || !TONES.includes(o.tone)) return fail("OVERRIDE_VALUE_INVALID");
  if (!Array.isArray(o.faq) || o.faq.length > 5 || o.faq.some((e) => !exactKeys(e, ["question", "answer"]) || !text(e.question, 180) || !text(e.answer, 400))) return fail("OVERRIDE_FAQ_INVALID");
  if (!stringArray(o.requested_tools, READ_TOOLS, READ_TOOLS.length)) return fail("OVERRIDE_TOOL_ESCALATION");
  return { ok: true, origin: "SYNTHETIC_QA" };
}
function buildQaPreview(input) {
  if (!exactKeys(input, ["actor_key", "channel", "profile", "override"])) return fail("UNTRUSTED_REQUEST_KEYS");
  if (!text(input.actor_key, 64) || !CHANNELS.includes(input.channel)) return fail("REQUEST_INVALID");
  const authority = QA_ACTORS[input.actor_key];
  if (!authority) return fail("UNKNOWN_QA_ACTOR");
  const p = validateProfile(input.profile);
  if (!p.ok) return p;
  const o = validateOverride(input.override);
  if (!o.ok) return o;
  if (authority.profile_id !== input.profile.id || input.override.tenant_key !== authority.tenant_key || input.override.store_key !== authority.store_key || input.override.profile_id !== input.profile.id || input.override.profile_version !== input.profile.version) return fail("STORE_PROFILE_SCOPE_MISMATCH");
  if (!input.profile.capabilities.channels.includes(input.channel)) return fail("CHANNEL_NOT_SUPPORTED");
  const granted = input.override.requested_tools.filter((tool) => input.profile.capabilities.tools.allow.includes(tool) && READ_TOOLS.includes(tool));
  return {
    ok: true, status: "PREVIEW_ONLY", origin: "SYNTHETIC_QA", tenant_key: authority.tenant_key,
    store_key: authority.store_key, profile_id: input.profile.id, profile_version: input.profile.version, channel: input.channel,
    greeting: input.override.greeting, tone: input.override.tone, faq: input.override.faq.map((f) => ({ question: f.question, answer: f.answer })),
    read_tools: granted, policy: { price_source: "canonical_commerce", stock_source: "canonical_commerce", cross_store: "DENY" },
    canWrite: false, canSend: false, canReadPrivateOrder: false, forbidden_tools: FORBIDDEN_TOOLS.slice(),
  };
}
function previewQaQuote(config, request) {
  if (!plain(config) || config.ok !== true || config.status !== "PREVIEW_ONLY" || config.origin !== "SYNTHETIC_QA" || config.canWrite !== false || config.canSend !== false) return fail("NO_TRUSTED_PREVIEW");
  if (!exactKeys(request, ["sku", "quantity", "unit"]) || !text(request.sku, 32) || !text(request.unit, 32) || !Number.isSafeInteger(request.quantity) || request.quantity < 1 || request.quantity > 1000) return fail("INVALID_QUOTE_INPUT");
  if (!Array.isArray(config.read_tools) || !config.read_tools.includes("preview_quote")) return fail("TOOL_NOT_ALLOWED");
  const item = QA_CATALOG.find((r) => r.sku === request.sku && r.tenant_key === config.tenant_key && r.store_key === config.store_key && r.origin === "SYNTHETIC_QA");
  if (!item) return fail("PRODUCT_NOT_IN_STORE");
  if (!own(item.units, request.unit) || !Number.isSafeInteger(item.units[request.unit]) || item.units[request.unit] < 1) return fail("INVALID_UNIT");
  if (!Number.isSafeInteger(item.price_vnd) || item.price_vnd <= 0 || !Number.isSafeInteger(item.stock_base) || item.stock_base < 0) return fail("INVALID_CANONICAL_DATA");
  const baseUnits = BigInt(request.quantity) * BigInt(item.units[request.unit]);
  if (baseUnits > BigInt(item.stock_base)) return fail("INSUFFICIENT_STOCK");
  return { ok: true, status: "QUOTE_PREVIEW_ONLY", origin: "SYNTHETIC_QA", sku: item.sku,
    quantity: request.quantity, unit: request.unit, base_units: baseUnits.toString(),
    total_vnd: (baseUnits * BigInt(item.price_vnd)).toString(), canWrite: false, canSend: false };
}
module.exports = { READ_TOOLS, FORBIDDEN_TOOLS, QA_ACTORS, validateProfile, validateOverride, buildQaPreview, previewQaQuote };

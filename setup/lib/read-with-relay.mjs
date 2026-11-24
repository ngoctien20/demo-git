// TIEN404 Tự dựng trợ lý — TEST-ONLY path: read the price list through an OpenAI-compatible relay
// (AI_PROVIDER="relay", e.g. xingchiapi). Tiến chose this on 2026-11-24 to save cost while there is
// NO real shop data. The relay is a third party that sees everything sent: do not invite real shops
// while this is on; switch back to AI_PROVIDER="anthropic" first.
// Same result shape as readWithClaude: { ok: true, raw } | { ok: false, error }. checkDraft() still
// re-checks every price against the printed text afterwards.
import { DRAFT_SCHEMA } from './draft.mjs';
import { SYSTEM } from './read-with-claude.mjs';

export const RELAY_DEFAULT_MODEL = 'gpt-6.1-sol';

// Base for both endpoints: https://host[/path]/v1
export function relayBase(baseUrl) {
  let u;
  try { u = new URL(String(baseUrl || '')); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  return u.origin + u.pathname.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1';
}
export const relayEndpoint = (baseUrl) => { const b = relayBase(baseUrl); return b && b + '/chat/completions'; };

const systemText = () => SYSTEM + '\n- Trả về DUY NHẤT một object JSON đúng schema sau, không thêm chữ nào khác:\n' + JSON.stringify(DRAFT_SCHEMA);
const askText = (input) => input.image
  ? 'Đây là ảnh bảng giá/menu của cửa hàng. Đọc và điền schema.'
  : 'Văn bản lấy từ trang ' + (input.url || '(chủ shop dán)') + ':\n<nguon>\n' + input.text + '\n</nguon>\nĐọc và điền schema.';
const dataUrl = (img) => 'data:' + img.media_type + ';base64,' + img.data;

// Responses API (what Codex-style relays serve). json_object so any model works; schema is in the prompt.
// No temperature / max_tokens: reasoning models reject them.
export function buildResponsesRequest(input, model = RELAY_DEFAULT_MODEL) {
  const content = [{ type: 'input_text', text: askText(input) }];
  if (input.image) content.push({ type: 'input_image', image_url: dataUrl(input.image) });
  return { model, instructions: systemText(), input: [{ role: 'user', content }], text: { format: { type: 'json_object' } }, max_output_tokens: 16000, store: false };
}

// Chat Completions fallback for relays without /responses.
export function buildRelayRequest(input, model = RELAY_DEFAULT_MODEL) {
  const content = input.image
    ? [{ type: 'text', text: askText(input) }, { type: 'image_url', image_url: { url: dataUrl(input.image) } }]
    : askText(input);
  return { model, max_completion_tokens: 16000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: systemText() }, { role: 'user', content }] };
}

const httpError = (status) => (status === 429 ? 'AI_BUSY' : status >= 500 ? 'AI_UNAVAILABLE' : 'AI_REQUEST_REJECTED');
const parseJson = (t) => {
  const text = String(t ?? '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try { return { ok: true, raw: JSON.parse(text) }; } catch { return { ok: false, error: 'AI_BAD_JSON' }; }
};

// Cloudflare Workers only support redirect 'follow' | 'manual' ('error' throws before sending),
// so use 'manual' and treat any 3xx as a failure. On a network error keep only the error kind
// (name + short message, no URL/key) so the App can show why.
async function post(fetchImpl, url, apiKey, payload) {
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
      body: JSON.stringify(payload),
      redirect: 'manual',
      signal: AbortSignal.timeout(100_000),
    });
    if (res.status >= 300 && res.status < 400) return { status: res.status, ok: false, body: null, why: 'redirect' };
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON error page */ }
    return { status: res.status, ok: res.ok, body };
  } catch (e) {
    const why = (String(e?.name || 'Error') + ': ' + String(e?.message || '')).replace(/https?:\/\/\S+|sk-[\w-]+/g, '…').slice(0, 120);
    return { status: 0, ok: false, body: null, why };
  }
}

function fromResponses(body) {
  if (body?.status === 'incomplete') return { ok: false, error: body?.incomplete_details?.reason === 'content_filter' ? 'AI_REFUSED' : 'TOO_MANY_ITEMS' };
  const parts = [];
  for (const o of body?.output || []) for (const c of o?.content || []) {
    if (c?.type === 'refusal') return { ok: false, error: 'AI_REFUSED' };
    if (c?.type === 'output_text') parts.push(c.text);
  }
  return parseJson(parts.length ? parts.join('') : body?.output_text);
}

function fromChat(body) {
  const choice = body?.choices?.[0];
  if (choice?.finish_reason === 'length') return { ok: false, error: 'TOO_MANY_ITEMS' };
  if (choice?.message?.refusal) return { ok: false, error: 'AI_REFUSED' };
  return parseJson(choice?.message?.content);
}

// Short, key-free reason from the relay's error body (or the network error) for the owner to see.
function reason(r) {
  const m = r.why || r.body?.error?.message || r.body?.message || (typeof r.body?.error === 'string' ? r.body.error : '');
  return m ? ' (' + String(m).replace(/https?:\/\/\S+|sk-[\w-]+/g, '…').slice(0, 120) + ')' : '';
}

// Try /responses first; if the relay doesn't serve it (400/404/405), use /chat/completions.
// Returns { ok, raw } | { ok: false, error, detail? } (detail = HTTP status only, never the key).
export async function readWithRelay(fetchImpl, { baseUrl, apiKey, model }, input) {
  const base = relayBase(baseUrl);
  if (!base || !apiKey) return { ok: false, error: 'AI_NOT_CONFIGURED' };
  const m = model || RELAY_DEFAULT_MODEL;
  const r1 = await post(fetchImpl, base + '/responses', apiKey, buildResponsesRequest(input, m));
  if (r1.ok) return fromResponses(r1.body);
  if (![400, 403, 404, 405].includes(r1.status)) return { ok: false, error: r1.status ? httpError(r1.status) : 'AI_UNAVAILABLE', detail: 'responses ' + r1.status + reason(r1) };
  const r2 = await post(fetchImpl, base + '/chat/completions', apiKey, buildRelayRequest(input, m));
  if (r2.ok) return fromChat(r2.body);
  return { ok: false, error: r2.status ? httpError(r2.status) : 'AI_UNAVAILABLE', detail: 'responses ' + r1.status + reason(r1) + ', chat ' + r2.status + reason(r2) };
}

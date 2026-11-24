// TIEN404 Tự dựng trợ lý — TEST-ONLY path: read the price list through an OpenAI-compatible relay
// (AI_PROVIDER="relay", e.g. xingchiapi). Tiến chose this on 2026-11-24 to save cost while there is
// NO real shop data. The relay is a third party that sees everything sent: do not invite real shops
// while this is on; switch back to AI_PROVIDER="anthropic" first.
// Same result shape as readWithClaude: { ok: true, raw } | { ok: false, error }. checkDraft() still
// re-checks every price against the printed text afterwards.
import { DRAFT_SCHEMA } from './draft.mjs';
import { SYSTEM } from './read-with-claude.mjs';

export const RELAY_DEFAULT_MODEL = 'gpt-4o-mini';

export function relayEndpoint(baseUrl) {
  let u;
  try { u = new URL(String(baseUrl || '')); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  return u.origin + u.pathname.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1/chat/completions';
}

// json_object (not json_schema) so it works on any model the relay offers; the schema goes in the prompt.
export function buildRelayRequest(input, model = RELAY_DEFAULT_MODEL) {
  const system = SYSTEM + '\n- Trả về DUY NHẤT một object JSON đúng schema sau, không thêm chữ nào khác:\n' + JSON.stringify(DRAFT_SCHEMA);
  const content = input.image
    ? [
        { type: 'text', text: 'Đây là ảnh bảng giá/menu của cửa hàng. Đọc và điền schema.' },
        { type: 'image_url', image_url: { url: 'data:' + input.image.media_type + ';base64,' + input.image.data } },
      ]
    : 'Văn bản lấy từ trang ' + (input.url || '(chủ shop dán)') + ':\n<nguon>\n' + input.text + '\n</nguon>\nĐọc và điền schema.';
  return {
    model,
    temperature: 0,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content }],
  };
}

export async function readWithRelay(fetchImpl, { baseUrl, apiKey, model }, input) {
  const url = relayEndpoint(baseUrl);
  if (!url || !apiKey) return { ok: false, error: 'AI_NOT_CONFIGURED' };
  let res, body;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
      body: JSON.stringify(buildRelayRequest(input, model || RELAY_DEFAULT_MODEL)),
      redirect: 'error',
      signal: AbortSignal.timeout(90_000),
    });
    body = await res.json();
  } catch { return { ok: false, error: 'AI_UNAVAILABLE' }; }
  if (!res.ok) return { ok: false, error: res.status === 429 ? 'AI_BUSY' : res.status >= 500 ? 'AI_UNAVAILABLE' : 'AI_REQUEST_REJECTED' };
  const choice = body?.choices?.[0];
  if (choice?.finish_reason === 'length') return { ok: false, error: 'TOO_MANY_ITEMS' };
  if (choice?.message?.refusal) return { ok: false, error: 'AI_REFUSED' };
  const text = String(choice?.message?.content ?? '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try { return { ok: true, raw: JSON.parse(text) }; } catch { return { ok: false, error: 'AI_BAD_JSON' }; }
}

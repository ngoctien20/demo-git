/* TIEN404 Zalo Hub — thin client for the official Zalo Bot Platform API.
 * Docs (read 2026-11-23): https://bot.zapps.me/docs/call-api/ , /docs/apis/setWebhook/ , /docs/webhook/ , /docs/error-code/
 * The token sits in the URL path, so every error and log line goes through redact().
 */
export const ZALO_API_BASE = 'https://bot-api.zaloplatforms.com';

/** Pull a bot token out of whatever the owner pasted (the whole Zalo message is fine). */
export function extractToken(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/(?:^|[^0-9A-Za-z])(\d{5,20}:[A-Za-z0-9_-]{8,128})(?![A-Za-z0-9_-])/);
  return m ? m[1] : null;
}

export function redact(s) {
  return String(s).replace(/bot\d{5,20}:[A-Za-z0-9_-]+/g, 'bot[REDACTED]').replace(/\d{5,20}:[A-Za-z0-9_-]{8,128}/g, '[REDACTED_TOKEN]');
}

export function last4(token) {
  return typeof token === 'string' && token.length >= 4 ? token.slice(-4) : '????';
}

/**
 * call(fetchImpl, token, method, payload) → { ok, status, result, error_code, description }
 * Never throws with the token in the message.
 */
export async function call(fetchImpl, token, method, payload, timeoutMs = 8000) {
  const url = `${ZALO_API_BASE}/bot${token}/${method}`;
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload || {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    return { ok: false, status: 0, error_code: 0, description: redact(e && e.name ? e.name : 'NETWORK_ERROR') };
  }
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (body && body.ok === true) return { ok: true, status: res.status, result: body.result };
  return {
    ok: false,
    status: res.status,
    error_code: Number(body && body.error_code) || res.status,
    description: redact((body && body.description) || 'ZALO_ERROR'),
  };
}

export const getMe = (f, token) => call(f, token, 'getMe');
export const setWebhook = (f, token, url, secretToken) => call(f, token, 'setWebhook', { url, secret_token: secretToken }, 15000);
export const deleteWebhook = (f, token) => call(f, token, 'deleteWebhook');
export const sendMessage = (f, token, chatId, text, textStyles) =>
  call(f, token, 'sendMessage', textStyles && textStyles.length ? { chat_id: chatId, text, text_styles: textStyles } : { chat_id: chatId, text });
export const sendChatAction = (f, token, chatId, action = 'typing') => call(f, token, 'sendChatAction', { chat_id: chatId, action }, 1500);

// TIEN404 Tự dựng trợ lý — read the visible text of a PUBLIC web page the owner pasted.
// Safety: https only, no IPs / localhost / internal names, no login in the URL, max 2 redirects
// (each re-checked), 8 s timeout, max 500 KB, HTML/text only. Scripts and styles are dropped.

export const MAX_BYTES = 500_000;
export const MAX_TEXT = 20_000;

// Facebook/Instagram/TikTok pages need login to read; we never scrape them.
const LOGIN_WALLED = /(^|\.)(facebook\.com|fb\.com|fb\.me|m\.me|instagram\.com|tiktok\.com|zalo\.me)$/i;

export function checkUrl(input) {
  let u;
  try { u = new URL(String(input ?? '').trim()); } catch { return { ok: false, error: 'BAD_URL' }; }
  if (u.protocol !== 'https:') return { ok: false, error: 'HTTPS_ONLY' };
  if (u.username || u.password) return { ok: false, error: 'NO_CREDENTIALS_IN_URL' };
  if (u.port && u.port !== '443') return { ok: false, error: 'PORT_NOT_ALLOWED' };
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (/^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return { ok: false, error: 'IP_NOT_ALLOWED' };
  if (!h.includes('.') || /(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|invalid|arpa)$/.test(h)) return { ok: false, error: 'HOST_NOT_ALLOWED' };
  if (LOGIN_WALLED.test(h)) return { ok: false, error: 'LOGIN_WALLED', hint: 'Trang Facebook/Instagram/TikTok cần đăng nhập. Anh/chị chụp màn hình bảng giá rồi gửi ảnh nhé.' };
  u.hash = '';
  return { ok: true, url: u.toString() };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return n > 31 && n < 0x110000 ? String.fromCodePoint(n) : ' '; }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t\r\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    .slice(0, MAX_TEXT);
}

export async function fetchPageText(input, fetchImpl = fetch) {
  let chk = checkUrl(input);
  if (!chk.ok) return chk;
  for (let hop = 0; hop <= 2; hop++) {
    let r;
    try {
      r = await fetchImpl(chk.url, { redirect: 'manual', headers: { accept: 'text/html,text/plain;q=0.9', 'user-agent': 'TIEN404-setup/1.0' }, signal: AbortSignal.timeout(8000) });
    } catch { return { ok: false, error: 'FETCH_FAILED' }; }
    if (r.status >= 300 && r.status < 400) {
      chk = checkUrl(new URL(r.headers.get('location') || '', chk.url).toString());
      if (!chk.ok) return chk;
      continue;
    }
    if (!r.ok) return { ok: false, error: 'HTTP_' + r.status };
    const type = (r.headers.get('content-type') || '').toLowerCase();
    if (!/^text\/(html|plain)|^application\/xhtml\+xml/.test(type)) return { ok: false, error: 'NOT_A_WEB_PAGE' };
    if (Number(r.headers.get('content-length')) > MAX_BYTES) return { ok: false, error: 'PAGE_TOO_LARGE' };
    const reader = r.body?.getReader?.();
    let html = '';
    if (reader) {
      const dec = new TextDecoder();
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { try { await reader.cancel(); } catch {} return { ok: false, error: 'PAGE_TOO_LARGE' }; }
        html += dec.decode(value, { stream: true });
      }
    } else {
      html = await r.text();
      if (html.length > MAX_BYTES) return { ok: false, error: 'PAGE_TOO_LARGE' };
    }
    const text = type.includes('html') ? htmlToText(html) : html.slice(0, MAX_TEXT);
    return text.length < 30 ? { ok: false, error: 'PAGE_EMPTY' } : { ok: true, url: chk.url, text };
  }
  return { ok: false, error: 'TOO_MANY_REDIRECTS' };
}

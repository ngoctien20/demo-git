#!/usr/bin/env node
/* Đổi hai mã của một shop trên Zalo Hub (mã cũ hết hiệu lực ngay) — chạy TRÊN MÁY ANH TIẾN.
 *
 *   ZH_BASE_URL=https://<hub-host>  ZH_ADMIN_KEY=<admin key>  node tools/rotate-qa.mjs --connection <connection_id>
 *
 * In ra 2 mã mới, chỉ một lần:
 *   inbound_key → credential của node Webhook n8n: Name "x-tien404-inbound-key", Value = mã.
 *   forward_key → credential của node gửi tin:     Name "Authorization", Value = "Bearer " + mã.
 * Từ lúc chạy đến lúc lưu xong 2 credential, bot không trả lời được (tin khách vẫn tới, n8n từ chối).
 */
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const conn = opt('--connection') || '';
const base = (process.env.ZH_BASE_URL || '').replace(/\/+$/, '');
const adminKey = process.env.ZH_ADMIN_KEY || '';
function fail(msg) { console.error('Lỗi: ' + msg); process.exit(1); }
if (!/^https:\/\/[^/]+$/.test(base)) fail('thiếu ZH_BASE_URL (https://...)');
if (adminKey.length < 32) fail('thiếu ZH_ADMIN_KEY');
if (!/^[0-9a-f]{32}$/.test(conn)) fail('thiếu --connection <connection_id 32 ký tự>');
if (args.includes('--dry-run')) { console.log('Dry-run OK:', { base, conn }); process.exit(0); }

const res = await fetch(base + '/v1/admin/rotate-keys', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + adminKey },
  body: JSON.stringify({ connection_id: conn }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok || !body.ok) fail(`hub trả ${res.status} ${body.error || ''}`);
console.log(`\nĐã đổi mã cho shop ${body.store_id}. Mã cũ hết hiệu lực. Hai mã mới chỉ hiện lần này:`);
console.log(`\n1) inbound_key → credential Webhook (Name: x-tien404-inbound-key):\n   ${body.inbound_key}`);
console.log(`\n2) forward_key → credential gửi tin (Name: Authorization, Value: Bearer + dấu cách + mã):\n   ${body.forward_key}`);

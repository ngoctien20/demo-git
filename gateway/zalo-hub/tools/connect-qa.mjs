#!/usr/bin/env node
/* Nối bot Zalo QA vào Zalo Hub — chạy TRÊN MÁY ANH TIẾN, không chạy trong CI hay chat.
 *
 *   ZH_BASE_URL=https://<hub-host>  ZH_ADMIN_KEY=<admin key>  node tools/connect-qa.mjs \
 *     --store qa-zalo-bot --forward https://ngoctien20.app.n8n.cloud/webhook/<qa-path> [--manual]
 *
 * - Mã bot (token) được hỏi ẩn trên terminal (không hiện chữ, không vào lịch sử shell, không ghi file).
 *   Có thể dán nguyên tin nhắn Zalo chứa token.
 * - In ra: tên bot, 4 ký tự cuối token, mã ghép 6 số, và forward_key (chỉ hiện 1 lần → dán vào
 *   credential n8n "TIEN404_ZALO_HUB_FORWARD_KEY_QA", rồi xoá khỏi màn hình).
 * - --manual: không gọi setWebhook; in Webhook URL + Secret Token để dán tay vào Zalo Bot Creator.
 * - --dry-run: chỉ kiểm tra tham số, không gọi mạng.
 */
import { createInterface } from 'node:readline';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const store = opt('--store') || 'qa-zalo-bot';
const forward = opt('--forward');
const manual = args.includes('--manual');
const dry = args.includes('--dry-run');
const base = (process.env.ZH_BASE_URL || '').replace(/\/+$/, '');
const adminKey = process.env.ZH_ADMIN_KEY || '';

function fail(msg) { console.error('Lỗi: ' + msg); process.exit(1); }
if (!/^https:\/\/[^/]+$/.test(base)) fail('thiếu ZH_BASE_URL (https://...)');
if (adminKey.length < 32) fail('thiếu ZH_ADMIN_KEY');
if (!forward || !forward.startsWith('https://')) fail('thiếu --forward https://...');
if (dry) { console.log('Dry-run OK:', { base, store, forward, manual }); process.exit(0); }

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.startsWith(question)) process.stdout.write(question); };
    rl.question(question, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}

const tokenText = await askHidden('Dán mã bot Zalo QA (sẽ không hiện ra): ');
if (!/\d{5,20}:[A-Za-z0-9_-]{8,}/.test(tokenText)) fail('không thấy mã bot trong nội dung vừa dán');

const res = await fetch(base + '/v1/admin/connect', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + adminKey },
  body: JSON.stringify({ store_id: store, token_text: tokenText, forward_url: forward, set_webhook: !manual }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok || !body.ok) fail(`hub trả ${res.status} ${body.error || ''} ${body.zalo_error ? 'zalo=' + body.zalo_error : ''} ${body.outcome || ''}`);

console.log(`\nĐã nối: ${body.bot_name} (token …${body.token_last4}) cho shop ${body.store_id}`);
console.log(`connection_id: ${body.connection_id}`);
console.log(`\n>>> Mở Zalo, nhắn vào bot mã ghép: ${body.pairing_code}  (hết hạn ${body.pairing_expires_at})`);
console.log(`\nforward_key (chỉ hiện lần này, dán vào credential n8n rồi xoá màn hình):\n${body.forward_key}`);
if (body.manual_webhook) {
  console.log('\nDán vào Zalo Bot Creator → Thiết lập chung:');
  console.log('  Webhook URL : ' + body.manual_webhook.url);
  console.log('  Secret Token: ' + body.manual_webhook.secret_token);
}

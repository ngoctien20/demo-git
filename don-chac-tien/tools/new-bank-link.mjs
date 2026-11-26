// Tạo đường nhận báo tiền (SePay/Casso) cho MỘT shop. Chạy trên máy Tiến khi shop đã đồng ý nối SePay/Casso.
//   node don-chac-tien/tools/new-bank-link.mjs --store <store_id> --provider sepay
// In ra: câu SQL để chạy bằng `wrangler d1 execute` (chỉ chứa mã băm của khoá) và URL + khoá để dán vào SePay/Casso.
// Khoá thật chỉ hiện MỘT lần trên màn hình, không lưu file.
import { randomBytes, createHash } from 'node:crypto';

const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const store = arg('store'); const provider = arg('provider') || 'sepay'; const base = arg('base') || '<DCT_PUBLIC_BASE>';
if (!/^[A-Za-z0-9_-]{3,64}$/.test(store || '') || !['sepay', 'casso'].includes(provider)) {
  console.error('Cách dùng: --store <store_id> --provider sepay|casso [--base https://...]');
  process.exit(1);
}
const id = randomBytes(16).toString('hex');
const key = randomBytes(24).toString('base64url');
const hash = createHash('sha256').update(key).digest('hex');
console.log(`-- chạy: wrangler d1 execute tien404-don-chac-tien --remote --command "<câu dưới>"`);
console.log(`INSERT INTO bank_links (id, store_id, provider, key_hash, created_at) VALUES ('${id}', '${store}', '${provider}', '${hash}', ${Date.now()});`);
console.log(`\nURL webhook: ${base.replace(/\/+$/, '')}/v1/bank/${provider}/${id}`);
console.log(provider === 'sepay' ? `SePay → Webhooks → Kiểu chứng thực "API Key" → khoá: ${key}` : `Casso → Webhook → Khoá bảo mật (Secure-Token): ${key}`);

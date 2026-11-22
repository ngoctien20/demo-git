// TIEN404 Website V23 static navigation regression (read-only). Run: node scripts/check-site-navigation.mjs
import fs from 'node:fs';
import path from 'node:path';
import { REDIRECTS } from './build-site.mjs';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const pages = fs.readdirSync(path.join(root, 'site-src', 'pages')).filter(f => f.endsWith('.html'));
const expected = ['Trang chủ', 'Ngành nghề', 'Kênh kết nối', 'Bảng giá', 'Dùng thử AI', 'Liên hệ', 'Đăng nhập', 'Dùng thử'];
const errors = [];
for (const p of pages) {
  const html = fs.readFileSync(path.join(root, p), 'utf8');
  const menu = html.match(/<nav class="menu" id="menu" aria-label="Điều hướng chính">[\s\S]*?<\/nav>/)?.[0];
  if (!menu) { errors.push(p + ': navigation missing'); continue; }
  const labels = [...menu.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map(x => x[1].replace(/<[^>]*>/g, '').trim());
  if (JSON.stringify(labels) !== JSON.stringify(expected)) errors.push(p + ': incorrect menu ' + JSON.stringify(labels));
  if (!menu.includes('href="app/#/dang-nhap"') || !menu.includes('href="app/#/dang-ky"')) errors.push(p + ': login/sign-up must open the owner App');
  if (/DEMO \/ SANDBOX|Email demo|Thoát phiên demo|sessionStorage/.test(html)) errors.push(p + ': demo wording resurfaced');
}
for (const [file, [target]] of Object.entries(REDIRECTS)) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  if (!html.includes(`content="0; url=${target}"`) || html.includes('<form')) errors.push(file + ': retired page must only redirect to ' + target);
}
const redirects = fs.readFileSync(path.join(root, '_redirects'), 'utf8');
if (!/^\/login \/app\/#\/dang-nhap 302$/m.test(redirects) || /onrender\.com/.test(redirects)) errors.push('_redirects: /login must go to the owner App');
if (errors.length) { for (const e of errors) console.error('FAIL ' + e); process.exit(1); }
console.log(`PASS ${pages.length} public pages share the V23 navigation; ${Object.keys(REDIRECTS).length} retired demo pages redirect.`);

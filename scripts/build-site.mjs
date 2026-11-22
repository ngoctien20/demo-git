#!/usr/bin/env node
// Builds the TIEN404 public site (V23) from site-src/pages/*.html into the repo root.
// Each page starts with <!--meta {"title":"...","description":"..."}-->.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { render, redirectStub } from '../site-src/layout.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pagesDir = join(root, 'site-src', 'pages');

// Old demo pages → where their real replacement lives now.
export const REDIRECTS = {
  'login.html': ['app/#/dang-nhap', 'trang Đăng nhập'],
  'register.html': ['app/#/dang-ky', 'trang Đăng ký dùng thử'],
  'dashboard.html': ['app/', 'TIEN404 AI Workspace'],
  'onboarding.html': ['app/#/dang-ky', 'trang Đăng ký dùng thử'],
  'checkout.html': ['pricing.html', 'Bảng giá'],
  'billing.html': ['app/#/goi-dich-vu', 'Gói dịch vụ trong App'],
  'invoice.html': ['app/#/goi-dich-vu', 'Gói dịch vụ trong App'],
  'lab.html': ['demo.html', 'Dùng thử AI'],
  'impact.html': ['pricing.html', 'Bảng giá'],
  'solutions.html': ['industries.html', 'Ngành nghề'],
  'industry-fashion.html': ['industries.html#cua-hang', 'Trợ lý AI cho cửa hàng'],
  'industry-beauty.html': ['industries.html#cua-hang', 'Trợ lý AI cho cửa hàng'],
  'industry-accessories.html': ['industries.html#cua-hang', 'Trợ lý AI cho cửa hàng'],
  'industry-ecommerce.html': ['industries.html#cua-hang', 'Trợ lý AI cho cửa hàng'],
  'industry-services.html': ['industries.html#dich-vu', 'Trợ lý AI cho dịch vụ'],
};

export function build() {
  const built = [];
  for (const file of readdirSync(pagesDir).filter(f => f.endsWith('.html')).sort()) {
    const src = readFileSync(join(pagesDir, file), 'utf8');
    const m = src.match(/^<!--meta (\{.*?\})-->\s*/s);
    if (!m) throw new Error(`${file}: missing <!--meta {...}--> header`);
    const meta = JSON.parse(m[1]);
    const slug = file.replace(/\.html$/, '');
    writeFileSync(join(root, file), render({ slug, ...meta, body: src.slice(m[0].length) }));
    built.push(file);
  }
  for (const [file, [target, label]] of Object.entries(REDIRECTS)) {
    writeFileSync(join(root, file), redirectStub(target, label));
  }
  const urls = built.filter(f => f !== '404.html').map(f =>
    `  <url><loc>https://ngoctien20.github.io/demo-git/${f === 'index.html' ? '' : f}</loc></url>`).join('\n');
  writeFileSync(join(root, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  console.log(`built ${built.length} pages, ${Object.keys(REDIRECTS).length} redirect stubs`);
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) build();

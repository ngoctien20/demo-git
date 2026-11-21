// TIEN404 public site layout (V23). Shared header/footer for every generated page.
// Edit pages in site-src/pages/*.html, then run: node scripts/build-site.mjs
export const SITE_URL = 'https://ngoctien20.github.io/demo-git/';
export const APP_URL = 'app/';

const NAV = [
  ['index', 'index.html', 'Trang chủ'],
  ['solutions', 'solutions.html', 'Giải pháp'],
  ['pricing', 'pricing.html', 'Bảng giá'],
  ['demo', 'demo.html', 'Dùng thử AI'],
  ['contact', 'contact.html', 'Liên hệ'],
];

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="url(#lg)"/><path d="M9 11h14M16 11v12M20.5 17.5l3 3m0-3-3 3" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/><defs><linearGradient id="lg" x1="0" y1="0" x2="32" y2="32"><stop stop-color="#4f5cf6"/><stop offset="1" stop-color="#9b3df0"/></linearGradient></defs></svg>`;

export function render({ slug, title, description, body, robots }) {
  const nav = NAV.map(([key, href, label]) =>
    `<a href="${href}"${key === slug ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const canonical = slug === 'index' ? SITE_URL : `${SITE_URL}${slug}.html`;
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${robots ? `<meta name="robots" content="${robots}">\n` : ''}<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#4f5cf6">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/site.css?v=23">
<script defer src="assets/site-config.js?v=23"></script>
<script defer src="assets/site.js?v=23"></script>
</head>
<body data-page="${slug}">
<a class="skip" href="#main">Đi tới nội dung</a>
<header class="topbar">
 <div class="wrap nav">
  <a class="brand" href="index.html" aria-label="TIEN404 AI — Trang chủ">${LOGO}<span>TIEN404<b>AI</b></span></a>
  <nav class="menu" id="menu" aria-label="Điều hướng chính">${nav}
   <span class="menu-cta"><a class="btn btn-ghost" href="${APP_URL}#/dang-nhap">Đăng nhập</a><a class="btn btn-primary" href="${APP_URL}#/dang-ky">Dùng thử</a></span>
  </nav>
  <button class="menu-toggle" type="button" aria-controls="menu" aria-expanded="false" aria-label="Mở menu"><span></span><span></span></button>
 </div>
</header>
<main id="main">
${body.trim()}
</main>
<footer class="footer">
 <div class="wrap footer-grid">
  <div><a class="brand" href="index.html">${LOGO}<span>TIEN404<b>AI</b></span></a>
   <p class="muted">Trợ lý AI bán hàng cho shop nhỏ Việt Nam trên Messenger, Zalo và website.</p></div>
  <div><h2>Sản phẩm</h2><a href="solutions.html">Giải pháp</a><a href="pricing.html">Bảng giá</a><a href="demo.html">Dùng thử AI</a><a href="${APP_URL}">App chủ shop</a></div>
  <div><h2>Công ty</h2><a href="about.html">Giới thiệu</a><a href="faq.html">Câu hỏi thường gặp</a><a href="contact.html">Liên hệ</a></div>
  <div><h2>Pháp lý</h2><a href="terms.html">Điều khoản</a><a href="privacy.html">Quyền riêng tư</a><a href="refund.html">Hoàn phí</a></div>
 </div>
 <div class="wrap footer-bottom muted">© 2026 TIEN404 AI · Đang trong giai đoạn thử nghiệm có giới hạn.</div>
</footer>
<div id="chat-widget"></div>
</body>
</html>
`;
}

export function redirectStub(target, label) {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trang đã chuyển — TIEN404 AI</title><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${target}">
<style>body{font-family:system-ui,sans-serif;margin:40px 16px;color:#1d2033;background:#fff}a{color:#4f5cf6}</style></head>
<body><p>Trang này đã được thay bằng <a href="${target}">${label}</a>.</p></body></html>
`;
}

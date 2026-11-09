# TIEN404 AI — Website SaaS demo + AI Consultant Beta

**Live preview:** https://ngoctien20.github.io/demo-git/

This repository hosts 26 responsive HTML pages, modular Sass/compiled CSS, a browser-only AI Sales Lab, sample account/billing screens, and a dedicated **read-only n8n AI Consultant Beta** for explaining TIEN404 products and guiding visitors to relevant pages.

> **Not a production e-commerce or payment system.** SaaS sign-in, checkout, invoice, analytics and AI Sales Lab are simulations. Contact form submission is disabled on the public GitHub Pages deployment until a separately secured backend is approved. No live orders or payments are processed.

## Run locally

```bash
python -m http.server 8000
# http://localhost:8000/
```

## Development

- HTML: root `*.html` files
- JavaScript: `assets/app.js`, `assets/saas.js`, `assets/v4.js`, `assets/ai-consultant.js`
- Sass source: `src/scss/main.scss` and partials
- Generated CSS: `assets/style.css`

```bash
npm install
npm run build:css
npm run dev:css
```

## Automated quality gates

- `.github/workflows/quality.yml`: Sass build, JavaScript syntax, static links and frontend contracts.
- `.github/workflows/full-browser-audit.yml`: Chromium Playwright E2E, desktop/mobile, demo login/billing, onboarding, AI Sales Lab, serious/critical accessibility checks for 26 pages, a live n8n chat smoke test, screenshots and a human-readable summary.
- CI runs on updates to `gh-pages`; use Actions for results and test artifacts.

## Public AI integration

The AI Consultant Beta is a dedicated n8n workflow `wgkkmT7q4lm4HyuA`, separate from TIEN404 AI SALES order workflows. The widget is in `demo.html#ai-live`. Chat messages are sent to n8n Cloud and a model provider; see `privacy.html`. It has no order, payment, or customer-database tool. Its anti-abuse caps are preliminary, **not** production-grade gateway security.

## Production readiness blockers

Real authentication, multi-tenant authorization, lead intake + secure retention, merchant payments, tax-compliant invoices, legal contacts and policy review, hardened API gateway and operational monitoring remain to be implemented before accepting paying customers.

Do not commit credentials, private customer data, real orders, payment details, or backend secrets.

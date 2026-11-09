# TIEN404 AI — Developer and deployment guide

## Current deployment

- **Project:** https://github.com/ngoctien20/demo-git
- **Public branch:** `gh-pages` (repository's unrelated `main` is not the deployed site).
- **Public URL:** https://ngoctien20.github.io/demo-git/
- **Hosting:** GitHub Pages, static HTML/CSS/JavaScript only.
- **QA development branch:** `qa/tien404-full-audit-20261109` for test-driven fixes.

## Included features

1. Homepage, solutions, industries, pricing, FAQ and policy pages.
2. AI Sales Demo with six deterministic local scenarios.
3. AI Sales Lab: configurable sample catalogue, budget and stock enquiries, simulated purchase requests.
4. Guided onboarding and a manual-workload estimator.
5. Sample dashboard with date filters and staff handoff queue.
6. Simulated registration/login, selection of a service plan, checkout, invoice and billing. The state is kept in browser `sessionStorage`; it is **not authentication**. Signing out or changing demo identity discards demo subscription/receipt.
7. **AI Consultant Beta:** a real model connected through an isolated n8n chat workflow, only for guidance about TIEN404 products and relevant pages. It cannot inspect or change actual orders, leads or user records.

## Data boundaries

- GitHub Pages **cannot run Python, Node or a database backend**. Consequently the public contact form cannot save or deliver lead submissions. It visibly fails closed.
- Payment and billing pages are demonstrations and do not request credit cards or process money.
- AI Sales Lab is offline on GitHub Pages; the separate AI Consultant Beta sends chat input to n8n/model infrastructure. Never provide real customer data, passwords, API keys or payment details. Consult `privacy.html` and `terms.html`.
- Rate limits in n8n are preliminary and do not stop all external scripted abuse. For a public production service use a gateway with IP/session throttling and abuse/credit alerts.

## Run, build, test

```bash
python -m http.server 8000            # website root
npm install
npm run build:css                       # src/scss/main.scss -> assets/style.css
node --check assets/app.js
node --check assets/saas.js
node --check assets/v4.js
python qa_static.py
python -m unittest discover -s tests
```

Full browser QA is run by GitHub Actions with Chromium and `@playwright/test`, `@axe-core/playwright`:

```bash
npm install --no-save @playwright/test@1.58.2 @axe-core/playwright@4.11.0
npx playwright install chromium
python -m http.server 4173
npx playwright test -c qa/playwright.config.cjs
```

CI artifacts include an HTML report, JSON results, screenshots of the key viewports and trace/screenshot evidence on failures. Some Chromium full-page captures omit offscreen content under animated scenes; use the included **viewport** captures for accurate visual inspection.

## GitHub Actions

- `.github/workflows/quality.yml` rebuilds Sass and verifies static/source contracts.
- `.github/workflows/full-browser-audit.yml` runs the end-to-end suite and posts a plain-language summary; it triggers on updates to `gh-pages`.
- GitHub Pages is built from `gh-pages` root. Check the Pages workflow in Actions after each release.

## Steps needed before accepting real customers

1. Establish who operates the service, their official contact address and approved privacy/terms.
2. Host a secure backend for lead intake with CAPTCHA, rate limits, persistent storage, deletion procedures and administrative notifications.
3. Implement real authentication, secure cookies, per-shop tenancy/authorization and audited access.
4. Integrate a compliant hosted payment provider, verify webhooks server-side, handle idempotency and generate lawful invoices.
5. Add a hardened gateway, usage budgets, alerting, retention policies and security/pentest review.
6. Roll out production order workflow integrations only after owner approval and end-to-end QA.

The website is intentionally not described as production-ready before these controls exist.

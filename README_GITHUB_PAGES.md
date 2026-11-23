# TIEN404 AI — GitHub Pages & Sass Edition

**Frontend:** 17 static HTML pages, Vanilla JS, SCSS modules, a compiled CSS release, six offline chat demo scenarios. No credentials or actual customer data bundled.

## Local preview

```bash
python -m http.server 8000 --directory site
# open http://localhost:8000/
```

## Sass authoring

The **source of truth for CSS is `site/assets/scss/main.scss`** and its Sass partials. The already built `site/assets/style.css` is included for immediate preview.

```bash
npm install
npm run build:css
npm run dev:css # while designing
```

## Test

```bash
python -m pip install pytest
python -m pytest -q
python qa_static.py
```

## GitHub Pages

1. Create a dedicated GitHub repository named `tien404-ai-website` (public repo is required for Pages on some plans).
2. Push **the contents of this directory** to `main`.
3. Go to Repository → Settings → Pages → Build and deployment → Source: **GitHub Actions**.
4. The workflow `.github/workflows/pages.yml` runs Python tests and SCSS build and uploads **only `site/`**, leaving backend / `.env` out of the public site.
5. Check Actions → Build, test & deploy → `deploy` for the live URL.

## Feature status (do not misrepresent)

- The demo chat is a deterministic browser simulation; it does not connect to n8n or an AI model.
- GitHub Pages does **not** run the Python API, so the contact form is **not a working intake service there** and explicitly reports this; deploy `server.py` privately to a separate backend to activate it.
- Notifications, payments, accounts, multi-tenancy, and live n8n are not implemented.
- Don't publish real customer data, API keys, real order datasets, or private n8n workflow exports.

## Project structure

- `site/` — static frontend served by GitHub Pages
- `site/assets/scss/` — modular Sass source
- `site/assets/style.css` — prebuilt CSS output
- `site/assets/app.js` — client-side interactions
- `server.py` — optional self-hosted demo/lead API (not deployed on Pages)
- `qa_static.py` — internal link + baseline SEO checks
- `tests/` — existing Python API tests
- `.github/workflows/pages.yml` — automated build/test/deploy pipeline

## Release gate

Never enable live customer forms, payment capture or production n8n workflows without a tested server-side integration and owner approval.

## SaaS Experience v3 — browser-only sandbox

Six new sample pages: `register.html`, `login.html`, `dashboard.html`, `checkout.html`, `billing.html`, `invoice.html`. A local-only `assets/saas.js` manages a simulated session using `sessionStorage`. It stores a display name, demo email, selected fake plan, and sample receipt in the current browser tab, with no API requests and no real passwords/cards. Clearing the tab/session removes the data. No authentication, payment, subscription, invoice, or customer data processing is active on the server. Never treat this browser state as trustworthy or sufficient for access control.

**Production deployment requires** a backend with verified user identities, secure cookies, CSRF protection, role-based authorization, per-tenant isolation, webhook verification, idempotency keys, hosted payment checkout (not raw card collection), legally compliant invoices, monitoring, and a privacy review. This prototype must not be used for real transactions.
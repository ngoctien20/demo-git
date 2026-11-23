# TIEN404 AI — Conversion & Real AI v4

## What works immediately on GitHub Pages

- Three-step store onboarding (industry → channel → goal) with contextual product catalog.
- AI Sales Lab: create/remove local sample products, stock and prices, deterministic Vietnamese chat simulation, price/stock filtering, draft order **without any write** and simulated handoff.
- Workload Explorer: input-based estimates of *manual* work; no claims of savings or commercial pricing.
- Dashboard sample chart, period filter, and sample support queue.
- New CTA links from homepage, pricing, demo; responsive Sass source and reduced motion support.

## What requires a separate backend (not included in GitHub Pages)

- Real AI chat using OpenAI Responses API, opt-in only: `AI_CHAT_ENABLED=true`, `OPENAI_API_KEY` and `OPENAI_MODEL` (server-side). There is no n8n access and no real orders. API rate limited and bounded to 10 sample products, 6 history messages, 400-character prompt, 400 output tokens. This is a lightweight QA sandbox, not a production anti-abuse system. In production, add robust quotas per session, CAPTCHA/bot controls, auth and monitoring before broad public access.
- Real lead form: `/api/leads` from existing FastAPI backend stores a lead in SQLite; optional SMTP notification. Set the frontend's public `site/assets/site-config.js` `apiBase` to the approved HTTPS API origin (e.g. `https://<your-api-domain>`), and configure backend `ALLOWED_ORIGINS`, `ALLOWED_HOSTS`, database persistence, and server-side secrets. Existing admin export requires a strong admin token.
- Dashboard here is a **sample experience**, not a customer account or tenant analytics system.

## How to start locally

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Windows: copy .env.example .env
uvicorn server:app --host 127.0.0.1 --port 8000
```

Visit `http://127.0.0.1:8000/onboarding.html` and `http://127.0.0.1:8000/lab.html`.

To **enable real AI** for internal QA only, edit `.env` to set `AI_CHAT_ENABLED=true`, `OPENAI_API_KEY`, and a model your API account has access to in `OPENAI_MODEL`. Restart the server and check `GET /api/ai/capabilities`. Never put these values into frontend JS, GitHub or n8n public webhooks. The API calls OpenAI with `store=False`, no tools and no server-side persisted chat. Provider-side processing still applies; do not use actual client records in this sandbox.

## GitHub Pages deployment

- Copy **only** the `site/` directory to the root of the `gh-pages` branch. Store Sass sources under `src/scss/` (mirrored from `site/assets/scss`).
- `site/assets/site-config.js` defaults to `apiBase:''`. This correctly disables online AI and lead submission on GitHub Pages; offline sandbox remains fully usable.
- Backend is **not** deployed by GitHub Pages. Host it behind HTTPS with persistent storage and strict allowed hosts/origins, with explicit approval for a production service and secrets.
- No checkout payments, real account credentials, real orders, or customer data are part of this version.

## QA

- `python qa_static.py` checks local URLs across site pages.
- `node --check site/assets/v4.js` and `node --check site/assets/app.js`.
- `python -m pytest -q tests/test_v4.py` includes sandbox backend and source checks.
- Full browser E2E when Chromium is available: `python -m pytest -q tests/test_v4_browser.py`.

## Next phase (approval-gated)

1. Configure durable backend hosting/database, email notifications and abuse protection.
2. Add authentication, tenant isolation and actual dashboard connections.
3. Connect only verified `n8n QA` workflows, never live order endpoints.
4. Add payment sandbox with server-verified webhooks, then separately approve production merchant activation.
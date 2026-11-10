# TIEN404 AI V5 — Implementation checkpoint
Date: 2026-11-10 JST. Branch: `ops/cto-autonomous-v5-20261110`. PR: https://github.com/ngoctien20/demo-git/pull/6 (DRAFT).

## Completed on feature branch
- Created `AGENTS.md` and `docs/AI_CTO_MASTER_PROMPT_V5.md` plus global status, execution plan, risk/error registry, 29-workflow inventory and release gates.
- Centralized public chat markup in `assets/website-chat-loader.js` and reused existing `assets/ai-consultant.js`. Added a single loader tag to 15 public marketing HTML pages.
- Removed duplicate static chat markup from index and demo; preserved marketing n8n webhook and the floating launcher/close UI.
- Intentionally excluded `login.html`, `register.html`, `dashboard.html`, `billing.html`, `checkout.html` from anonymous marketing widget.
- Defined `docs/ASSISTANT_ACCESS_ARCHITECTURE_V5.md` for three distinct security contexts: marketing visitor, authenticated merchant, verified shopper/order owner.
- All changes staged on this branch only; no GitHub Pages release, n8n mutation, credential use, Supabase setup, store order or production change.

## CI evidence
- V5 static project and widget integrity: https://github.com/ngoctien20/demo-git/actions/runs/42829554766 — **SUCCESS**.
- Public navigation regression: https://github.com/ngoctien20/demo-git/actions/runs/42829554817 — **SUCCESS**.
- These tests cover repository code and static contracts only, not Chrome/Android browser interaction or live n8n response.

## Unverified and blocked
- Real browser/mobile visual QA, Android dark mode keyboard send and page scrolling.
- User-specific cross-page transcript retention behavior.
- Hosted Control Hub Sites/D1 source, real authentication, tenant ownership, Supabase production, order-specific buyer verification.
- Integration of new merchant/customer order AI: **not implemented**, will remain blocked until authenticated data layer and security negative tests pass.

## Rollback / release
- No production rollback required: draft PR is unmerged. Close PR #6 to discard staging proposal.
- Before any release: validate widget E2E on representative browsers, test actual webhook and rate-limit/fallback behavior, confirm all 15 public pages and account exclusion.
- Merchant and shopper AI must begin read-only in isolated QA, not reuse AI_SALES_DEMO Orders/Products or public chatbot credentials.

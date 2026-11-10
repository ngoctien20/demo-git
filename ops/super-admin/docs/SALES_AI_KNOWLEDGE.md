# TIEN404 AI V4 — SALES_AI_KNOWLEDGE

**Status:** staging knowledge approval engine implemented; live website chatbot is NOT connected to it or a RAG index.

## Verified product context

- Public website: https://ngoctien20.github.io/demo-git/
- Safe guided onboarding: `/demo-git/onboarding.html`
- AI Sales Lab: `/demo-git/lab.html` is simulated catalogue/order handling; no real transaction.
- Public demo page: `/demo-git/demo.html` has a separate isolated n8n marketing AI workflow (`wgkkmT7q4lm4HyuA`), subject to actual runtime availability.
- Existing n8n AI SALES_DEMO workflows are for a separate demo, and MUST NOT be shared with future Commerce tenants or used for public order writes.
- **No confirmed commercial Basic/Pro/Business price list**, committed merchant policies, verified increase in sales, or production SLAs. The AI must refuse to invent these.

## Five separate knowledge sources

| Kind | Description | Publishing |
|---|---|---|
| PRODUCT | Released capabilities vs beta/draft | SUPER_ADMIN approval |
| SALES | Non-coercive consultation scripts, objections | SUPER_ADMIN, internal-only |
| PRICING | Current approved plan prices, features and usage | SUPER_ADMIN, public after approval |
| SUPPORT | Support policy and handoff process | SUPER_ADMIN, internal-only |
| PUBLIC_DOC | Public implementation/FAQ/how-to | SUPER_ADMIN approval |

Staging API creates versioned DRAFT records and requires an explicitly logged SUPER_ADMIN approval before latest version can be read from the public `PRODUCT`, `PRICING` or `PUBLIC_DOC` read endpoints. Unapproved or unknown material must return 404; no default prices. `SALES` and `SUPPORT` cannot be served publicly through the staging API. Sources and approval timestamps are retained.

## Proposed AI product consultant behavior

`DISCOVER → UNDERSTAND → RECOMMEND → DEMONSTRATE → CLARIFY → CONVERT → FOLLOW_UP`.

Rules: identify as an AI; ask at most one short business question at a time; suggest smallest relevant plan; cite the currently approved KB version for prices, channels, status and policy; be explicit about beta features; don't promise results; no fabricated discounts/reviews/urgency; don't ask for customer tokens, passwords or payment details. If no approved price, say "giá chưa được cấu hình/xác minh" and invite the customer to request a quote.

Example for grocery: learn approximate message volume and channels; explain potential use cases (FAQ, ordering, alerts, business-hour switches, wholesale pricing) **as possible features subject to configuration**, not promises that each is already deployed.

## Runtime RAG design (not built)

Persist content versions with source URL/owner, effective date, reviewer and hash; index approved snapshots only; each generation includes `knowledge_version`, `verified_feature_status`, and clear citation/grounding. On approval/rollback, atomically swap active index pointer; log unanswered questions with redaction and retention limits. Never let retrieved docs override system security instructions. Sales conversion measured from real consented events (demo opened, signup started, payment verified), NOT inferred from chat text.

## Required evaluation suite before connecting model

- Incorrect, obsolete or unapproved prices must be refused.
- Prompt injection must not reveal system prompt, credentials or other tenants.
- Claims about live Messenger/Zalo integrations must match verified channel release state.
- Requests for sensitive data must be redirected to secure forms.
- Detect unsupported features and handoff without fabricated promises.
- Validate knowledge version and source in the response trace; human review of flagged answers.

No n8n production prompt or model was changed in this iteration.
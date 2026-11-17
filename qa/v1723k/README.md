# TIEN404 AI V17.23K — Privileged RPC Caller Audit × Private Owner Intake × Real Store A/B JWT UAT Plan

**SOURCE-ONLY / NO SEND / NO DEPLOY / PUBLIC RPC REVOKE NO-GO / REAL JWT NO-GO**

Parent: V17.23J Draft PR #354, exact starting commit `5429f7e303b7666880e06e19d4e128d08238b18d`. Reuse RPC12 Draft PR #244 independent private operator intake, rather than copying private identity documents into GitHub.

## Direct verified staging metadata — scoped audit only (2026-11-17 JST)
Supabase staging `ifxlvrhyjhbzbrkdsida`:
- `public.qa_shop_b_zalo_claim`: `SECURITY DEFINER`, `anon EXECUTE=true`, `authenticated EXECUTE=false`; function uses `SET search_path=''` and a **Vault-backed shared-secret header gate** (`x-tien404-pairing`), then calls a synthetic Shop B QA claim helper. **Not an unguarded RPC**. Shared-secret checks do not in themselves demonstrate native Zalo signature verification or source attestation. No exploit proven. Need external caller/credential lifecycle/ingress source verification review before changing privileges.
- `public.qa_owner_pairing`: `SECURITY DEFINER`, authenticated-only, checks `auth.uid()`, active tenant Owner and synthetic enabled QA bot, challenge issuance/expiry/consumption. Review private source authorization and replay separately.
- `public.save_merchant_product`: `SECURITY DEFINER`, authenticated-only and `auth.uid()`, **tenant-oriented, no canonical Store boundary**. P1 multi-store review before Store rollout; no mutation performed.
- `merchant_revenue_v3`, `merchant_paid_orders_daily`: `SECURITY INVOKER`, authenticated and tenant-oriented, not store-qualified. Require compatibility review before multi-Store rollout.
- Six public Commerce SELECT policies remain tenant PERMISSIVE; adding another permissive Store policy does NOT fix same-Tenant Store A/B isolation.
- 2 legacy Products, 2 Orders, 0 Customers, 3 Auth accounts, 5 Auth sessions; canonical Stores/membership and independent Owner provenance absent, cross-channel bindings absent. Metadata does not prove real sessions or Store ownership.

## Real n8n caller graph — bounded verified nodes, not global exhaustiveness
- Active Zalo V1 workflow ID `yIJk8LvJoLF40Z62`, published version `2d912cb0-007f-452f-9536-b92ba12a03e6`. Node `Zalo V2 Shadow (Owner Gate Only)` calls workflow `OgDZNSAvKEvhnAvn` via Execute Workflow.
- Active Zalo V2 shadow ID `OgDZNSAvKEvhnAvn`, published version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`. Node `Submit pending claim for Shop B` has HTTP RPC target `qa_shop_b_zalo_claim`.
- Reviewed matching active Zalo workflows by name (4), only V2 has a direct RPC literal match. **Name-matched sample is NOT exhaustive across all n8n/workers/clients**. No claim all callers enumerated.
- Messenger active `Z7FdV7uDvApfbURQ`, published `1064b1b3-d3f1-4a6b-a367-2414ba691522`; private router active `sIPs6egzIwOY1GNv`, published `8d91d23c-cd87-462f-a112-9cca2340bec8`. Neither examined node graph had matching direct RPC target.
- No credential values, HTTP Authorization headers, webhook secrets or customer events logged. **Do not revoke** public RPC or change Published workflows until a separate bounded change gate and full caller inventory.

## Private Owner provenance admission (deferred, existing infrastructure)
- Existing RPC12 private local intake in PR #244 provides structurally safe read of owner ledger in a private operator-controlled environment; it **does not itself certify the Owner**. Four original real rows (two Products, two Orders) require separate primary-source Store evidence, Merchant approval, independent reviewer and approved current restore. No guessing from product SKU/tenant keys/QA bot.
- Owner previously **deferred local real backup**. New M0 scope is UNDECIDED. Do not reopen backup in this stage or promote H11R's limited archive into current restore proof.
- No authorized original-row identity evidence was submitted for this milestone; no real private JWT was provided or accessed.

## Real hosted JWT UAT — specification ONLY, NOT EXECUTED
Preflight minimum:
1. Independently accepted private Operator + Merchant Owner A/B proof and independent reviewer, scoped QA Tenant/Store records, current M0 approved recovery and separate hosted no-send test authority.
2. Two distinct real Supabase Auth sessions. Validate JWT signatures, issuer, audience, expiry, session ID and revocation in a trusted private runner, **not by decoding payload, boolean claim, AI text, or using service_role**.
3. Server-canonical Store A/B membership in one Tenant; RLS-denied Store A → B, B → A, cross-tenant, revoked/inactive role and cross-customer ownership; deny tenant-only permissive RLS bypass. Use disposable records with fixed expiry and rollback, no customer PII.
4. Native signed Meta/Zalo provider event and independently verified Bot/OA/Page installation ownership; challenge-backed one-time customer identity pairing, replay and rate controls. A Vault-backed header alone does not prove native provider signature.
5. Runner **no-send/no-write** network guard, no Messenger/Zalo messages, no orders/prices/stock/subscription mutations, no service-role or anon privileged RPC, no public Worker/Access opening; independent acceptance and signed private report.

`REAL_JWT_UAT_CASES` enumerates 16 acceptance cases (2 positives conditional on independent admission and 14 mandatory denies). Public source tests only inspect policy contracts and **cannot execute real JWTs**.

## Security decision
`RPC_CALLER_REVIEW_REQUIRED` / `OWNER_EVIDENCE_BLOCKED` / `REAL_HOSTED_JWT_NO_GO` / `PRODUCTION_NO_GO`.

**Rollback:** Close this Draft PR. No Supabase migration, RPC execute, GRANT/REVOKE, n8n publish, provider send, JWT, backup, paid resource or data write was performed.

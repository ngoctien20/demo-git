# TIEN404 V18.0-P0P — Private Real Auth Session Evidence and Canonical Store Owner Admission

**2026-11-18 JST | VERIFIED READ-ONLY / SOURCE DESIGN IMPLEMENTED / REAL JWT PAIR BLOCKED / HOSTED STORE NO-GO.**

Continue existing Draft PR #385 and checkpoint Issue #368, without new PRs, hosted migrations or customer data.

## 1. Evidence received vs missing

Founder already confirmed **two different QA accounts**; that fact is accepted and should not be re-asked. The deployed P0O page on Render staging is LIVE (deployment dep-dbubajafngtc73c8thdg; runtime commit e993a23e3cb6b3abbea89ee13878162cfaf4e716) and performs a local user-consented getUser/getClaims plus tenant-membership RLS read, using ephemeral HMAC comparison. Existing Chromium QA intercepted Supabase and used synthetic users. **No actual A/B operator comparison result or independently verified real JWT evidence has yet been provided** in this conversation. A P0O copy/paste receipt is unsigned and may not authorize Store actions.

Fresh connected Supabase staging read-only SQL: one tenant has two eligible active owner accounts, but only one with any currently recorded auth.sessions row and one with a non-expired-looking row. Session rows are not signature/possession/revocation evidence. There are **0 canonical public stores/store_memberships and 0 store_id columns** on the seven Commerce core tables. All seven currently have RLS + FORCE RLS, but their existing foreign keys are tenant-only, not Store-aware.

Exact compatibility hazards from real database metadata:
- Products enforce UNIQUE (tenant_id,sku), named products_tenant_id_sku_key; moving to Store SKU scope needs collision/legacy caller review.
- Order lines enforce UNIQUE (order_id,product_id); changing Store-aware order model must retain order-line semantics.
- Orders/customers, order_items/orders/products and messages/conversations currently use composite tenant_id foreign keys; the future Store-aware model needs (tenant_id,store_id,...) composite FKs, not only a Store column.

## 2. Trusted private real-session verifier design (NOT IMPLEMENTED OR DEPLOYED)

Only independently consenting authorized QA owners may participate, each with their existing separately controlled browser session. The future server verifier must be access-controlled, HTTPS and private; never embedded in a public static page, public GitHub source, query string, error logs or analytics.

For each consented actor, a trusted verifier must receive the Auth token directly over HTTPS from the original browser **without disclosing it to ChatGPT or public systems**. Verify identity via official Auth getUser and cryptographically verified getClaims; match issuer, audience, exp/iat, sub, session_id and tenant-scoped active membership. Correlate session_id with Auth server-side records and revocation rules using a separately approved minimal privileged backend. Require two independently authorized, different subjects in the **same tenant**, and independently attest owner consent. Stop if one owner has no valid session, membership differs, or claims are unverifiable.

Store only minimal private receipt handles with short TTL, verifier build/policy version, no-send flag and a server-held signed attestation. Keep actual sensitive mappings in protected registry with audit/retention and access approval. A client-generated P0O HMAC receipt or self-asserted JSON must NEVER serve as a server-signed attestation. No verifier or private registry is currently deployed.

## 3. Canonical Store Authority — candidate only

Source-only draft DDL is in qa/v180-p0p/canonical-store-authority-design.sql: **EVERY DDL LINE IS COMMENTED OUT; DO NOT EXECUTE.** Proposed public.stores contains (id,tenant_id,store_code,status); public.store_memberships contains (tenant_id,store_id,user_id,role,status,owner_proof_receipt_id). Composite FKs bind to an existing tenant AND a canonical Store; membership begins in candidate state and does not auto-activate from tenant_memberships role=owner. Enable and FORCE RLS with default deny, no grants/policies until independently security reviewed.

Store A owner may ultimately access only A; Store B owner only B; an unbound tenant owner, wrong tenant, expired session, unsigned QA receipt or wrongly linked provider installation must receive DENY. Messenger/Zalo cross-channel order visibility is permissible only when **both independently authenticated provider installations resolve to the SAME trusted canonical Store**. Provider text, bot name, SKU and old QA store_key must not determine Store.

Later schema migration needs verified M0 recovery and explicit separate approval for DDL, new role grants, Store owner bindings, RLS/RPC updates, tenant→Store data backfill and any customer writes. Preserve current legacy callers until compatibility checks pass. Existing 31 planned real JWT cross-store UAT scenarios remain NOT_RUN.

## 4. Exact acceptance gates

| Gate | P0P result |
|---|---|
| Two different QA accounts | USER-CONFIRMED |
| P0O real operator local A/B status | NOT_RECEIVED |
| Two independent signed real Auth JWT sessions | NOT_VERIFIED |
| Private owner consent, trusted server receipt | NOT_COLLECTED |
| Canonical Store registry and A/B ownership | PROPOSED, NOT DEPLOYED |
| 31 real JWT A/B no-send negative scenarios | NOT_RUN |
| M0 recovery for hosted Store/RLS change | REQUIRED, NOT WAIVED |
| Production or Messenger→Zalo order access | NO-GO |

## 5. Next operator hinge; privacy and rollback

With both **existing authorized QA profiles**, open https://tien404-auth-staging.onrender.com/auth-evidence.html. Actor A creates a one-time nonce, B uses that same nonce to run private Auth read-only check, B copies the ephemeral receipt into A and A presses **Đối chiếu hai tài khoản**. Report ONLY the boolean outcome ("ĐỐI CHIẾU CỤC BỘ ĐẠT") or its BLOCKED reason code. Do not share nonce, receipt, fingerprint, email, JWT, password, raw IDs or screenshots showing personal data. If blocked, stop; do not provision accounts or change permissions.

This safely narrows next session-correlation step but **cannot** by itself establish signed backend authority. Server verifier deployment needs separate scoped approval and consent from both owners.

No hosted changes in P0P. Runtime rollback not needed; source-only PR content can be reverted. Existing P0O Render rollback baseline is the P0M staging deploy dep-dbu9u4tbedkc7397p880. No n8n, provider sends, billing, Auth credentials, Store grants or production changes.

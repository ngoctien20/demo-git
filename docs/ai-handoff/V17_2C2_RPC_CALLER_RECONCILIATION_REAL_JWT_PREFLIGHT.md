# V17.2C.2 — Caller Reconciliation, Real JWT Preflight, Scoped Privilege Closure (SOURCE-ONLY)

Date: 2026-11-18 JST
Repository: ngoctien20/demo-git
Parent PR #392, prior head `4ae6f3db5f2c30b9d86d544f582c28146b69fec2`
Environment: Supabase staging `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11

## Evidence and verified limits

- GitHub Actions [44133513115](https://github.com/ngoctien20/demo-git/actions/runs/44133513115) concluded SUCCESS for previous source-only RPC ACL contract CI (NOT real JWT).
- Supabase project ACTIVE_HEALTHY. Read-only SQL metadata: 3 Auth users, 3 target public RPCs, 0 `public.stores` table, 0 `public.products.store_id` columns, and 0 INSERT/UPDATE/ALL RLS policies for `public.products`.
- n8n list returned 151 workflows. 18 named candidate workflows had full draft/published graph read; zero exact three-RPC names and zero `/rest/v1/rpc/` matches. Previous V17.2C.1 independently inspected 3 additional core Zalo/Commerce workflows; this is **not a verified scan of all 151 workflows**. A large all-workflow attempt hit connector orchestration tool-call limits and did not yield a complete auditable result.
- Cloudflare listed 32 Workers in connected account. Read-only GET content/v2 was successful for 32/32. Exact `qa_shop_b_zalo_claim`, `qa_owner_pairing`, `save_merchant_product` names had 0 literal hits in the returned content representation. Generic `/rest/v1/rpc/` was present in 13 BIO Workers; these are **unclassified dynamic RPC callers** until paths/target functions and deployed route/version are independently reconciled. This literal scan excludes indirect module dependencies, runtime-generated paths, external callers, legacy deploys and other Cloudflare accounts.
- GitHub code search of default branch previously returned 0 exact-name matches. Branch history and all work branches have not been exhaustively reconciled.

## RPC authority and compatibility matrix

| RPC | Observed grant | Server-side guard | Proposed next move | BLOCKED by |
|---|---|---|---|---|
| qa_shop_b_zalo_claim(uuid,text,text,text) | anon ONLY, PUBLIC false | Vault-backed header secret, synthetic QA bot binding | Preserve signature temporarily; prefer trusted private provider-verified ingress with replay defense, then REVOKE anon EXECUTE after all callers migrate | Actual origin, signed provider event, replay evidence, downstream Zalo integration |
| qa_owner_pairing(uuid,text,uuid) | authenticated ONLY, PUBLIC false | auth.uid + owner active tenant membership + QA-only bot state | Keep grant; strengthen session and store-bound authorization and rate limiting in candidate separate revision; require real signed JWT tests before rollout | Two independent active QA Auth sessions, own-vs-other tenant tests, revocation proof |
| save_merchant_product(uuid,text,text,bigint,bool,int,timestamptz) | authenticated ONLY, PUBLIC false | auth.uid + active owner/manager + allowlist of exactly two QA tenants + optimistic updated_at | Keep DEFINER until scoped write RLS migration or private broker design is proven. Do not blanket REVOKE or switch INVOKER | Existing products SELECT-only RLS, existing UI/owner-manager compatibility, real auth no-write proof |

No direct service_role EXECUTE grants were identified on these three. None has PUBLIC EXECUTE. Supabase SECURITY DEFINER advisor warnings are **not proof of exploitation**.

## Real JWT negative UAT preflight / strictly NO SEND

Not admitted for execution as of checkpoint. Existing staging has 3 auth users, but there is no verified independent pair of active QA users for same-Tenant two-Store A/B, no canonical stores table and no Store-scoped JWT authorization layer. **Never use elevated SQL or a synthetic JWT as replacement for real Auth/PostgREST identity.**

1. Secure founder-scoped consent, independent security review, authorized new QA tenant and two distinct QA Auth identities. Do not expose identity, JWT, token, phone or secrets in logs/PR.
2. Use a disposable QA schema (or isolated project after cost/approval) and single canonical store membership contract. Verify staged schema, API exposure and backup/rollback prior to migration. Avoid writing existing Merchant/DEMO rows.
3. Obtain two genuine short-lived Supabase Auth sessions privately. Verify user_id/session binding and expired/revoked session handling. Never paste tokens into GitHub or agent chat.
4. Run NO-SEND GET/HEAD/OPTIONS permission probes against a dedicated read-only QA resource; test A->A permitted, A->B denied, B->B permitted, B->A denied, unauthenticated denied, wrong tenant denied, revoked membership denied and forged claims denied. Capture HTTP status, tenant/store pseudonyms, timestamp, deployed SHA; no PII, no provider callbacks.
5. SECURITY DEFINER writes (owner pairing/product) require **disposable transaction rollback** and explicit mutation authorization, not read-only network probes. A SQL transaction rollback test must use isolated resources and cannot establish real JWT acceptance by itself.
6. Verify independent reviewer, exact-HEAD CI, Supabase advisors, and full caller inventory before preparing production GRANT/REVOKE. Failure to meet any gate is NO-GO.

## Minimal negative test matrix (planned, NOT RUN)

| Actor | Endpoint/scope | Expected |
|---|---|---|
| no JWT | QA Store A read | 401/403 or empty fail-closed; exact policy-specific behavior captured |
| Auth user A | authorized Store A read | scoped success |
| Auth user A | Store B read | deny / zero results |
| Auth user B | Store B read | scoped success |
| Auth user B | Store A read | deny / zero results |
| Auth user A (revoked) | Store A read | deny after revocation policy/session handling |
| forged client tenant_id | any other tenant | deny |
| invalid/expired token | any store | deny |
| irrelevant authenticated user | qa_owner_pairing or save_merchant_product | deny without mutation |
| anonymous no/invalid gate | qa_shop_b_zalo_claim | deny without claim |

Expected status codes depend on PostgREST/RLS semantics; 200+zero rows may be valid for read RLS but is not automatically proof of correct access without known synthetic fixtures. **No rows should be changed as part of a read-only test.**

## Release decision / rollback

**PROPOSED design, read-only evidence VERIFIED, real JWT NEGATIVE UAT BLOCKED, privileged closure NOT IMPLEMENTED, hosted security NO-GO.**
No Cloudflare deployments, Supabase migrations, Auth creation, RPC grants, provider sends, billing changes, n8n modifications or customer data writes have been performed.
Rollback: close PR #392 or revert this documentation-only commit. Current runtime unaffected.

Next: V17.2C.3 targeted BIO dynamic RPC caller classification + deploy fingerprint reconciliation; recover full n8n caller scan by bounded groups; private Auth A/B admission consent and independent negative JWT UAT.

## BIO RPC refinement (read-only)

Full exact literal extraction of 13 BIO Workers with generic RPC path showed function names restricted to `is_personal_admin`, `bio_published_settings`, `bio_publish_setting`, and `bio_public_media_manifest`; none of three target Commerce/Zalo/owner RPCs appeared. Three BIO v2.4/v2.5/v2.6 content representations contain one additional generic path occurrence beyond those unique literal names each; require context/dynamic target review. This reduces but does not close indirect/dynamic caller uncertainty. No scripts were changed.

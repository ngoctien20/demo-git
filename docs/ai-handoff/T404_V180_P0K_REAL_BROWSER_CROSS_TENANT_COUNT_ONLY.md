# TIEN404 V18.0-P0K — Real Auth JWT cross-Tenant RLS Negative QA (READ ONLY)

2026-11-18 JST · IMPLEMENTED SOURCE-ONLY · REAL BROWSER EXECUTION NOT YET RUN · SAME-TENANT STORE AB NO-GO

## Purpose
Follow previously verified QA browser screenshots: existing `TIEN404 QA Shop A` and `TIEN404 QA Shop B` are **two separate Supabase tenants**, each with its own Owner and 1 QA product plus 1 QA order. Their isolation in the account UI alone is not sufficient to prove RLS under current authenticated JWT. This step uses the exact existing staging authenticated browser sessions, without passwords or JWTs copied to ChatGPT, n8n, GitHub or CI.

**Not a production Store A/B acceptance.** This explicitly tests cross-Tenant A≠B; canonical same-Tenant Store A/B is still absent.

## Hosted read-only preflight (no private data)
- Supabase project `ifxlvrhyjhbzbrkdsida` PostgreSQL17.11, `public.products`, `orders`, `order_items`, `customers`, `conversations`, `messages` each RLS=ON, FORCE RLS=ON, tenant_id present; no Store ID.
- All six have authenticated SELECT RLS policies; five manager-only, products member-only. Each SELECT predicate requires matching `tenant_memberships.tenant_id`, `m.user_id=auth.uid()`, `active`; manager surfaces require role owner/manager. `tenant_memberships` own policy filters `user_id=auth.uid()` and active.
- `anon` table SELECT grant FALSE, `authenticated` SELECT TRUE for these 6 plus `tenants`, `tenant_memberships`. This is ACL/RLS metadata, not a proof of live JWT deny.
- Independently queried aggregate QA baseline (no actual order/customer rows): Shop A products=1, orders=1, order_items=0; Shop B products=1, orders=1, order_items=0.
- Two visible screenshots show distinct authenticated Owner UI in isolated browser contexts. No Auth headers/JWT/session IDs were inspected or exported by this audit.

## Operator-scoped real browser test
Source `qa/v180-p0k/private-browser-cross-tenant-counts.js` is a **self-contained local DevTools console IIFE**. It is not served by the current Render deployment and MUST NOT be claimed as executed merely because GitHub CI passes.

1. Only the human authorized to operate each QA Owner session should run it, separately and with explicit confirmation, in each already-authenticated Cốc Cốc browser profile at EXACT origin `https://tien404-auth-staging.onrender.com/account.html`.
2. Open the GitHub source file from the pinned PR #385 commit, review the entire contents. Use DevTools Console (F12 → Console) and paste ONLY that reviewed source. Do not paste commands from strangers or unfamiliar scripts. It imports the existing same-origin `/assets/auth-client.js`, which is already used by the deployed account page. If the DevTools browser blocks pasting or the operator is uncomfortable, STOP; a future review/approved staging UI deployment may provide a button. Do not disable browser security protections just to run this.
3. The script uses Supabase `auth.getUser()`, `auth.getClaims()`, own membership RLS SELECT, `head:true,count:'exact'` own products/orders **baseline**, and negative COUNT-only queries using `neq('tenant_id', currentOwnerTenant)` on six surfaces. It does NOT request any customer or order content, IDs, emails, addresses, phone, prices, JWT, session ID, secret or token; nothing is sent to ChatGPT. It additionally tests membership self-isolation by COUNT only.
4. Run once in each independently authorized A and B profile. Return ONLY `A_LOCAL_PASS`/`A_BLOCKED`, `B_LOCAL_PASS`/`B_BLOCKED`. NEVER copy console text with the browser session/user metadata, UUIDs or JWTs. For a BLOCKED result, only the error `reason` code (not raw error/network request) may be reported.
5. A `LOCAL_TENANT_RLS_NEGATIVE_OBSERVED` indicates that, during this local browser session, own products/orders baseline exists, all six foreign-Tenant count queries returned exactly zero and other-member count returned zero. This is **browser-observed** RLS, not an independent signed server acceptance, exhaustive auth session revocation proof or same-Tenant Store proof.
6. A `BLOCKED` or `POTENTIAL_CROSS_TENANT_VISIBILITY_*` is NOT PASS: stop, do not inspect returned private rows and do not proceed with Messenger/Zalo live order UAT.

## Security and release gate
- Query type: only SELECT COUNT with `head:true`, no rows. `getUser/getClaims` official Auth methods. Never use Supabase secret, `service_role`, `set role`, fake JWT, raw session paste or owner impersonation.
- No production site/workflow/schema/auth policy changes or costs; source code only. No change to the existing QA pairing button.
- Human may open DevTools on their own trusted machine. An Auth token remains in the existing SDK client as normal; this source does not read it or output it.
- Required before declaring cross-Tenant JWT UAT accepted: two owner-side local results plus independent server-side evidence of actual session validity, revocation, role and exact deployed RLS policy. Required before same-Tenant Store A/B: canonical Store schema+RLS after M0 backup/restore and separate approval.
- Separate provider Messenger→Zalo linkage and authorized customer-order evidence remains NO-GO.

## Rollback
Revert the source-only files on Draft PR #385; no hosted data/config or token changed. Existing PR #389 Zalo Bot customer QA remains untouched.

CHECKPOINT `V18_P0K_CROSS_TENANT_2_ACTOR_BROWSER_PROBE_SOURCE_READY · SIX_COUNT_ONLY_NEGATIVES · REAL_BROWSER_NOT_RUN · STORE_AB_NO_GO`.

# TIEN404 AI — V17.23M: Cloudflare/Edge RPC Caller Completion × Provider Signature × Private JWT Readiness

**DRAFT / NO HOSTED WRITE / NO SEND / NO REVOKE / REAL JWT NO-GO.**

Parent: V17.23L Draft [PR #361](https://github.com/ngoctien20/demo-git/pull/361) at SHA `ff3368bac056435a7c2f8d9653112502200988f4`. This is a source-only child; no existing working Node, Worker, Edge, Supabase or n8n workflow is modified.

## Read-only direct evidence (17 Nov 2026 JST)
- Cloudflare account Worker listing: **31 scripts**, content/v2 read of **31/31** currently listed scripts. **0 explicit references** to the three named privileged RPCs `qa_shop_b_zalo_claim`, `qa_owner_pairing`, `save_merchant_product`. **13 BIO Workers** include generic `/rpc/` references with Supabase references; no exact named target, so classify as **generic/dynamic and subject to further review**, not automatically safe for privileged RPC REVOKE. Script content inspection does NOT establish which version is deployed, routes/traffic, external clients or actual provider admission.
- Supabase Edge: **one active function**, `tien404-r1-owner-preflight` v2, `verify_jwt=true`, file `index.ts` inspected read-only. It uses Bearer token, `auth.getUser(token)`, user-scoped Supabase client, tenant Owner membership and a fixed QA shop slug allowlist. No named privileged RPC call found. It is **Tenant-only**, not a Store A/B admission or independent JWT UAT.
- n8n from V17.23L: 151 listed workflows, 22 active Published definitions reviewed; only one direct privileged-RPC literal match, `TIEN404_ZALO_V2_SHADOW_STAGING` node `Submit pending claim for Shop B` → `qa_shop_b_zalo_claim`; parent Zalo V1 → V2 verified. Published code containing fixed/dynamic URLs is not an exhaustive global caller proof.
- Supabase privileged `qa_shop_b_zalo_claim`: anon-executable SECURITY DEFINER with Vault-backed header shared-secret guard. This is an authorization defense, **not automatically a native Zalo provider signature check**. Do not revoke; external caller paths are not fully reconciled.
- Four Worker scripts showed generic cryptographic hints, including `tien404-v175e1-private-issuer-nosend-staging`; generic HMAC, crypto.subtle or a string matching `x-hub-signature-256` is **not proof of independently admitted native signed real event**. No real native Meta/Zalo event verified in this milestone.

## Readiness and independent private acceptance
- Reuse existing private Owner evidence intake in [PR #244](https://github.com/ngoctien20/demo-git/pull/244), 4 original Product/Order Store provenance in [PR #354](https://github.com/ngoctien20/demo-git/pull/354). No source UUIDs/Owner documents in GitHub.
- **M0 owner-deferred** local backup and new M0 recovery scope undecided. Historical H11R remains limited acceptance only.
- Real JWT preflight requires *two distinct issuer-validated Supabase Auth user tokens and active session checks*, *same-Tenant two canonical Store membership proofs*, user-RLS negative AB/BA, cross-tenant, cross-customer, revoked sessions, one-time pairing, signed native provider event and installation owner, independent Operator/Reviewer acceptance, *no-send/no-write* guards.
- No Auth token, private row, original signed webhook, privileged credential, OAuth install or provider-owned account was obtained or used.

## Important remaining blockers
1. Cloudflare Worker deployment/version + actual traffic route inventory; BIO generic RPC targets and dynamic URL classification; connected Cloudflare account may not cover every customer-controlled account.
2. External n8n inactive workflows, Cloudflare Pages Functions, Edge endpoints outside this project, GitHub/third-party clients, direct PostgREST callers and provider API traffic not exhaustively reconciled.
3. Independent provider-native signature verification evidence (raw-body HMAC or documented provider auth as applicable), replay control, recipient installation provenance, private signed negative UAT.
4. No hosted canonical `public.stores`/Store Memberships, Store-column/RLS isolation, verified same-Tenant Store A/B Owner, current accepted restore or two real JWT no-send sessions.

## Changes and QA
- Source-only evaluator `qa/v1723m/external-caller-provider-jwt-gates.mjs` and negative tests.
- GitHub CI has no credentials and cannot independently authenticate real external proof. Even all input claims `true`, it **always** returns NO-GO for REVOKE/RPC/real JWT/provider send/deploy.
- **Rollback:** close draft child PR, no hosted rollback required. Preserve PR #361, published workflows, OAuth credentials and Commerce data.

## Decision
`CLOUDFLARE_SCRIPTS_SOURCE_REVIEWED` / `EDGE_FUNCTION_SOURCE_REVIEWED` / `GLOBAL_CALLER_ATTESTATION_BLOCKED` / `PROVIDER_NATIVE_SIGNATURE_BLOCKED` / `REAL_STORE_AB_JWT_NO_GO` / `PRODUCTION_NO_GO`.

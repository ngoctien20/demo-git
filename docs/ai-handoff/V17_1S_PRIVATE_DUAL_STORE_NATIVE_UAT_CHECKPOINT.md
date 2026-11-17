# TIEN404 AI — V17.1S Two-Store Private Auth UAT × Meta/Zalo Native Signed Canary

Date: 2026-11-17 JST
Parent: V17.1R Draft PR #303 HEAD `5590cddddab13a9e87ddb854fd114b6ba95dec5c`.
Lifecycle: PROPOSED real UAT / IMPLEMENTED source-only gate / TESTED status pending independent CI.

## 1. Verified live readiness

Read-only at stage start:
- Messenger workflow `Z7FdV7uDvApfbURQ`, Published V17.17 `1064b1b3-d3f1-4a6b-a367-2414ba691522` (32 nodes), all four V17.15 nodes retained.
- Zalo workflow `yIJk8LvJoLF40Z62`, Published V17.19 `2d912cb0-007f-452f-9536-b92ba12a03e6` (12 nodes). No write/publish to either.
- V17.1P QA workflow `p5OsIaB0NkMDFMw7` remains INACTIVE, `callerPolicy=none`, zero credentials.
- Supabase `tien404-staging`, project `ifxlvrhyjhbzbrkdsida`: two mapped Stores in TWO different Tenants, ZERO same-Tenant distinct Store owner pairs, ZERO Tenants with two distinct active membership+Auth session users. Legacy `public.orders/products/customers`: zero direct Store-level RLS policies and no store_id columns. Two real same-Tenant owner JWTs therefore NOT admitted, no synthetic SQL claim may be passed as real.
- Anonymous-executable SECURITY DEFINER function `public.qa_shop_b_zalo_claim` remains a separate P0 review candidate (not proven exploitable). No RPC invoked.

## 2. Security gap addressed — TOCTOU identity/ownership

V17.1R issued opaque, one-use, 60-second receipts at initial JWT and signed Page/OA verification. A revoked session, demoted owner, disabled Page/OA installation or changed Store owner mapping **after issuance but before UAT canary creation** needed fresh server-authority verification, not only receipt age/identity.

V17.1S adds a new independent method `planDualStoreNativeNoSendUat({owners,events})` to **new source-only copy** `qa/v171s-private-uat/private-admission.cjs`, while leaving the parent V17.1R/V17.1Q modules and live systems unchanged.

New method requires:
1. Two *independently cryptographically verified* owner JWT receipts, distinct JWT subjects and session IDs, two different Store IDs under the SAME Tenant (from owner registry, never a client claim).
2. Four signed native events: for each Store, one Meta Page signature and one Zalo OA signature; all four receipt identities unique and associated with independently verified installation ownership.
3. The same private instance's WeakMap capability records; copied/plain-object receipts fail.
4. Auth session **rechecked** for active state and unchanged subject/session; Store owner role/binding **rechecked** for active owner proof and same Tenant/Store.
5. Meta Page and Zalo OA installation **rechecked** against private trusted registry, including active flag, verified owner, App/OA destination and installation IDs.
6. All six receipts consumed synchronously before asynchronous authority queries; repeated or concurrent UAT attempts fail closed. Expiry checked once more after callback completion.
7. Success returns **NO-SEND/NO-COMMERCE/NO-PRODUCTION plan only**, never a DB query, provider send or valid hosted release attestation. A simulation with fake private keys is NOT real provider/owner UAT.

The **legacy** `planPrivateCanaryBinding` remains available as a source-only V17.1R compatibility helper, but **must not** be promoted as real hosted UAT because it does not perform this fresh two-Store revalidation.

## 3. Independent adversarial QA

`qa/v171s-private-uat/private-admission.test.cjs` replays 82 V17.1R synthetic cryptographic and receipt tests plus 25 new cases (107 candidate). New cases cover:
- Positive **fake** two-owner, two-Store, four-native-signature source-only plan.
- Owner A/B session revocation, role downgrade, Store or Tenant mapping changes after signed JWT receipt.
- Disabled/reassigned Meta Page/Zalo OA installations after native signature receipt.
- Duplicate/reused/fabricated owner and provider capabilities.
- Missing OA signature, repeated channel, same owner for two Stores, expired receipts, expiry during slow backend.
- Private callback outage and concurrent UAT admission, ensuring no double use.
- PII-free result and explicit `productionReleaseApproved=false` even on successful synthetic verification.

GitHub CI also runs 855 inherited independent source regressions, standalone disposable PostgreSQL 17 temporary-row Store A/B RLS with rollback, and intentionally failing real-owner/native-provider hosted NO-GO gate. Do not count a real private JWT/signature UAT as PASS absent actual privately authorized evidence.

## 4. Real private UAT checklist (BLOCKED until owner authorization)

1. Operator and independent owner approve private QA App/OA/Page identities, two real QA owners in two DIFFERENT Stores of SAME Tenant, isolated staging data. No reassigning existing merchant owner or production Store memberships merely to pass QA.
2. Run protected private Auth login for two separate users without copying access tokens or refresh tokens to chat, n8n logs, GitHub, QA spreadsheets or general storage. Verify signed JWT issuer/audience/session_id, live Supabase session existence and current owner Store membership.
3. Receive genuine Meta Page and Zalo OA webhook messages (one each per Store) through independent access-protected, disabled-send, owner-authorized QA callback. Verify exact raw body, provider-specific signature, destination/app/installation, event idempotency and replay service. Never send test replies to real customers.
4. Confirm private server registry has same Tenant and different Store mapping for the two owner identities, with fresh authorization at UAT commit. Store controlled records are NOT allowed to spoof provider installation or owner proof.
5. Separate least-privilege database tester must independently check A→A allow, A→B deny, B→B allow, B→A deny using actual JWT and explicit Store-level RLS with approved disposable QA records, including customer order grant. Do not use postgres/service_role/SECURITY DEFINER to bypass RLS.
6. Independent reviewer records a **PII-free cryptographically authenticated** acceptance receipt and exact test/run/SHA evidence. A boolean `verified=true` pasted by the client or a static GitHub manifest is insufficient. Any missing prerequisite implies NO-GO.
7. Publish/change-production permission is a **separate** explicit decision after the above steps; this PR never grants it.

## 5. External standards verified

- Zalo OA `X-ZEvent-Signature`: `mac=sha256(appId + data + timeStamp + OAsecretKey)`, where data means native JSON event data. See https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan
- Supabase `auth.getClaims()` verifies JWT, `auth.getUser()` retrieves an up-to-date Auth record, `auth.sessions` stores session IDs and must be independently checked when immediate revocation matters. See https://supabase.com/docs/reference/javascript/auth-getclaims and https://supabase.com/docs/guides/auth/sessions
- Meta signed webhook is raw-body HMAC-SHA256 via provider App Secret. Verify actual approved provider header and app setup before live validation.

## 6. Impact and rollback

Only isolated GitHub code, tests, documents and Draft CI are changed. No n8n workflow created/edited, no Supabase writes, migrations, Auth/membership, media upload, credential/secret changes, live Messenger/Zalo callbacks, customer data reads, orders, inventory, payment, or customer messages. No external costs requested.

Rollback: close V17.1S child Draft PR. Parent V17.1R and Published nodes stay intact.
Release: **HOSTED NO-GO** until verified owner-issued JWTs, private signed Meta/Zalo events, Store-level RLS and independent QA receipts exist.


## 7. Independent acceptance evidence — VERIFIED 2026-11-17 JST

Tested source SHA: `c67f47838bd2c3ff61e4f3c352b206526e6b4600`.
GitHub Actions: https://github.com/ngoctien20/demo-git/actions/runs/44066189728

- Source job `133980359659`: **SUCCESS** — **107/107** new V17.1S dual-Store JWT/source native signature tests, **855/855** inherited security/Commerce regressions; **962/962 tests PASS**. Static checks confirm no real network, provider credentials, Auth secrets or database I/O, and hosted release explicitly NO-GO.
- Disposable PostgreSQL 17 job `133980360082`: **SUCCESS** — temporary Store A/B RLS fixture within the same synthetic Tenant, independent database process, ROLLBACK and no retained table; NOT real Supabase Auth JWT/RLS or Commerce read.
- Real owner JWT + Meta/Zalo OA signed production admission job `133980662183`: **FAILURE by design** (fail-closed HOSTED NO-GO), because the required owner, native provider and Commerce evidence does not yet exist.
- A successful source cryptographic test of FAKE events/keys never counts as a genuine signed Meta/Zalo callback or a real Supabase Auth owner session. No hosted UAT was performed.
- Existing Published Messenger V17.17, four V17.15 nodes and Zalo V17.19 remain protected and unmodified. No Supabase writes, Auth grants, customer data, orders, billing or messages.

**Status:** IMPLEMENTED SOURCE, TESTED 962 SOURCE QA, TESTED DISPOSABLE PG17, PRIVATE REAL OWNER/JWT/OA UAT BLOCKED, PRODUCTION NO-GO.

This documentation-only checkpoint commit changes HEAD; independently verify final commit CI before the final sign-off.

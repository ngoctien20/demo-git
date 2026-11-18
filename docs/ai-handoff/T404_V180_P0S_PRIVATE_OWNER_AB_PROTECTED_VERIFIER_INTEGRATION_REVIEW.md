# TIEN404 V18.0-P0S — Private Real Owner A/B Admission × Protected Verifier Integration Review

**2026-11-18 JST · VERIFIED LIVE INVENTORY / IMPLEMENTED SOURCE-ONLY CHECKLIST / HOSTED REAL-AUTH UAT NO-GO**

Parent: [Draft PR #385](https://github.com/ngoctien20/demo-git/pull/385), P0R source HEAD `00cb388f182543789bba3484f5de59fb7d0e6301`. Do NOT restart the SaaS authentication layer, change production, publish provider workflows or grant Store access.

## 1. Independent current-state inventory, not user-supplied evidence

- **GitHub:** PR #385 is OPEN DRAFT. P0R source-only verifier contract and 20/20 synthetic negative QA exist; no private hosted verifier integration.
- **Render:** connected API confirms `tien404-data-staging` (`srv-dbphtas9v7es73bursrg`) running deploy `dep-dbqj9plg1s2s73egr30g`, source `ab940a95dae8afdff426bc6ac71693833d5348ce`. Auto deploy OFF; web service has `0.0.0.0/0` IP allowlist. Its current FastAPI validates Supabase `/auth/v1/user` but its tenant endpoints do not implement a current `session_id` revocation check, independently signed Cloudflare Access JWT, separate owner consent receipt or Store permissions.
- **Cloudflare:** read-only Access application inventory returned **four applications**, none matching the existing direct Render service host. There is no verified Access app / audience currently protecting a new private verifier endpoint. Existing Access apps unrelated to P0S must not be repurposed without per-action review. No Cloudflare settings were changed.
- **Supabase:** staging project `ifxlvrhyjhbzbrkdsida` is `ACTIVE_HEALTHY`. Aggregate-only SELECT proves one tenant has 2 eligible active owners, just 1 owner with an `auth.sessions` record (and 1 with a nonexpired-looking record). An unrelated tenant has 1 eligible owner with a session record. The records do **not** prove a live signed real JWT, genuine revocation status or browser possession. Canonical `public.stores` / `public.store_memberships` count **0**; relevant Commerce `store_id` count **0**.
- **Operator:** two different accounts already confirmed by founder; do not request more accounts. **P0O real local comparison not received**, no independent owner A/B private consent receipt, no protected signed server A/B receipt.
- **Existing UAT:** planned 31 JWT Store A/B negative cases **NOT_RUN**. No Meta/Zalo/Messenger delivery UAT is authorized by this phase.

## 2. P0S source-only integration review artifacts

- `qa/v180-p0s/verified-readonly-environment.json`: sanitized environment metadata (counts and nonsecret deployment references only).
- `qa/v180-p0s/protected-verifier-integration-review.mjs`: pure, input-untrusted checklist assessor. Its flags are **review metadata**, NEVER authentication. It emits only a pre-approved fixed set of reason codes and false privilege flags; even if all flags are true, it reports `CHECKLIST_COMPLETE_INDEPENDENT_APPROVAL_STILL_REQUIRED`, never authorizes endpoints.
- `qa/v180-p0s/protected-verifier-integration-review.test.mjs`: fabricated metadata scenarios for bypass, stale session, missing owner consent, misuse of self-assertions and output sanitization.
- `.github/workflows/v180-p0s-private-verifier-integration-review.yml`: GitHub Actions source-only QA. It performs no HTTP calls, database changes, secret fetch or privileged integration.

**This is an INTEGRATION REVIEW, not a private hosted deployment.** No new endpoint or JWT verification adapter exists at the P0S checkpoint. Do NOT connect a real session or owner identity to this GitHub Action or checklist.

## 3. Proposed trust boundary and integration architecture (NO-HOST)

```text
Existing authorized QA browser A/B -- private normal Auth session (separate profiles)
                  |
                  | HTTPS, explicit independent consent per owner
                  v
Dedicated protected QA hostname/path (NOT CURRENTLY PRESENT)
  Cloudflare Access app + signed JWT audience + issuer + JWKS
  deny bypass/unmatched path/service-auth gaps
                  |
          Origin-level enforcement:
          reject missing/invalid Access assertion EVEN on direct Render origin
          private allowlist and/or private tunnel when approved
                  |
                  v
Staging-only FastAPI isolated /internal/private-auth/ (PROPOSED, NOT DEPLOYED)
  fixed size, rate cap, privacy-safe audit, short timeouts
  independently verified Supabase signed claims + live auth.getUser()
  auth.sessions current session_id/user_id/revocation check under
    separately approved least-privilege server adapter
  trusted tenant owner membership and separate scoped consent
                  |
          two different accounts and sessions, same trusted tenant
                  |
                  v
  ephemeral candidate evidence -> atomic consume & TTL receipt
  only after later SECURITY APPROVAL; no Store/order/provider permissions
```

**Hard blocks for actual endpoint admission:**
1. Private Access app must target ONLY the approved QA hostname/path, with reviewed policies and no Bypass. A normal `*.pages.dev` or unrelated founder Access application is **NOT** a substitute.
2. Direct Render host must be origin-deny protected for the proposed endpoint; browser `Origin`/`Referer`, CORS alone, Host header, email and trusted caller-supplied booleans are insufficient. Validate signed `Cf-Access-Jwt-Assertion` at origin for issuer, audience, expiry and signing keys with pinning and bounded JWKS cache; reject unsigned/spoofed copies. The application cannot assume a reverse proxy stripped attacker-injected headers unless independently verified.
3. Independently authenticate the Supabase JWT from EACH existing owner: verify signature/issuer/audience/sub/iat/exp/session_id with official Auth/JWKS or equivalent trusted verifier, call live `/auth/v1/user`, correlate to server current session and revoked/invalid `session_id`. Merely querying a session row or decoding JWT is not sufficient. Avoid using user-editable metadata as authority.
4. Require an independently verified Access principal↔Supabase actor mapping, fixed tenant scope, two distinct subjects, two distinct valid sessions, two independently granted consent receipts. Do not assume a tenant `owner` is Store A or B owner; Store authority separate.
5. Server-side fixed TTL consent pair, atomic one-use consume, replay denial, rate limits, short audit retention and redacted logs; private callback must not include JWT/IDs/emails in URL, query, screenshots, logs, GitHub, n8n or ChatGPT. Plan what happens on timeout or revoke.
6. Before enabling hosted Access policy/privileged DB read/credentials, obtain founder’s **separate explicit approval** and independent security reviewer. Before hosted Store DDL/RLS/grants/migration, require M0 backup/restore evidence and separately authorized change window.
7. Isolation negative UAT remains independent: tenant A/B and Store A/B data-deny, cross-channel Messenger↔Zalo Store resolver, provider signatures and real-order access must not be inferred from identity-only proof.

## 3A. Runtime integration compatibility review (P0R Node vs deployed FastAPI Python)

**BLOCKED BEFORE ANY LIVE ADMISSION:** P0R is an isolated JavaScript/Node candidate in `qa/v180-p0r/`; the current Render gateway is FastAPI/Python at `ops/data-platform/app/main.py`. The P0R module cannot be imported directly by Python, and no network bridge or additional Node service has been deployed. Preferred integration is a reviewed **Python-native** verifier implementation inside an isolated staging-only FastAPI module, using P0R as behavioral specification and re-running the same negative tests with Python-native adapters. Do not add a second public Node service merely to reuse the QA module.

The existing public `identity()` / tenant-read paths must remain unchanged pending backward-compatibility review; a new *separately protected* route must not be mounted until Cloudflare Access/private-origin, independent Auth A/B consent and live session/credential access conditions are signed off. Match exact auth/session/consent contracts before considering an integration PR. This technical gap is additional to the operational blockers above.

## 4. Privacy-safe next operator step (only existing authorized QA accounts)

When the two existing QA owners independently consent to a **local read-only** browser comparison, use the already-existing P0O staging page at
`https://tien404-auth-staging.onrender.com/auth-evidence.html` in separate browser profiles. This page is *not* a private server verifier or a Store permission test. Share **only** `LOCAL_COMPARE_PASS` or the page's non-sensitive `BLOCKED_REASON`, never screenshot containing user IDs/emails, JWT, passwords, challenge, raw receipt or local fingerprint. If B has no valid browser session, stop; don't silently sign them in or change account credentials.

Founder's confirmation of **two distinct accounts** is already recorded; do not repeat that question. Neither the founder's simple approval to continue source work nor this document substitutes for separate consent from account B and a protected hosted verifier rollout approval.

## 5. Gate and rollback

| Gate | Current |
|---|---|
| Real Access app protecting new private verifier | **BLOCKED** (none found for Render) |
| Direct origin bypass eliminated | **BLOCKED** (currently public service, no verifier protection) |
| Independent signed A/B JWT browser session proof | **BLOCKED** (only one session record in aggregate) |
| P0O A/B local comparison | **NOT RECEIVED** |
| Independent A/B private consent | **NOT VERIFIED** |
| Dedicated Auth current-session adapter | **PROPOSED** |
| Server-signed private one-time receipt | **PROPOSED** |
| Canonical Store A/B owner authority | **NOT PRESENT** |
| Real JWT Store isolation tests | **0/31 NOT_RUN** |
| Production, provider send, customer/order writes | **NO-GO** |

No Render/Cloudflare/Supabase hosted mutations or provider sends. Source rollback: revert P0S files/commits on Draft PR #385; production runtime rollback is not applicable. **Never describe synthetic CI SUCCESS as real JWT UAT SUCCESS.**

Independent documentation for design reviewers:
- Cloudflare Access JWT validation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Supabase Auth signing keys: https://supabase.com/docs/guides/auth/signing-keys
- Supabase Auth sessions: https://supabase.com/docs/guides/auth/sessions

**Decision: P0S_LIVE_INVENTORY_VERIFIED / SOURCE_INTEGRATION_QA_CANDIDATE / PRIVATE_ACCESS_ABSENT / OWNER_AB_REAL_AUTH_BLOCKED / HOSTED_AND_PRODUCTION_NO_GO.**

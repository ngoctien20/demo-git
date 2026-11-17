# V17.4P-HOSTED — dedicated QA Access × managed secrets × external browser canary

**2026-11-17 JST · CHILD DRAFT · NO DEPLOY · NOT COMMERCIAL ACCEPTANCE**

Parent: Draft PR #268 at audited base `165925b3205e42db8cf095b4b42893eacc0a3b95`. This child does not touch Pages, production, GitHub gh-pages, Render, Messenger, Zalo, Commerce or customer records.

## Live Cloudflare read-only evidence

- Account access verified by connector. **23** existing Worker scripts; no `tien404-v174p-private-qa-issuer` script.
- **1** Access app `tien404-ai-git-staging - Cloudflare Pages`, scoped to `*.tien404-ai-git-staging.pages.dev`. It does not protect the proposed QA Worker.
- **0** Durable Object namespaces; **1** Worker custom-domain mapping belonging to the personal BIO site. No isolated V17.4P host.
- Source parent #268's GitHub Actions 87/87 checks are local/synthetic, **not real hosted Access UAT**.

## Code changes in this child (source only)

1. `hosted-issuer.worker.mjs`: supports both native Worker string secrets and Cloudflare **Secrets Store** async `.get()` bindings. Read of missing, invalid or failing managed secrets now fails closed with generic 503; never logs/returns secret values. Pin JWKS, verify RS256 JWT and bind synthetic session to Access subject as before.
2. `hosted-issuer.test.mjs`: four new non-network security tests for managed secret retrieval and missing/unavailable/invalid values.
3. `browser-hosted-canary.mjs` and `browser-hosted-canary.test.mjs`: **manual, not CI-triggered** operator-hosted Canary and seven offline admission tests. Runs only with per-run approval, exact HTTPS QA host, independently validated dedicated Access app and ephemeral preauthenticated operator browser state. Checks unauthenticated Cloudflare Access login redirect, signed-in mobile Chromium, three fake catalog turns, Store B denial, create_order denial, duplicate replay, 0 provider/model/Commerce operations, and no off-origin traffic.
4. Source CI additionally syntax-checks canary and tests its **offline admission only**. The real hosted browser UAT and production release CI jobs **remain SKIPPED**.

## Managed Secrets option / control

Prefer an isolated Cloudflare Secrets Store with `V174P_SESSION_HMAC_KEY` (strong randomly generated) and `V174P_ACCESS_JWKS_JSON` (Access public JWKS, still configuration-controlled). Binding names must match source. Do not use plaintext `vars`, GitHub Actions secrets, test default values, production Shop secrets or operator tokens. Managed account secrets are *different* from per-Worker secrets: Secrets Store bindings return values via `await binding.get()`. Rotate and audit keys only after explicit operator authorization.

## External Browser Canary — operator-run after separate approval

Set locally, **without committing any values**, these environment variables:

- `T404_V174P_ISSUER_ORIGIN`: the exact separately approved Access-protected HTTPS QA host (not personal BIO or Pages)
- `T404_V174P_CANARY_APPROVAL=QA_NO_SEND_ONLY`
- `T404_V174P_ACCESS_INDEPENDENTLY_VERIFIED=YES`: only after Cloudflare Access API evidence confirms exact issuer host, policy, and audience (self-report does not constitute proof)
- `T404_V174P_OPERATOR_CONFIRMED=YES`
- `T404_V174P_NO_REAL_DATA=YES`
- `T404_V174P_OPERATOR_STORAGE_STATE_FILE`: **absolute path outside Git** to one operator's temporary authorized Playwright storageState file. Unix 0600; on Windows apply restrictive account ACLs. Never share this file, Access cookie, credentials, JWT or HMAC key.

With Playwright/Chromium installed on the **operator's controlled machine**, run `node qa/v174p-private-hosted/browser-hosted-canary.mjs`. The script is deliberately not called by Actions. It fails closed if Access responds without a clearly attributable login redirect; do not downgrade verification to a Worker-only 401. The script emits only sanitized check flags. Immediately delete the ephemeral operator state after acceptance.

## Mandatory approval/release gates — **NO GO**

- Per-action owner approval for **new Worker, exact QA hostname, Access app/policy and operators, secret creation/bindings, billable Durable Object and browser Access session**; agree on a cost/spend boundary.
- Independently verify edge Access is enforced on **workers.dev and preview URLs** and no alternative direct public route; Worker JWT verification is a second defense only.
- Rate limiting, Durable Object key TTL garbage collection, atomic collision/concurrency tests and log redaction/alerting remain **NOT IMPLEMENTED/NOT TESTED** for hosted exposure.
- Cloudflare real Worker, Access app, Secrets Store bindings, Durable Object, live TLS browser canary, rollback and billable resource tests remain **NOT DEPLOYED / BLOCKED**.
- Merchant-owned domain challenge, Store ownership/membership and independent hosted Shop A/B JWT-RLS acceptance remain **NOT PROVEN**. Never allow real order, customer cross-channel lookup, payment or provider send.

**Rollback:** this child Draft can be reverted without affecting any hosted resources because none were changed. No key rotation/revocation, Access policy edit, route creation, data deletion or deploy is authorized by this Draft alone.

References: https://developers.cloudflare.com/secrets-store/integrations/workers/ and https://developers.cloudflare.com/workers/configuration/cloudflare-access/ .

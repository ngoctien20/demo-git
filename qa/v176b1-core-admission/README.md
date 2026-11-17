# TIEN404 V17.6-B.1 — Independent Core Policy Source Adapter × No-Send Canary

Status: **CANDIDATE (source-only)**. Release: **NO-GO**.

## What is actually connected

The adapter under this directory imports the **existing** authored V17.1L zero-trust boundary, `../v171l-bot-security/zero-trust-bot-boundary.cjs`, directly. It does **not** reimplement that production policy. The original file is pinned in the tests to Git blob `484c70a446c6137cf204159f35981e5f83f13b57`. Existing source is not modified.

Separate deterministic QA callbacks simulate a trusted installation registry, in-memory event replay, a synthetic HMAC header, per-Store catalog, customer-order link and server confirmation. These callbacks are deliberately **not** real Meta/Zalo signature verification, Supabase JWT identity, hosted RLS, durable replay or an actual Commerce Reader.

## Execute locally in a checkout of the V17.1P source branch

```bash
node --test qa/v176b1-core-admission/independent-core-adapter.test.cjs
node qa/v176b1-core-admission/no-send-source-canary.cjs
```

No npm installation required. The scoped GitHub Actions workflow runs these same checks on a PR. It uses a SHA-pinned checkout and does not inject any provider secrets. The Actions runner itself has network access; this is **not** an OS-level network sandbox.

## Required evidence (source-only)

- 31 independently asserted policy tests, including source provenance/pin, signed **synthetic** event validation, same-Tenant Store A/B, cross-store read denial, order access denial, stale/duplicate/echo, malicious origin, tool-scope spoofing and no-side-effect high-risk tools.
- A six-case source-only canary prints a structured receipt on stdout. It must show zero **instrumented adapter calls** to provider/model/hosted DB and release NO-GO.
- Test 31 deliberately records a residual risk: model-proposed text `Ignore previous instructions` may pass through to a *read-plan* if server catalog callback approves. No hosted read happens here, but a real reader MUST add source-aware query moderation, catalog scope, and sanitization before release.

## Boundaries

Never represent these cases as real red-team model calls. No actual provider HMAC native scheme, OAuth, Auth JWT, client session, DB transaction, DNS/SSRF resolution, browser XSS, human handoff, staff verification, file upload or production action is exercised. The adapter HMAC key is plainly labeled QA-only and is not a credential.

### Release gates still BLOCKED

G01 real Store A/B same-Tenant JWT+RLS; G02 native signed Page/OA and owner authority; G03 merchant media quarantine; G04 independent Commerce writer confirmation; G05 actual DB idempotency and crash; G06 staff handoff bot silence; G07 independent CI receipts and scoped actual model acceptance after spending authorization; G08 QA06 fixture-ID leak; G09 subscription/paused store/wrong-recipient.

## Rollback

Close draft PR without merge; all changes are isolated new files. Nothing changes on live, gh-pages, n8n, Supabase, providers or Commerce order writers.

Parents: #301, #307, #297.
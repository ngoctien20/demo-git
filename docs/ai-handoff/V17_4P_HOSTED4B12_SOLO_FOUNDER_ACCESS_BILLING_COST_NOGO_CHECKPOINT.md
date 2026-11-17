# TIEN404 AI — V17.4P-HOSTED.4B.12
## Solo Founder Real Access MFA × Billing Authority Read-Only UAT × Cost-Bounded Private Canary Admission

**Date:** 2026-11-17 JST. **Parent:** [Draft PR #344](https://github.com/ngoctien20/demo-git/pull/344), HEAD `e56243fe50ac0ddbd65ecdf7921892604bcb407b`. Parent source QA additions currently have **NO independently confirmed CI run**. Earlier [Draft PR #340](https://github.com/ngoctien20/demo-git/pull/340) had 705/705 PASS; do NOT transfer that result to #344 or 4B.12.

**Scope:** SOURCE/LOCAL preparation only. One real human may legitimately be both project Owner and Finance. A ChatGPT delegation permits work on Draft/source/QA, **not** an independently authenticated MFA or live financial authorization. No invented independent Finance officer.

## 1. Real Cloudflare authenticated GET-only audit

At **2026-11-17T13:05:58.058Z** (22:05 JST), Cloudflare connector read:
- **31/31 Worker entities and 31 scripts**: previous checkpoint had 30/30. A concurrent worker was added; origin/ownership/approval **NOT verified**. Do not modify/recycle it. Revalidate this inventory immediately before any later hosted release.
- **3/3 Durable Object namespaces** retain existing V17.5 E.2 ReplayBucket, V17.5 E.2A RunnerResults, and Zalo V17.21H.2 ZaloBotReplayBucketV2; names, owning scripts and classes unchanged.
- **2 Access self-hosted applications**, one accepted Super Administrator member; identity provider types `cloudflare` and `onetimepin`. An IdP list or successful OTP is **not** proof that phishing-resistant independent MFA was enrolled, enforced or used by this Founder on the actual private app.
- Both proposed `tien404-v174p-private-permit-ledger` and `tien404-v174p-private-qa-issuer` **ABSENT**.
- `GET /billing/spend-policies`, `GET /billing/usage`, `GET /billing/profile` each returned **HTTP 403**. No real billing details, account usage, risk or specific USD budget were available via this connector.
- Only GET methods were used; NO actual Cloudflare Worker/DO/Access/Billing/R2/DNS/secret modification, no real Merchant files, no provider sends and no customer writes.

## 2. Implemented source-only Access JWT mathematics

`qa/v174p-private-hosted/hosted4b12-solo-founder-access-billing-cost.mjs` exports `verifySyntheticPinnedAccessJwt`:
- Offline RSA-SHA256 signature validation against a **caller-configured synthetically pinned** RSA JWK. Strict header algorithm **RS256**, exact key ID and `typ=JWT`, reject `none`, HMAC confusion, attacker JKU, untrusted key, forged signature, expired/not-before token, stale auth, issuer/audience mismatch, wrong Founder **hashed** subject, long session TTL, oversized JWT and invalid base64url.
- Valid simulated JWT returns `signature_math_verified:true` **but always** `live_access_verified:false`, `real_phishing_resistant_mfa_verified:false`, `can_authorize_spend:false`. The public key in local input is NOT proof it came from Cloudflare. A future real deployment must use private operator-controlled independently pinned Cloudflare issuer/JWKS with safe rotation, correct Access audience and separate verified phishing-resistant MFA/Access policy, and must verify a real browser session without exposing the JWT.
- Do NOT feed a real Cloudflare Access token, email, password, MFA recovery code, worker secret or billing document into GitHub, CI synthetic fixtures or ChatGPT.

## 3. Implemented source-only cost-bounded canary assessment

`assessSoloFounderPrivateCanary` accepts metadata-only:
- 60-second freshness requirement for read-only Cloudflare inventory, Worker/script parity and **all three protected DO owner/class tuples**; current 31 workers (not hardcoded), target ledger+QA worker must both be absent, existing two IdP types recorded, three Billing routes truthfully **403**.
- Exact Git commit, account, one pseudonymous founder subject SHA256, ledger-first *review-only* scope, no public development URL / preview URL / custom domain, no provider sends, customer reads, Billing/Access edit, or automatic deployment.
- **Only synthetic local limits**: maximum 50 requests, maximum 15 minutes, positive test cap up to USD 25. Example fixture uses 20 requests, 10 minutes, USD 2; **this is NOT money actually authorized by the user and not a Cloudflare or DO invoice cap**. Actual distributed metering is unproven. Cloudflare Workers/DO spending limits are shared account-level and stored bytes/subscription fees can be excluded.
- The actual Finance/Owner approval packet remains `null`/false, because Billing 403 and real MFA lacking. All positive *structural* results retain `decision:'HARD_NO_GO'` and `can_create_hosted_ledger:false`, `can_upload_qa_worker:false`, `can_change_access:false`, `can_change_billing:false`, `mutations_executed:false`.
- No private broker hosted or one-use durable nonce ledger is created.

`hosted4b12-solo-founder-access-billing-cost.test.mjs` adds **60** synthetic token and red-team policy tests. Retain **45 V17.4P.4B.11 local challenge tests**, previous local Workerd SQLite 16 and Chromium simulated Access 21. **Never claim CI PASS until exact-head logs or independent local executions prove it.**

`hosted4b12-solo-founder.pending.example.json`: safe public checkpoint, excludes account member emails/IDs, raw billing, real JWT and private signing keys.

## 4. Independently staged GO / NO-GO

| Gate | Current decision | Proof to advance |
|---|---|---|
| Read-only Cloudflare audit | VERIFIED (historical) | Renew just before any hosted action |
| 4B.11/4B.12 source QA | PENDING until exact-head CI or separate local evidence | GitHub Actions green or locally reproduced full source run |
| Solo Founder role | ACCEPTED for source/local QA | Already authorized in chat; no fake human Finance signer |
| Real Founder Access session | **NO-GO** | Actual private Access-protected browser session with valid issuer/audience, bound Founder identity, phishing-resistant MFA independently configured/verified |
| Finance read-only UAT | **NO-GO** | Read Billing as the real Founder through the official dashboard/least-privileged authorized account, record actual current exposure privately or approved scanned alternative; current connector 403 |
| Explicit trial cost | **NO-GO** | Founder explicitly approves a concrete positive USD maximum and understands account-wide spend limits vs billable storage; no implicit $2 or $25 authorization |
| Private inactive canary | **NO-GO** | Separately approved cost/identity/rollback, no public URL, original resources unchanged, a fresh full inventory and exact deploy manifest, external independent hosted QA |
| Live Messenger/Zalo/Commerce | **HARD NO-GO** | Separate provider, Store A/B auth, RLS, contract and human acceptance |

## 5. Practical human steps — no secrets in this chat

1. In a fresh personally authenticated Cloudflare dashboard session, open [Billing / Spend Management](https://dash.cloudflare.com/?to=/:account/billing) and inspect actual Workers/DO spend and alerts **READ ONLY**. Do not edit billing or create an API token.
2. For Access, review independent MFA rules in Cloudflare Zero Trust settings; avoid assuming one-time PIN constitutes phishing-resistant MFA. Confirm the exact private app and private login method out of band. Do not share session tokens or recovery codes.
3. Decide a **specific USD spend risk allowance** for a future isolated inactive QA canary; keep operational guardrails separate from actual account-wide billed spend. If user grants it in chat, record intent, but do not automatically deploy without independently authenticated authority and verified costs.
4. Only then issue a new private, signed, time-limited owner/finance/rollback permit bound to exact target and Git SHA, and run Access-protected real UAT followed by a separate explicit hosted go/no-go. Keep all production workflows and parallel teams unchanged.

**Rollback:** close/revert this child Draft only; no Cloudflare rollback required as actions here were GET-only.

Official guidance: https://developers.cloudflare.com/workers/configuration/cloudflare-access/ | https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/ | https://developers.cloudflare.com/billing/manage/spend-management/ | https://developers.cloudflare.com/durable-objects/platform/spend-management/

# TIEN404 AI — V17.4P-HOSTED.4B.11
## Solo Founder Governance × Local Signed Challenge × Hosted NO-GO

**Checkpoint date:** 2026-11-17 JST. **Parent:** Draft [PR #340](https://github.com/ngoctien20/demo-git/pull/340), exact SHA `f48354e2e3a2fc6ca365c124a308b80c1dc5627a`, **705/705 local QA PASS**. Source-only child Draft; NOT merged or deployed.

## 1. Founder authorization and real governance

The project's sole actual operator explicitly authorized continuation in chat on 17 Nov 2026. This permits safe preparation, source changes, local synthetic no-send QA and a separate Draft PR. A conversational statement **does not cryptographically establish an authenticated Cloudflare session, legal financial mandate, verified spend policy, or a scoped paid deployment release**.

**One real person may act as Owner AND Finance for an early-stage solo business.** Do not invent a second legal human signatory, fake independent Finance Officer or external Auditor. Independent **technical** testing through GitHub Actions, local Workerd SQLite and Chromium is available, but it is not equivalent to an independent human financial audit. Multi-party financial separation should become a later release requirement when real staff or outside reviewers exist.

New source file `qa/v174p-private-hosted/hosted4b11-solo-founder-local-challenge.mjs`:
- `assessSoloFounderGovernance` accepts the explicit Owner+Finance same-human model with `SOLO_FOUNDER_QA_ONLY` scope; refuses fabricated separate-role claims, self-asserted hosted billing approval or production permissions.
- `createLocalSoloFounderChallenge` demonstrates cryptographic identity challenge math using an **explicitly locally pinned Ed25519 public key**; binds account, exact Git SHA, one pseudonymous founder subject, QA-only scope, cost risk acknowledgment, random 256-bit nonce and 120-second TTL; rejects wrong signature, domain, expired nonce, duplicate nonce, wrong user, wrong scope, missing cost acknowledgment and repeated failed attempts.
- Reuse of local-memory nonce is rejected **only in this in-memory process**; it is not a durable hosted replay ledger and cannot prove identity of any real human. The local signing key is a synthetic test key; no private key or credential in GitHub.
- Even a valid signed local challenge always returns `real_founder_identity_verified:false`, `real_finance_budget_verified:false`, `can_create_hosted_ledger:false`, `can_change_billing:false`, `mutations_executed:false`. Local-only permission is not a hosted release permit.

New `hosted4b11-solo-founder-local-challenge.test.mjs`: 45 synthetic positive/negative QA cases for same-person governance, no fictional second signer, Ed25519 domain separation and pinning, 120s nonce replay, malformed consent, wrong commit/account, rate-limit, no durable state, no customer data or public route.

New `hosted4b11-solo-founder.pending.example.json`: source-only founder permission marked **not cryptographically authenticated**, cost approval missing (`null`), Finance Billing API 403, private hosted IdP/ledger absent; all hosted permissions false.

## 2. Real Cloudflare GET-only inventory

At **2026-11-17T12:52:51.188Z (21:52 JST)** via connected Cloudflare API:
- Worker entities **30/30**; Worker scripts **30/30**.
- Durable Object namespaces **3/3**; V17.5E.2 ReplayBucket, V17.5E.2A RunnerResults, and parallel Zalo V17.21H.2 ZaloBotReplayBucketV2 script/name/class unchanged.
- Access apps **2**, accepted Super Administrator member **1**.
- Proposed `tien404-v174p-private-permit-ledger` and `tien404-v174p-private-qa-issuer` **ABSENT**.
- `GET billing/spend-policies` **403** and `GET billing/usage` **403**. This connected principal cannot verify actual account-wide spend policy/usage from those endpoints.
- This is live **Cloudflare GET-only control-plane inspection**, not real User Owner Access UAT and not a billing mandate. Snapshot expires for any future permit; no persistent reservations.

## 3. What we can proceed with safely right now

**AUTHORIZED / IMPLEMENTED:** source-only Draft, local signed challenge acceptance QA, regression test security, checkpoint and rollback plan. No changes to Cloudflare resources, billing, Access policies, secrets, DNS, R2, messenger/Zalo, Supabase, n8n, Commerce or live customer data.

**STILL NO-GO:** Create/modify Worker or Durable Object; provision protected hosted private broker; upload real Merchant documents; change Billing/Access; run paid production/hosted trial; make provider sends. New privately authenticated hosted UAT needs:
1. A real founder session bound to Cloudflare Access with approved MFA and registered identity/key **out of band** (not a ChatGPT comment).
2. Verified actual Billing cost/exposure via a separate, authorized read-only Finance session or a preapproved private scanned evidence path; one founder can sign financial acceptance **as the real owner**; there must not be a fabricated independent Finance user.
3. A concrete positive USD maximum *risk authorization* and rollback window. Cloudflare per-product account-wide spend limits are not a per-resource hard invoice ceiling; DO storage/subscription may be excluded.
4. Separately approved private hosted Access scope, least privilege and costs before any Worker or DO upload; rollback. Preserve V17.5/RPC16/Zalo and production privacy.
5. Real one-use nonce persistence and authenticated browser UAT; local in-memory acceptance is insufficient.

## 4. QA and rollback

Existing V17.4P QA pipeline retains source regressions, 16 **LOCAL** Workerd SQLite DO tests and 21 local Chromium **SYNTHETIC Access** tests. Real hosted private Access/browser and actual customer Store-RLS jobs intentionally remain SKIPPED until independent release approval.

**Rollback:** Close/revert child Draft branch only. Parent #340 and 30 Cloudflare Workers, 3 pre-existing DO and 2 Access apps remain untouched. No Cloudflare rollback is necessary as this step made only GET calls.

## 5. Next private, real-world action

The Founder should review account Billing → Spend Management in their authenticated Cloudflare dashboard, note an approved **specific USD trial amount** and the existing account-wide exposure. Only after that, through a separately approved private Access-protected authentication/UAT workflow, establish the human identity, evidence and signed scoped permit. Keep documents and secrets out of GitHub/chat. If no verified payment permissions, keep hosted NO-GO and continue local technical QA.

Official references:
- https://developers.cloudflare.com/billing/manage/spend-management/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/durable-objects/platform/spend-management/

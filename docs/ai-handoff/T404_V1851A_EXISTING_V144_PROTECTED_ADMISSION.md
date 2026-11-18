# TIEN404 AI — V18.5.1A Existing V14.4 Gateway Protected Admission

**Date:** 18/11/2026 JST  
**Environment:** Private staging on existing Cloudflare Worker V14.4  
**Implementation state:** Source-only admission regression and read-only Cloudflare inventory.  
**Production:** NO-GO.

## 1. Goal and scope

V18.5.1A validates the already deployed V14.4 Gateway and its existing exact-host Cloudflare Access application. This is a retrospective protected-admission checkpoint separate from the later V18.5.5 read-only Commerce adapter. Do not create a second Worker, second Access app or a new AI Core.

The user's approval to continue authorizes a narrowly scoped audit and safe QA work. It does not authorize new paid Cloudflare storage, credential rotation, production deployment, policy changes, n8n workflow publication, or access to customer data.

## 2. VERIFIED — existing Cloudflare account configuration

Read-only account inspection:

| Item | Verified value |
| --- | --- |
| Worker script | `tien404-widget-gateway-v144-staging` |
| Hostname | `tien404-widget-gateway-v144-staging.tienmobi208.workers.dev` |
| workers.dev | Enabled |
| Preview URLs | Disabled |
| Current deployment | `b4f501e0-ff37-4ea4-be77-6e3148667b15` |
| Current Worker version | `da022974-1832-425f-bf82-afddc558b893` |
| Traffic | 100% on current V18.5.4 Canary version |
| Exact-host Access application | `1a73d50b-0668-4308-8f56-53aa9711d477` |
| Access destination | Exact hostname; no path suffix or wildcard |
| Access policy | Existing reusable Allow policy `e936ca09-254b-4cc3-8ebd-efca366c7164` |
| Identity policy selector | Email selector; actual identity value omitted |
| Identity providers | One allowed provider |
| MFA | Biometrics required; not disabled |
| Application session duration | 30 minutes |
| OPTIONS bypass | Disabled |
| Worker bindings | Only `T404_ACCESS_AUD` and `T404_QA_OPERATOR_EMAIL` |
| n8n URL/secret binding | None |
| D1/DO binding | None |

Cloudflare's deployed Worker content was independently read back. It contains native `ctx.access`, `getIdentity()`, an exact AUD gate and operator allowlist; private Canary and locked health route. All `/v1/widget/*` paths still return **423** after successful Access authentication. The deployed Worker contains no outbound `fetch` to n8n, no order writer and no provider send.

The pre-Canary original V14.4 Worker source is saved at `qa/channel-v1854/backup/v144-worker-original-98c8aad5.mjs`. Original rollback version `98c8aad5-2dae-47c3-9cb0-8473065213e6` and current V18.5.4 Worker version are recorded.

## 3. VERIFIED — owner runtime, NOT VERIFIED — alternate identity denial

Cloudflare Access audit log for this exact application contains **one** known allowed event:

- `login`, `allowed=true`, `2026-11-18T08:11:58Z`, Ray ID `a5c581ec6c0996aa`.
- The owner independently supplied the real Canary JSON: `CLOUDFLARE_ACCESS_CONTEXT_VERIFIED`, `audienceVerified=true`, `operatorAllowlisted=true`, `privateOrderAccess=false`, `orderWrites=0`, `providerSends=0`, `productionReady=false`.

This is real owner runtime evidence, not an offline mock.

**Blocking negative test:** no denied login from another non-allowlisted Cloudflare account has been observed in the Access audit log. A second browser showing `dash.cloudflare.com/login?login_challenge=...` is a sign-in challenge, **not** evidence that a signed-in non-allowlisted identity was denied. Do not mark the negative test PASS until a real different account is denied.

An attempted anonymous HTTP probe from this tool environment could not resolve the workers.dev host, so **no real HTTP 302/403/200 status was observed**. This tooling limitation is not proof of DNS outage or Access bypass in the user's browser.

## 4. IMPLEMENTED — offline protected admission security matrix

New source:
- `qa/channel-v1851a/v144-protected-admission.test.mjs`: tests the existing V18.5.4 Canary source directly, not a replacement Worker.
- `qa/channel-v1851a/v144-protected-admission-evidence.json`: redacted actual Cloudflare inventory and explicit uncertainty.
- `.github/workflows/v1851a-existing-v144-protected-admission-qa.yml`: GitHub CI, with read-only permissions and no Worker deployment steps.

Coverage includes anonymous denial across protected routes, spoofed JWT/cookie/Origin/forwarded-identity headers, wrong or ambiguous AUD, missing server settings, identity lookup failures, a synthetic different account, approved owner Canary with no identity leakage, locked health, all `/v1/widget/*` paths returning 423 even for owner, CORS/OPTIONS bypass denial, unknown-path behavior, method restrictions and security headers.

**Important:** all synthetic Access contexts in these tests are test doubles. Their PASS result must never be treated as evidence of Cloudflare's real second-account denial.

## 5. Explicit no-change boundaries

No Cloudflare API write was issued in this phase. Existing V14.4 Worker/version/Access app/policy/bindings remain untouched. No new Worker, custom domain, Access policy, secret, D1/DO or Cloudflare paid resource was created.

No n8n workflow was edited, published or activated. The V18.5.5 Header Auth ingress and read-only adapter remain independent and inactive. No private Orders, Store A/B data or customer PII was accessed. No stock/order writes, provider sends, model usage or production rollout.

## 6. Follow-up UAT and production gates

A **real** negative admission test requires the owner to open the same Canary URL in an isolated browser profile with an already-existing non-allowlisted Cloudflare account, complete sign-in, observe an Access Denied screen (not a generic login prompt), and let the team verify the corresponding denied Access event. Do not add users, relax policies, copy credentials or bypass MFA to make the test pass.

The private protected Canary URL is:
`https://tien404-widget-gateway-v144-staging.tienmobi208.workers.dev/__v1854/access-canary`

After negative admission is verified, inspect Cloudflare Access logs again, confirm known routes are still locked, and only then consider an independently approved V18.5.5 HTTP Header Auth UAT. Store-level isolation/RLS remains separate and unproven.

## 7. Rollback and checkpoint

Since V18.5.1A changes only source QA and documents in a dedicated Draft PR, rollback is **close/revert the Draft PR**. There is no new Cloudflare deployment to roll back. The existing deployed Canary is still `da022974-1832-425f-bf82-afddc558b893`; previous historical V14.4 version remains `98c8aad5-2dae-47c3-9cb0-8473065213e6`.

**Decision:** `V1851A_CONFIG_VERIFIED / OWNER_CANARY_RUNTIME_VERIFIED / OFFLINE_ADMISSION_QA_PENDING_FINAL_CI / SECOND_IDENTITY_DENIAL_PENDING / LIVE_CLOUDFLARE_UNCHANGED / PRODUCTION_NO_GO`.

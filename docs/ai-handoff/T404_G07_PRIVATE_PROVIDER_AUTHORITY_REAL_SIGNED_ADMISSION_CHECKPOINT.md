# TIEN404 — G0.7 Private Provider Authority × Real Signed No-Send Admission

**Checkpoint date:** 2026-11-17 JST  
**Lifecycle:** CANDIDATE / DRAFT / OFFLINE & INACTIVE QA TESTED / REAL SIGNED ADMISSION BLOCKED  
**Parent:** [G0.6 Draft PR #260](https://github.com/ngoctien20/demo-git/pull/260), base commit \`a02b89925038577333899f4db5fac428c03826bf\`  
**Current G0.7 child:** [Draft PR #263](https://github.com/ngoctien20/demo-git/pull/263)  
**G0.7 contract:** \`T404_G07_PROVIDER_AUTHORITY_REVIEW_V1\` and \`T404_G07_PRIVATE_PROVIDER_REVIEW_NOSEND_V1\`.

## 1. VERIFIED external provider protocol — source & boundary

### Messenger / Meta

Official Meta Webhooks source: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/

- POST event uses \`X-Hub-Signature-256: sha256=<64 lowercase hex>\`. Compare HMAC-SHA256 of the **unmodified raw HTTP request bytes** using the **specific Meta App Secret**; constant-time comparison. A parsed/re-serialized payload is NOT sufficient. Fail closed on absent, wrong or malformed signature.
- The Meta GET verification-token \`hub.verify_token\` is a *separate webhook configuration handshake*, not proof that a later POST is signed by the right App or owned by the Merchant.
- Even a genuine correctly signed POST does not prove that Page is privately bound to an independently verified Merchant Owner and **canonical** Store UUID. Verify Page/App permission, installation state and Store mapping separately, by private independent Operator + Reviewer.
- Real Meta App ID/Page ID, raw customer event, signing secret, Page access token and installation evidence must NEVER be committed to this repository or echoed to ChatGPT/CI.

### Zalo Bot API

Public community Bot documentation: https://kaiyodev.github.io/zalo-bot-js/en/webhook-events ; additionally check the target official Bot developer docs and actual webhook configuration with the authorized Bot owner before real admission.

- Bot webhook uses \`X-Bot-Api-Secret-Token\` for a configured token (header equality only). **This is NOT a cryptographic HMAC over the POST body**.
- A matching header on a synthetic fixture proves only the token comparison code; it does not independently prove Bot ownership, payload integrity, complete replay safety, real customer identity or canonical Store access.
- Bot API and Zalo Official Account have distinct webhook authority models. Do NOT infer an OA signing contract from Bot header behavior.

### Zalo Official Account (OA)

Official portal: https://developers.zalo.me/docs/

- The exact production native OA callback authentication/signature formula, required header(s), algorithm, app type and version were **not independently established** from the public official material inspected in this iteration.
- **BLOCKED:** no fake G0.6 \`x-qa-zalo-oa-hmac-256\` should ever be used to authorize real OA callbacks; \`ZALO_OA_NATIVE_VERIFICATION_NOT_PROVEN\` remains hard NO-GO.
- Independent authenticated OA developer documentation, current official provider instructions and privately authorized OA/app operator must be reviewed before implementing OA native callback verifier.

### Website

- G0.6 mock \`x-qa-website-hmac-256\` is a synthetic fixture, **not a server-authenticated website session/JWT**.
- \`WEBSITE_PRIVATE_SESSION_ISSUER_NOT_PROVEN\` remains hard NO-GO pending isolated trusted session issuer, CSRF protection and proven Store membership.

## 2. VERIFIED existing system baseline

- G0.5 persisted n8n QA registry \`TIEN404_G05_QA_TRUSTED_INSTALLATION_REGISTRY_NO_SEND\`, id \`3KfooDe1hXk3yN0r\` still has **7 QA-only records**. Every row \`qa_only=true\`, \`approval_scope=QA_SYNTHETIC_NO_REAL_OWNER\`. These do not attest ownership of a real Meta Page, Zalo OA or Bot.
- G0.5 synthetic Store catalog \`qOrmoXfIobogX16d\` remains separate. The G0.7 authority gate **does NOT read it**, because any real event must be refused **before Commerce** until authority is proven.
- G0.6 Inactive pilot \`FqEcdmc8PRRMNUEb\`, no real credential, 36/36 signed-*shaped* QA cases; G0.6 simulated keys may be publicly source-visible and are not trusted secrets.
- Hosted Supabase Commerce still lacks independently attested original Store owners for the 2 Product + 2 Order records, canonical \`stores\` / \`store_memberships\`, and proven hosted per-Store JWT/RLS. Tenant membership is not proof of Store ownership.
- Owner chose to **defer actual local-machine backup work**. Old H11R limited archive milestone stays intact; **current independently accepted restore remains NO-GO for hosted schema/RLS migration**. This does not prohibit continuing source-only QA.

## 3. IMPLEMENTED — G0.7 candidate components

Source-only Node22:
- \`qa/v152-g07/private-provider-authority-gate.cjs\`: immutable fail-closed \`verifyProviderPayload\`, \`reviewAuthorityPacket\` and \`inspectReviewCandidate\`.
- \`verifyProviderPayload\`: a real HMAC algorithm over raw byte Buffer *when secret is injected by a future private server*; never accesses a secret store, environment variable, network or real n8n credential itself. Supports Meta and Zalo Bot token equality as separate methods; **refuses** Zalo OA and Website.
- \`reviewAuthorityPacket\`: strict bounded lifetime and \`SIGNED_NO_SEND_READ_ONLY_QA\` scope; validates SHA-256 commitments of private evidence identifiers and **two Ed25519 signatures** from trust keys configured by a separately owned private server. Enforces Merchant Owner and **different** independent reviewer roles and organizations. Rejects self-supplied trust anchors and scope changes. These tests generate ephemeral fake Ed25519 keys. **Signatures over a statement do not prove underlying original documents or Merchant identity** without separately authenticated trust roots and original evidence.
- \`inspectReviewCandidate\`: even if a synthetic HMAC and both synthetic Ed25519 signatures verify, result remains \`CRYPTO_AND_SIGNED_PACKET_STRUCTURALLY_PASSED__HOSTED_NO_GO\`. All \`canReceiveRealTraffic,canPublish,canReadHostedCommerce,canCreateOrder,canChangeRls\` remain **false**. No secret, raw Page/Store ID, PII or signed body in output.
- Source tests: \`qa/v152-g07/private-provider-authority-gate.test.cjs\` (48 Node22 cases) and \`INACTIVE_PRIVATE_PROVIDER_AUTHORITY_N8N_SDK.test.cjs\` (20 Node22 source-regression cases). Source-only fake test keys; no production-secret material.

n8n:
- Workflow **\`TIEN404_G07_PRIVATE_PROVIDER_AUTHORITY_INACTIVE_REVIEW_NO_SEND\`**, ID \`mmt3ToandWrLAcjH\`; editor https://ngoctien20.app.n8n.cloud/workflow/mmt3ToandWrLAcjH
- n8n Personal \`WW82YsCCaAxGC9dp\`, QA folder \`90_QA - DIAGNOSTICS\` / \`d3ZVrZ9cNiW2SJ1q\`.
- Actual draft version \`9318b189-8d9e-4dcf-94df-71982142cef4\`. Re-read after tests: **Inactive** (\`active=false\`, \`activeVersionId=null\`), **6 nodes** = manual trigger, four Code nodes, one G0.5 Data Table \`get\`; **0 credentials, 0 webhook/HTTP/Send/LLM, 0 catalog reads, no stored pinData**.
- The manual pilot only checks synthetic G0.5 source/20 denial scenarios. **It is not the Node22 crypto preflight deployed into n8n**, and does not prove any real provider HMAC, OA callback, Bot header or real owner. Do not conflate Node algorithm tests with n8n received traffic.

## 4. Actual QA evidence

**n8n manual-only QA:**
- \`4398\`: SUCCESS, **20/20** synthetic attempts to gain *real signed admission* correctly denied; 0 provider send, 0 Commerce Catalog reads, 0 hosted writes, 0 customer rows, 0 model.
- \`4399\`: ERROR **by design** after ephemeral pinned registry first \`qa_only=false\`; refuses \`G05_QA_REGISTRY_AUTHORITY_OR_FIXTURE_DRIFT\`. No persistent registry write.
- \`4400\`: ERROR **by design** after ephemeral pinned generator claims \`real_provider_signature_received=true\`; refuses \`G07_UNTRUSTED_SOURCE_OR_REGISTRY\`.
- \`4401\`: final clean SUCCESS **20/20**, all denied; \`real_signed_events_admitted=0\`, \`can_publish=false\`, \`release_status=REAL_SIGNED_NO_SEND_ADMISSION_BLOCKED\`.
- Final runtime inspected after QA: inactive, 6 nodes with GET-only QA registry, 7 QA registry records unchanged.

**GitHub Actions:** [G0.7 source CI run #44010840456](https://github.com/ngoctien20/demo-git/actions/runs/44010840456) on code SHA \`a4ebef87492b7c694519dffb9fd0b1b338435aba\`: **2/2 jobs SUCCESS**, and actual logs report **48/48 new private crypto/packet tests + 20/20 n8n source regression + 128/128 G0.4–G0.6 inherited = 196/196 PASS, 0 fail**. The hosted NO-GO job passing means **release was refused**, not authorized. If this checkpoint document changes HEAD, independently reverify exact final HEAD CI before asserting exact-HEAD success.

## 5. Private actual Page/OA Operator admission procedure — NOT YET AUTHORIZED

Complete privately and outside GitHub/ChatGPT; do not send raw token, actual Page/OA IDs, customer events or credentials in project chat.

1. **Name scopes and authority:** owner-approved dedicated **QA Page/OA/Bot** or explicitly scoped existing source, a designated Operator and **different independent Reviewer**; obtain explicit permission for exactly **one signed inbound No-Send pilot**. Ordinary QA access is not production Page/OA ownership evidence.
2. **Verify primary provider authority:** independently authenticate Meta App administrator/Page management access, Webhook subscription, valid Meta App Secret authority, Page→App binding and recipient/page ID. For Zalo Bot, verify Bot setup and real secret-header policy; for Zalo OA, first procure official current native signature spec with app/OA access permissions.
3. **Verify Merchant Store authority independently:** private first-party Merchant→canonical Tenant UUID→canonical Store UUID, Store membership, installation ref and bot version; reconcile original 2 Product + 2 Order Store evidence without guessing or rewriting. Keep real identities and source records confined to a confidential Operator system.
4. **Cryptographic attestations:** scope and independently review an original evidence digest and operator approval. The Ed25519 packet in source is **a testable technical envelope only**, not a ready-made legal Owner signature process. Shop owners should not be asked to manage cryptographic keys. Trusted server/operators sign and retain documents; Reviewer must independently inspect underlying records.
5. **No-Send ingress admission design:** use dedicated isolated QA HTTPS receiver, preserve raw bytes, verify provider authenticity **before parsing/routing**, bind verified installation to server-trusted canonical Store registry, reject stale/revoked/ambiguous installations, minimize customer data and prohibit model/Order/Stock/outbound. Deploy no endpoint until scoped approval and a rollback/isolated receiver plan.
6. **Proof capture:** produce anonymized signed result with code version, actual verifier version, provider event classification, synthetic-vs-real label, independent Reviewer receipt, replay/expiry evidence and rollback status. Do not save raw payload/body, secret or Page IDs into CI.
7. **Separate promotion review:** source tests do not authorize real Page/OA inbound; real no-send inbound does not authorize Commerce orders, sends, hosted migrations, OAuth credential changes or production rollout.

## 6. Gate summary

| Gate | Status | Meaning |
|---|---|---|
| G0.7 Meta HMAC/raw-body source algorithm | TESTED OFFLINE | True HMAC algorithm with **fake** test AppSecret only |
| G0.7 Zalo Bot header source algorithm | TESTED OFFLINE | Header equality only, fake secret, no body MAC |
| G0.7 Zalo OA native verifier | BLOCKED | Official native callback verification not established |
| G0.7 dual-signed owner/reviewer packet structure | TESTED OFFLINE | Fake generated keys; not authenticated original Store evidence |
| G0.7 inactive n8n authority NO-GO | TESTED | 20/20 fake real-admission attempts correctly denied |
| Real Meta Page/Zalo OA/Bot authority | BLOCKED | Actual provider account proof/operator not admitted |
| Real canonical Store Owner and multi-Store JWT | BLOCKED | No actual Store owner evidence / Store RLS |
| Current app/Auth/Storage recovery | DEFERRED / NOT CERTIFIED | Local backup task deferred; hosted write/DDL still blocked |
| Real inbound No-Send | NOT RUN | Requires dedicated QA provider permission and ingress isolation |
| Live Messenger/Zalo Sends, Orders, Stock and Published | NO-GO | No consent, no evidence or release admission |

**Rollback:** close Draft PR #263; leave n8n pilot Inactive and QA-only. Existing new n8n workflow persists after PR close. Deletion of QA records, credential attachment, published deployment or hosted DDL/RLS always requires separate explicit scope authorization.

**Checkpoint:** \`G07_PRIVATE_PROVIDER_CRYPTO_PACKET_196_NODE22_PASS__N8N_4401_20_DENIED__REAL_SIGNED_NO_SEND_BLOCKED\`.

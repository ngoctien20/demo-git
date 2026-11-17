# TIEN404 AI — V17.4P-HOSTED.4B.5
## Private Evidence Intake Contract × Attested Owner/Finance/Operator Proof × Sequential Inactive Upload NO-GO

**Date:** 2026-11-17 JST  
**Parent:** [Draft PR #315](https://github.com/ngoctien20/demo-git/pull/315), exact prior HEAD `cf392f52da1eab6525825dd71cf7ca841be86611`, **422/422 PASS** from run #44069342227.  
**Stage:** IMPLEMENTED metadata validator, source/local QA only. No verified real owner/finance/merchant identity. No deployed intake endpoint, private broker, hosted ledger, uploads or cloud mutations. This child remains Draft / unmerged.

### A. Read-only Cloudflare checkpoint (independent of GitHub)
At **2026-11-17T11:25:34.525Z** (20:25:34 JST), GET-only:
- 29 Worker scripts, fully paginated Worker entities 29/29.
- 2 Access apps (Pages staging; separate RPC16 Merchant Evidence Staging — DENY ALL), zero reusable policies and one unrelated Worker domain.
- 2 V17.5-owned Durable Object namespaces `tien404-v175e2-durable-replay-nosend-staging_ReplayBucket` and `tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults`.
- V17.4P QA Worker `tien404-v174p-private-qa-issuer` **ABSENT**; proposed private ledger Worker `tien404-v174p-private-permit-ledger` **ABSENT**. This only proves a point-in-time view, not a reserved resource.
- No Cloudflare resource, subscription, billing, Access, R2, secrets, URL, DNS or stored customer data was modified.

### B. Implemented: private metadata-only evidence dossier
`qa/v174p-private-hosted/hosted4b5-private-evidence-dossier.mjs` is a **pure no-network mathematical verifier**, never an intake API:
- Strict bounded JSON **metadata schema** only: opaque `EV-...` reference plus lowercase 64-character SHA-256 for each of: owner authority, finance authority, independent security review, operator MFA, rollback acceptance.
- Rejects unexpected fields such as URLs, arbitrary file content, JWT, credentials and path traversal; no documents in PR, chat, source or GitHub Actions logs.
- Five distinct Ed25519 signing keys and five **phase-specific, domain-separated** signatures over identical canonical immutable packet; keys in source tests are ephemeral and **not** real independently authenticated identities.
- Each packet binds exact Git SHA, signed owner permit digest, finance packet digest, full fresh Cloudflare inventory digest, phase-specific future target manifest digest, account, separate proposed positive USD allocations, signed nonce, maximum 15-minute window and no-public/no-send/no-change flags.
- Complete current inventory with <=60-second age, matching script/Worker total, distinct resource IDs/names and presence of both V17.5 DO namespaces. A new signing event **MUST obtain a fresh control-plane snapshot**; previous 28/1 inventory and this read-only snapshot expire.
- **Strict stage separation**: `LEDGER_FIRST_INACTIVE_UPLOAD` only before private hosted ledger exists; `QA_WORKER_FIRST_INACTIVE_UPLOAD` only when ledger is already inventoried as a distinct Worker and SQLite DO namespace, plus a separately signed, bounded ledger postflight receipt with no public exposures, no collateral changes.
- All outcomes return `can_upload:false`, `can_create_ledger:false`, `can_upload_qa_worker:false` even if synthetic signatures verify. Status `SIGNED_METADATA_MATH_CONSISTENT_NOT_REAL_AUTHORIZATION` is mathematical consistency only, **NEVER GO** for actual deployment.

`hosted4b5-private-evidence-dossier.test.mjs` covers negative forged/missing/reused key signatures, stale inventory, injected URL/raw Merchant bytes/JWT, expired packet, finance amount changed, premature QA phase, missing hosted namespace, altered receipt signature, existing V17.5 preservation, attack by adding fields or duplicate names. Test fixtures are explicitly synthetic.

`hosted4b5-private-evidence-intake.pending.example.json` contains **null real approval/signatures, no identities, no budget, and all mutation flags false**. It is not a real identity record or deployment approval.

### C. PROPOSED real private intake service design — **not installed**
1. **Private-only authenticated operator entry**, no public Development URL. Use individually approved identity provider, verified MFA, RBAC, short-lived sessions, separate auditor, and immutable reviewed trust roots. An unsigned user-provided JSON boolean does not assert ownership.
2. **Document isolation**: real Merchant proof stays in a restricted, private encrypted storage area, with exact MIME validation, size limits, malware scanning/Content Disarm & Reconstruction when suitable, no URL fetch, no executable rendering, random storage keys, no public object URLs, no arbitrary redirects or HTML/link injection. Do not create R2 tokens or upload customer files until expressly approved. Reviewer uses isolated sanitized preview, never direct attachment execution.
3. **Opaque evidence receipts only** go to the gate after the independent private service checks business account authority, Finance/Owner separation, Cloudflare scoped RBAC, MFA, verified operator, rollback consent and billing budget. Real trust keys never published or submitted in a public chat.
4. **Hosted ledger** must first have separate owner/security/finance approval and independently attested no-public postflight Worker/DO identities. The 4B.4 two-resource synthetic approval cannot authorize automatic sequential creation after inventory changes: finance and owner signatures must be **reissued against a fresh inventory for each resource**.
5. **QA Worker first inactive upload** is a *different* change window, with its own signed owner/finance/operator evidence; a local Workerd receipt, GitHub CI success or a fabricated hosted ledger receipt is not accepted. No Access policy changes or public URL enabled.
6. **Cost**: two positive owner-approved USD allocations and explicit account-level risk acknowledgement; Cloudflare Workers/DO spend limits are shared-account, exclude some stored-data charges, not a guaranteed per-resource hard invoice cap. No account-wide limit change in this phase.

### D. QA/rollback/provenance
- Add source-only dossier checks and negative tests to the existing GitHub workflow. Keep 16 actual LOCAL Workerd SQLite tests and 21 local Chromium simulated-Access tests. Hosted Access browser and real Commerce jobs intentionally SKIPPED.
- Before considering true hosted, require authenticated, independently trusted owner / Finance / Security / Operator / Rollback authorities, registered keys, dedicated private intake/ledger infrastructure and budget approval. Until then **HOSTED NO-GO**.
- Source rollback: close/revert only this child Draft; do not touch V17.5 or RPC16 resources and do not merge parent PRs.
- Never infer completion percentage or real approval from synthetic tests.

### References
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/durable-objects/platform/spend-management/
- https://developers.cloudflare.com/workers/platform/spend-management/
- https://developers.cloudflare.com/durable-objects/examples/testing-with-durable-objects/

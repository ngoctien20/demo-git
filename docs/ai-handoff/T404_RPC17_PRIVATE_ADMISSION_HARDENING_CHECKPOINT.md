# TIEN404 AI — RPC17 Private Admission Hardening

Date: 2026-11-17 JST
Status: SOURCE IMPLEMENTED / LOCAL 26 PASS / HOSTED NO-GO / DRAFT REVIEW REQUIRED

## Parent
- RPC16 Draft PR #313; exact base commit 59b455badc5890f87d1b379415ad39e54e29f22e.
- Preserves RPC16 Cloudflare Access DENY ALL, inactive 404-only Worker, disabled workers.dev/previews, private empty R2 bucket.
- No Cloudflare, Supabase, n8n, Messenger, Zalo, customer or merchant data writes.

## Added offline-only modules
- qa/v152-rpc17/private-admission.mjs: Ed25519 pinned-key signature verification with strict tenant/store/operator/audience/issuer/scope/TTL claims.
- checkFileEnvelope: header/metadata check for PDF/PNG/JPEG only; cannot authorize upload or substitute scanner/CDR.
- createMockAdmissionLimiter: in-memory synthetic replay/rate demo only; not durable and not production-safe.
- hostedDecision: unconditional deny of hosted upload.
- qa/v152-rpc17/private-admission.test.mjs: 26 synthetic tests.
- .github/workflows/v152-rpc17-offline-admission.yml: source-only tests with inherited RPC13-RPC16 and no deployment commands.

## Security deficiencies / NO GO
- No independent real human Merchant owner evidence P1/P2/O1/O2, no accepted real same-Tenant Store A/B Supabase Auth JWT UAT.
- No hosted durable replay nonce service, atomic consumption, rate limit, production trust-anchor management, MFA broker, scanner/CDR, safe reviewer isolation, retention and deletion controls.
- No protected private upload route or Access Allow policy. Do not add them as part of this draft.
- Local synthetic Ed25519 keypairs are testing fixtures; they prove no actual owner identity or production issuer authenticity.
- No actual malware inspection or PDF/image full decoding.
- No public endpoint, no Merchant documents, no R2 read/write.

## QA and checkpoint
- Original ZIP local run: node --test qa/v152-rpc17/private-admission.test.mjs => 26/26 PASS, Node 22.
- GitHub Actions run and full inherited regression results must be verified separately after PR creation.
- Source rollback: close or revert RPC17 draft branch only. Hosted rollback: none needed (no hosted writes).
- Next: independently review and test atomic hosted replay ledger, private scanner and Access tenant authority before separate deployment approval.

CHECKPOINT: RPC17_SOURCE_ONLY_LOCAL_26_26_PASS · RPC16_BASE_59b455b · HOSTED_NO_GO · ZERO_CLOUD_WRITES

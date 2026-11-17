# TIEN404 AI — V17.23N Deployed Routes × BIO RPC × Native Provider Ingress

**DRAFT / SOURCE-ONLY / PRIVATE SIGNED EVENT UAT NOT ACCEPTED / REAL JWT NO-GO / PRODUCTION NO-GO**

Parent V17.23M [PR #365](https://github.com/ngoctien20/demo-git/pull/365), audited SHA `3b97714469f87bd53a7b88624882c6ba8e5ef55e`. No hosted resource changes.

## Verified read-only Cloudflare evidence (17 November 2026 JST)
- Current connected account: **31 Worker scripts**; **31/31** deployment histories returned, **31/31** `workers.dev` subdomain settings returned; **21 enabled, 10 disabled**.
- Account Worker Domains: **one** production hostname `ngoctien20.io.vn` mapped to service `ngoctien20-bio`, `environment=production`. Cloudflare zone `ngoctien20.io.vn` status active, **zero Worker Routes** on this one zone. Custom domain mapping and workers.dev setting are separate.
- Production BIO deployment ID `22addbba-2cba-452a-9bac-63c5225d47be`, first version ID `dcfea800-b954-419b-8bd9-8e2d9862a29b`, traffic weight 100% on read. Deployment assignment observed, but **actual incoming browser request / raw deployment source fingerprint were not independently exercised**.
- Thirteen BIO Worker script sources have generic Supabase `/rest/v1/rpc/` references. Examined static RPC target names: `is_personal_admin`, `bio_publish_setting`, `bio_published_settings`, `bio_public_media_manifest`; none are `qa_shop_b_zalo_claim`, `qa_owner_pairing`, or `save_merchant_product`. BIO RPC names are personal-site functions, not evidence of Commerce Store admission. Dynamic/runtime targets, external callers and version-vs-script-content divergence remain unresolved.
- Read only of 31 Worker contents and one Supabase Edge source inherited from [PR #365](https://github.com/ngoctien20/demo-git/pull/365). Do not infer nonexistence of indirect traffic from missing literal code strings.
- All 22 active n8n Published node graphs inspected in PR #361. Known Zalo V1 → Zalo V2 → `qa_shop_b_zalo_claim` caller remains live; don't revoke permissions.
 
## Native signed Meta/Zalo acceptance preparation
- `qa/v1723n/deployed-route-ingress.mjs` implements **synthetic-only Meta** HMAC-SHA256 over the original raw bytes and strict canonical `x-hub-signature-256` format using Node crypto and timing-safe comparison, with tamper rejection. It does **not** call Meta or possess actual app secret.
- **Zalo Bot/OA:** DO NOT assume Meta's `x-hub-signature-256` applies. Obtain the precise provider's documented native signature/authorization method from an authorized Merchant QA Bot/OA installation, privately verify an actual event, bind that installation to canonical Tenant/Store server-side, test replay and invalid signature, and record an independently signed no-send admission.
- Required for either provider: raw bytes preserved before JSON normalization, signature from provider-owned QA installation, timestamp/replay controls, independent operator and QA owner consent, negative tests and strictly no message sending/Order writes. Merely seeing HMAC code, Vault header or a Worker deployed is not proof of provider-native admission.
- No real signed event was submitted for this step. `assessNativeIngress()` is **permanently NO-GO** on caller-supplied assertions; private acceptance must run outside public CI.

## Safety, Recovery and JWT
- Merchant real four-row proof in private [RPC12 PR #244](https://github.com/ngoctien20/demo-git/pull/244) is not independently accepted; M0 real local restore deferred by Owner, new scope undecided.
- No canonical Store A/B same-Tenant mapping, Store-scoped policies or real Supabase issuer-verified JWT A/B UAT. Remain NO-GO.
- No requests to production endpoints, provider sends, Cloudflare deployment/route modifications, RPC revoke, secrets, Auth, database write, Supabase migration, customer PII, paid resource, merge or publish.
- Rollback: close Draft child PR. No hosted rollback required.

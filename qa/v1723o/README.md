# TIEN404 AI — V17.23O: Deployed Fingerprint × External Caller Inventory × Provider-Native Private Canary

**DRAFT SOURCE-ONLY / CI SYNTHETIC ONLY / REAL PROVIDER UAT NO-GO / REAL STORE A/B JWT NO-GO**

Direct child of V17.23N [PR #370](https://github.com/ngoctien20/demo-git/pull/370), starting SHA `1b8dd6afebb34df4839cb4e72b7776ae0f7f16ea`. No changes to existing LIVE Worker, Messenger/Zalo, Supabase, Auth, billing or credentials.

## Evidence from connected Cloudflare account (2026-11-17 JST)

- **31** Worker scripts. Cloudflare latest deployment and version-resource `script.etag` were read against the script-list ETag for each.
- **30 of 30 Worker scripts with a weighted deployed version** have exactly one version with **100%** weight and matching Cloudflare ETag. One inactive staging Worker `tien404-v177h-provider-nosend-inactive-staging` has **no version** in the deployment record and must not be misreported as a successful fingerprint match. Content-independent ETags are metadata claims from Cloudflare, NOT raw byte hashes.
- Production BIO `ngoctien20.io.vn` → `ngoctien20-bio`: deployment `22addbba-2cba-452a-9bac-63c5225d47be`, version `dcfea800-b954-419b-8bd9-8e2d9862a29b` (100%), Cloudflare script ETag `af2b7091ee5ea9a944eee853e29406796bdeb1ae8fe3681b4eb258087adcce61`. Current script content-v2 extracted module SHA256, independently re-read twice with same value: `b43e8793564d7adf6864dd2cf321ca67c618912fd94195cddfbba40f96f7579d`. These fingerprints are **not equal** and not required to be; Cloudflare ETag is not asserted to equal the raw module SHA. A true version-scoped raw-byte comparison and actual request traffic admission remain **NOT VERIFIED**. The script list field `deployment_id` was empty and is *not* used to declare a mismatch.
- One production Worker Domain; one active zone with **zero** Worker Routes; workers.dev enablement accounted for in V17.23N.
- **13 BIO Worker sources** contain `/rest/v1/rpc/` references. Statically named RPCs: `is_personal_admin`, `bio_publish_setting`, `bio_published_settings`, `bio_public_media_manifest`, which serve the personal website. No direct literal occurrence of targeted Commerce privileged RPC `qa_shop_b_zalo_claim`, `qa_owner_pairing`, `save_merchant_product` in these sources. Dynamic/indirect code remains external audit scope.

## External caller reconciliation, bounded

- **n8n 151/151 stored workflow definitions inspected** using connected n8n read-only tool: 22 active Published and **129 inactive**. The sole literal direct targeted RPC match is active `TIEN404_ZALO_V2_SHADOW_STAGING` (ID `OgDZNSAvKEvhnAvn`) calling `qa_shop_b_zalo_claim`; parent active Zalo V1 invokes V2. No inactive current-definition literal matches were found. **This does not cover dynamic string-composed URLs, older executions, other n8n instances or external callers**.
- **Cloudflare 31/31 Worker script contents scanned**, including BIO targeted static names; source-only, no production traffic or other accounts attested.
- **Cloudflare Pages 2 projects**: `tien404-ai-git-staging` GitHub-connected with latest deploy, and `tien404-ai-staging` without latest deployment. Both currently report `uses_functions=false`; this only excludes configured Pages Functions for these projects, not scripts or browser-side API callers.
- **Supabase one active Edge Function** `tien404-r1-owner-preflight`: `verify_jwt=true`, code uses `auth.getUser` and Tenant membership. No targeted Commerce RPC literal; Tenant-only proof is not canonical Store A/B authorization.
- **Global external caller closure remains NO-GO** until account coverage, published external application integrations, dynamic URL evaluation, real traffic/request-log evidence, provider-owned installations and independent operator acceptance. No RPC privilege revoke or migration permitted.

## Distinct provider verification methods (all synthetic until private approval)

- **Meta Messenger**: `X-Hub-Signature-256` = `sha256=HMAC_SHA256(original raw body bytes, Meta App Secret)`, per Meta webhook documentation. The reused V17.23N verifier is pure synthetic and compares timing-safe. Never place real App Secret or signed event in GitHub.
- **Zalo OA**: Official Zalo OA docs describe `X-ZEvent-Signature` calculated as `SHA256(appId + data + timeStamp + OAsecretKey)` (not the Meta HMAC algorithm). V17.23O verifies **synthetic exact `data` bytes** against a normalized 64-hex digest. The actual header encoding and raw `data` canonicalization must be matched against the applicable provider event version **privately** before accepting real traffic. Source: https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan
- **Zalo Bot API**: `X-Bot-Api-Secret-Token` is the configured shared-secret webhook header, according to Zalo Bot ecosystem documentation. This is **not** a signed payload nor interchangeable with OA's digest; require provider-owned `setWebhook/getWebhookInfo` configuration and exact current provider documentation confirmation in private admission. A synthetic timing-safe comparison is tested only. Reference: https://kaiyodev.github.io/zalo-bot-js/en/webhook-events
- For all three, **real independent signed provider evidence = BLOCKED**. A correct synthetic signature, Cloudflare Worker script, Vault shared header or self-reported receipt is not provider-native authenticity or canonical Store ownership.

## Private signed no-send canary — admission plan only

1. Operator verifies a **dedicated** QA Meta app/Page or Zalo QA Bot/OA owned by the Merchant, independently confirms scoped consent and does not alter existing live webhook subscriptions.
2. Capture one event in a **private authenticated ingress**, preserving exact bytes, provider timestamp, correct documented signature/header, verified installation→canonical Store binding; no customer PII persisted into GitHub or chat.
3. Test valid, modified bytes/header, wrong installation, expired/out-of-window, duplicate/replay (durable atomic storage required), and unauthorized customer/Store identity; fail closed.
4. Restrict private runner to **NO_SEND_NO_WRITE**. No provider responses other than normal webhook receipt ACK, no order writes, no public Worker routes, no service-role, and no order lookup with real customers.
5. Independent security reviewer signs a private redacted receipt. Public GitHub evaluation `inspectPrivateCanary` *always returns NO-GO*, even when every claim is `true`. Do not confuse metadata evaluation with authenticated Operator acceptance.
6. Separate M0 recovery approval, trusted Merchant Store A/B provenance, Store-scoped RLS and issuer-validated real JWT sessions remain prerequisites before any real cross-channel Order UAT.

## Controls and rollback

- No Cloudflare deployment or route write; no live n8n edit, Meta/Zalo send, Supabase SQL mutation, grant/revoke, Auth change, backup, customer access, credentials, paid resources, merges or published features.
- CI contains only dummy synthetic secrets. Close this Draft child PR to roll back source-only changes.
- Status: `VERSION_METADATA_RECONCILED` / `N8N_CURRENT_SOURCE_INVENTORY_RECONCILED` / `GLOBAL_CALLER_NO_GO` / `PROVIDER_PRIVATE_CANARY_NO_GO` / `REAL_JWT_NO_GO` / `PRODUCTION_NO_GO`.

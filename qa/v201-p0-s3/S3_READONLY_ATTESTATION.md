# TIEN404 V20.1-P0-S3 — Render × Backup/Restore × Zalo Merchant Bot Link

**Evidence date:** 2026-11-21 JST.
**Parent:** Draft PR #474, exact HEAD e46a5bad28da44859acf2c5546021357f37528f4.
**State:** READ-ONLY VERIFIED / SOURCE-ONLY IMPLEMENTED / HOSTED-PRODUCTION NO-GO.

## Render Caller Attestation

The connected Render account lists one workspace: **My Workspace**, ID tea-dbphgh0n74is73dvsnng. The selected-workspace query returned **no workspace selected** and explicitly instructed that the owner must confirm the workspace before retrieving service information. This session did not select one by inference. As a result **no service list, deployed revision, code, service logs or Render RPC callsites were inspected in S3**.

**R-01 BLOCKED:** Owner confirms My Workspace for a read-only Render audit. Then list services by confirmed ID, pin service ID/deployed SHA/source revision, inspect static and dynamic callers of qa_shop_b_zalo_claim, qa_owner_pairing and save_merchant_product; include Render-to-Supabase callers, frontend endpoints, request roles and redacted traces. No token/secret values. A successful anonymous /health check is insufficient. Previous PR #447 documented transient Render Free cold-start 503 and warm 11/11 anonymous GET acceptance, not privileged caller closure.

Historical context: S2 scanned 23 active n8n Published workflows; exact literal caller found in Zalo V2 Shadow OgDZNSAvKEvhnAvn HTTP node Submit pending claim for Shop B -> qa_shop_b_zalo_claim. Historical PR #447 scanned 171 workflows; Cloudflare S2 scanned 40 deployed Worker scripts without exact target-RPC names. Browser Pages, dynamic URLs, and third-party callers remain an unknown.

## Supabase Hosted Backup/Restore Gate B-00

**VERIFIED:** Supabase organization pjdoiuhtwrhzkzlhelvr returned plan **free**, tier tier_free on 2026-11-21. Hosted staging ifxlvrhyjhbzbrkdsida returned ACTIVE_HEALTHY, PostgreSQL 17.11. Official Supabase knowledge base says Free plan has **no automatic database backups**. The Free tier's manual CLI dump does not itself prove an independent usable recovery snapshot. Storage API object bytes are not included in database backups.

**BLOCKED:** No real hosted export receipt, immutable private archive, checksum provenance, independently isolated restore, Auth/roles/Vault/Storage recovery, RLS fingerprint comparison or Owner A/B negative test evidence was verified.

**Reuse rather than rebuild:**
- Existing PR #447 and owner Windows private export runbook: https://github.com/ngoctien20/demo-git/blob/f112da2f78f264dd683a37ade4de6a43c5b5b886/docs/ai-handoff/T404_V18615_WINDOWS_OWNER_PRIVATE_BACKUP_RUNBOOK.md
- Prior V18.6.14 Docker PG17 synthetic restore is **not** real hosted recovery acceptance.
- Official guidance: https://supabase.com/kb/faqs/platform/free-plan-backups , https://supabase.com/docs/guides/platform/backups , https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

**Owner-approved procedure, not executed:** choose encrypted non-sync private location outside GitHub; scope and credential/egress review; inspect current Supabase CLI commands and matching PG17 client; private dump of permitted hosted schemas plus separately protected Auth/roles/Storage/Vault recovery plan; record timestamp/size/SHA256 privately; independently restore in a disconnected permission-controlled environment, with proper data-handling authorization; compare schema/RLS, row isolation, price/stock, Order/Inventory and revocation negative tests; approve rollback before granting/revoking RPC access or hosted migration. Never post SQL dumps, tokens or customer data in PR/chat.

## Zalo Merchant Bot-specific Chat Link UAT Z-01

**Verified official distinctions:**
- Zalo Bot API Bot Creator and webhook: https://docs.zaloplatforms.com/docs/BOT/create_bot
- Bot API overview: https://docs.zaloplatforms.com/zalo-bot
- Bot Creator Mini App QR: https://zalo.me/s/botcreator (opens Creator; NOT a merchant customer-chat QR)
- Zalo OA Chatbot scenario share link: https://oa.zalo.me/home/resources/library/tu-dong-hoa-cham-soc-khach-hang-voi-zalo-chatbot_6352033339970702125 (opens OA conversation and triggers OA scenario; NOT Bot API link)

**Not verified:** an official Bot-specific customer 1:1 chat deep-link/QR format, store-specific Bot link, provider-authorized merchant binding, or two-device QA result. Do not guess link structure from bot ID or turn a group invite link into a customer chat QR.

**Owner redacted evidence request:** on Zalo mobile, open official Bot Creator, choose the intended *test merchant Bot* and inspect its Info/Share/Invite menu. Supply screenshot of menu and destination preview with all tokens, account IDs, phones, messages and customer identities hidden. Do not paste Bot Token. If official Bot-specific customer-chat URL exists, verify privately on two distinct Zalo client devices/accounts, with correct Bot identity and separate trusted owner/Store installation registry. Any event test requires explicit authorization; default NO-SEND/NO-WRITE. Capture provider-authenticated inbound test receipt and wrong-Store/revoked/replay negatives. A QR parameter or sender ID must not authorize Store identity.

**Decision:** BOT_CUSTOMER_DEEPLINK_UNVERIFIED, QR_ISSUANCE_NO_GO, PROVIDER_SEND_NO_GO.

## Offline implementation

- s3-review.mjs is a pure, deterministic evidence reviewer. It never contacts Render, Supabase or Zalo and always returns release actions FALSE.
- s3-review.test.mjs asserts missing workspace, dynamic caller, real dump/restore, Auth/Storage, Zalo product distinction, two-device UAT and no-send behavior.
- A synthetic all-green manifest results only in HUMAN_REVIEW_REQUIRED, **not authorization**.
- CI under Node 22 requires no hosted/Render/Cloudflare/Zalo credentials. Verify GitHub run and exact HEAD independently.
- No Supabase DDL/DML/REVOKE, real backup, credential change, n8n workflow publish, payment/order write, provider send or manual Cloudflare/Render deploy. Git-integrated Pages may create automatic preview records; inspect separately, do not call it production deployment.

## QA/Rollback/Next

**B-00 BLOCKED / R-01 BLOCKED / Z-01 BLOCKED / REAL OWNER-STORE JWT NOT TESTED / RPC REVOKE NO-GO.**

Rollback: close/revert the Draft PR. No deliberate hosted runtime change to undo.

Next gate: owner confirmation of Render My Workspace for strictly read-only caller inventory; separately owner-approved real data backup + isolated restore; Bot Creator redacted customer chat sharing evidence; only then review true Owner A/B and any protected RPC migration.

**Checkpoint:** V20.1-P0-S3 | RENDER_WORKSPACE_DISCOVERED_NOT_SELECTED | SUPABASE_FREE_VERIFIED | HOSTED_BACKUP_NOT_PROVEN | ZALO_BOT_LINK_UNVERIFIED | OFFLINE_EVIDENCE_REVIEW_ONLY | NO_SEND | NO_WRITE | HOSTED_NO_GO

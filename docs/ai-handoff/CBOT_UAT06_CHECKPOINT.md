# TIEN404 CBOT-UAT-06 — PRIVATE M0 RECOVERY OPERATOR ACCEPTANCE × REAL MERCHANT STORE OWNERSHIP × NATIVE PAGE/OA PROOF
Checkpoint: 2026-11-16 JST | CANDIDATE SOURCE-ONLY / OFFLINE OPERATOR PREFLIGHT / HOSTED NO-GO
Parent CBOT-UAT05 Draft PR #215 exact HEAD: 1c563db7f874f5c3f48e73ccc2e30de75a6d52a4.
Independent security branches, do NOT merge or duplicate: RPC.7 backup #198 HEAD 4f7bef71f54ee17b88449026b90803ccf9743e30; H11R.11 independent signed metadata #205 HEAD 8df7b9b30f26906091340dc95531d4e422c8196b; H11R.10 disposable Store migration #200; V16.10 fake-JWT PG17 #212 HEAD f24117b9c9e5ee3700d9172564be7b19993428ed; Meta Canary #214 current HEAD ce3662d8dee79fe9fd93f49652422d264373e3d2.
No new owner identity signer or duplicate migration.

## 1. VERIFIED: DIRECT LIVE READ-ONLY OBSERVATIONS
- Supabase staging ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY PostgreSQL17. Aggregates: 2 Tenants, 2 Products, 2 Orders, 3 Tenant memberships, 3 Auth users, 5 Auth sessions, zero Storage buckets and objects. Raw identifiers/records/PII NOT retrieved. Tenant ordinal 1 = 2 Tenant Owner memberships, 1 Product, 1 Order; Tenant ordinal 2 = 1 Owner, 1 Product, 1 Order. These are NOT proven Store A/B assignments.
- Hosted public.stores/store_memberships ABSENT. Products/Orders.store_id ABSENT. Existing public Products/Orders RLS enabled+FORCED with 1 policy each (tenant-based, not per Store). No real Owner A/B same-Tenant JWT-RLS test is possible.
- SECURITY DEFINER public.qa_shop_b_zalo_claim still grants anon EXECUTE; two other authenticated SECURITY DEFINER functions observed. Existing Zalo V2 Shadow OgDZNSAvKEvhnAvn Active version f00ba506-c52a-4340-9a0c-809fd9c6ea9a contains HTTP POST to legacy claim endpoint. NO REVOKE.
- Existing Messenger Published Z7FdV7uDvApfbURQ Active 27 nodes/version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92 unchanged. Messenger real #4176 earlier verified signed webhook+Meta receipt and user-confirmed delivery, but the active AI Agent still has legacy DEMO order writers. Do not repoint it to Commerce.
- NEW NATIVE META UI discovery: connected browser current tab Meta for Developers > TIEN404 AI Messenger > Test Users is readable; app selection/name visible, App publish UI says "Chưa đăng", and test user count shows 0/0. This is direct signed-in App-console visibility, NOT proof the person holds required Admin role or owns the related Page. Current tab does NOT provide Page-level messaging permissions, App/Page subscriptions, exact merchant Store Page mapping, or QA recipient. App ID is intentionally NOT copied.
- PR #214 separately reports a user-provided Meta Business Suite screenshot showing Page Tien404 AI asset visibility. Owner assertion supports narrow canary *preparation*, but Page Full Control and App subscribed permissions remain NOT INDEPENDENTLY VERIFIED.
- No connected native Zalo OA console available. Staging Zalo Bot V1/V2 ≠ native OA OAuth/App ownership.
- Container file inspection found only four AI_SALES CSV QA fixtures; existing Windows archive TIEN404_V142_PRE_RLS.backup and independent real full recovery receipt are not present in this runtime. No local Docker/pg_restore operator workstation was accessed; no new backup generated.

## 2. REAL PRIVATE M0 RECOVERY: NOT ACCEPTED / BLOCKED
- Reused actual RPC.7 PR #198 existing archive local read-only PowerShell inspector (Get-FileHash and pg_restore --list). The script prints m0Approved=false and m1Authorized=false, intentionally; a TOC/checksum matching archive is not a fresh offsite Auth/Storage/ACL restore.
- Exact original RPC.7 output receipt format verified: T404_RPC7_LOCAL_EXISTING_ARCHIVE_RECEIPT_V1 (not INPUT_V1) and statuses LOCAL_ARCHIVE_TOC_REVIEW_ONLY / LOCAL_ARCHIVE_SCOPE_INCOMPLETE / LOCAL_ARCHIVE_BASELINE_MISMATCH; TOC statuses include STRUCTURAL_TOC_COVERAGE_CANDIDATE_UNVERIFIED and PARTIAL_APP_ARCHIVE_NOT_FULL_SERVICE_RECOVERY.
- No Controller, independent SECURITY_REVIEWER or actual Backup Operator authorization/real private offhost restore was presented. Role SHA fingerprints/metadata do not authenticate legal identity.
- Actual 3 Auth users and 5 sessions demand an independent recovery plan for users/login continuity and ACL; zero Storage object metadata does not remove need to verify object bytes/external assets. Existing H11R archive is a partial application recovery; do not call this FULL M0.

## 3. M1 REAL MERCHANT STORE OWNERSHIP: BLOCKED
- Each of the two Products and two Orders needs an independently verified Merchant Owner + Tenant + Store mapping in a private encrypted evidence vault; relevant OrderItems/customer links and SKU uniqueness also require compatibility review. Two Tenant Owners in slot 1 do not mean two Stores in that Tenant.
- Existing H11R.11 #205 signed metadata intake is synthetic until real externally enrolled witness keys and independently validated raw sources. V16.10 PG17 fake JWT and restore QA cannot establish hosted Auth JWT authority.
- No hosted M1 Store migration, no Store-scoped Order read, no real signed Owner A/B negative JWT/RLS proof.

## 4. NATIVE META + ZALO OA: PARTIAL NATIVE APP VISIBILITY / NO OWNER PROOF
- Meta for Developers App console actually observed read-only, app name and "Chưa đăng" UI captured as non-sensitive metadata. Still missing native Page full control/task permissions; App↔Page assignment; App/Webhooks Page messages fields; pages_messaging and App Review; QA recipient; independent merchant and security review. User's prior Page screenshot is not a legal Merchant Store mapping.
- Zalo OA App/OAuth admin, webhook signature and OA→Merchant→Store, and customer Messenger PSID↔Zalo UID trusted link remain NOT VERIFIED. Do not treat Zalo Bot as OA.
- No real provider sends or App subscription changes.

## 5. IMPLEMENTED, THIS BRANCH ONLY
- qa/cbot-uat06/private-m0-owner-native-gates.mjs: strict privacy-safe candidate private operator metadata packet screening; five unique role digests, six M0 coverage domains, four legacy row owner evidence claims, six Meta and six Zalo native proof domains, SHA/size baseline comparisons and real RPC.7 receipt V1 compatibility. All-green synthetic/self-reported metadata NEVER authorizes hosted operations.
- qa/cbot-uat06/private-operator-cli.mjs: offline Node stdin-only, 64KiB maximum, aggregate counts and hard NO-GO output without echoing refs/hashes or reading private vault/credentials; intended for trusted private Windows workstation only.
- qa/cbot-uat06/private-m0-owner-native-gates.test.mjs: 46 new synthetic source acceptance/negative tests including real Meta connected console observation, malformed witness, wrong project, stale parent SHA, replay/TTL, partial archives, four-row conflicts, unsupported Page/OA authority, and hard-disabling all hosted writes.
- qa/cbot-uat06/actual-hosted-operator-checkpoint.json: timestamped real directly observed metadata only, no raw Page/App IDs, Auth identifiers, tokens or user messages.
- docs/ai-handoff/CBOT_UAT06_PRIVATE_M0_REAL_STORE_NATIVE_AUTHORITY_OPERATOR_RUNBOOK.md: exact Windows RPC.7 existing archive commands, native Meta Page and Zalo OA proof, Owner mapping and private reviewer signoff steps; zero live execution.
- .github/workflows/cbot-uat06-private-operator-no-hosted-write.yml: new 46 plus inherited 269 tests, CLI privacy smoke + non-network scan. CI exact HEAD must pass before any TESTED claim.

## 6. QA/ROLLBACK/NO-GO
- M0 real recovery: BLOCKED.
- M1 real Merchant Store Owner mapping: BLOCKED.
- Real same-Tenant two Store Owner Auth JWT/RLS: NOT RUN.
- Native Meta App Console: VERIFIED VISIBILITY; native Page Owner authorization: NOT VERIFIED.
- Native Zalo OA Owner/OAuth: NOT VERIFIED.
- Existing anon callable privileged RPC + external caller inventory: P0 OPEN.
- Hosted Store Read-Only Order pilot: NOT RUN.
- Production, Hosted RLS/Store migration, RPC REVOKE, live Meta/Zalo sends: NO-GO.
- Changes are GitHub Draft source files only; closing Draft PR rolls back candidate. Existing inactive n8n QA workflows and Published versions were not touched. No hosted data/credential/role mutation, no Auth export, no paid models, no new provider send.

## 7. NEXT REAL HUMAN ACCEPTANCE
1. Authorized Backup Operator on private Windows workstation uses existing RPC.7 PR #198 script to inspect existing archive. Controller and independent Reviewer receive private encrypted evidence, NOT public ChatGPT/PR.
2. After operation-specific approval, independent full offhost Auth/Storage/ACL restore performed and certified; preserve real witness and fresh state, do not pretend current metadata means approval.
3. Merchant Owner and Reviewer privately identify Store ownership for all 2 Products + 2 Orders, then real hosted Store/Auth JWT isolation after separate migration approval.
4. In existing Meta Developers tab, inspect native App roles and App/Page webhook Page subscription READ ONLY, plus Business Settings Page access Full Control/messaging task. Preserve private reviewer receipt, no token in chat.
5. Authorized Zalo OA owner independently verifies OA + Developer App OAuth scopes / webhook identity and merchant consent. No OA evidence has been supplied yet.

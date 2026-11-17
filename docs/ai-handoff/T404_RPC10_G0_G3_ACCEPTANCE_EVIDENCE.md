# TIEN404 — RPC.10 G0→G3 Independent Acceptance & Hosted Cutover Control
**17 November 2026 JST | Source-only checkpoint | NO HOSTED MUTATION**

## VERIFIED: Evidence from the real staging project
- Project: Supabase \`ifxlvrhyjhbzbrkdsida\` (PG17.11, ACTIVE_HEALTHY).
- 2 Tenants, **2 Products, 2 Orders, 0 Customers**, active Tenant Owner memberships **2 in Tenant slot 1 and 1 in Tenant slot 2**. Their linked Auth users were checked in the previous read-only audit.
- Two Orders have nonempty \`order_source\` labels; neither has a Customer FK. One Tenant has one configured agent channel and the other zero. This is **source-tracing metadata, not a canonical Store owner**.
- \`public.stores\` and \`public.store_memberships\` absent; all six Commerce tables have \`tenant_id\` and **no \`store_id\`**.
- Policy inventory from actual \`pg_policies\`: exactly one \`SELECT PERMISSIVE\` per Commerce table and **zero Store predicates** for Products, Orders, Customers, Order Items, Conversations and Messages. Any new permissive Store policy combined with unchanged Tenant-wide policy is insufficient.
- Read-only privileged RPC inventory:
  - \`public.qa_shop_b_zalo_claim\`: \`SECURITY DEFINER\`, **anon EXECUTE**.
  - \`public.qa_owner_pairing\`: \`SECURITY DEFINER\`, **authenticated EXECUTE**.
  - \`public.save_merchant_product\`: \`SECURITY DEFINER\`, **authenticated EXECUTE**.
  - This is a **privilege review finding**, not proof of exploit. Inspect all callers, roles, search_path, tenant/store checks and output before considering any REVOKE.
- The current n8n Commerce Tenant Resolver \`5Eeh8hbpsoNhuiVo\` is active, version \`a99c7350-7aea-446d-bdc5-4b10f52c3ad1\`, using **n8n Data Tables**; Catalog \`oOOXicKXGkBskKqh\`, Cart \`igPOsSbEgd4NgtRA\`, and V3 Business Sandbox \`Y0WLykMtNAldbgL0\` are active and use **n8n Data Tables**, not this Supabase Commerce \`public\` Store schema.
- Published Messenger \`Z7FdV7uDvApfbURQ\` is active and uses Google Sheets tools and order tool workflows; **not migrated to new Commerce multi-Store policy**.
- Zalo ingress \`yIJk8LvJoLF40Z62\` and private router \`sIPs6egzIwOY1GNv\` are active but run read-only/shadow branches and n8n QA Data Tables; no verified native Owner→canonical Store proof.
- Candidate n8n workflows \`DCj7mQbovyYNf7Li\` (V171A), \`Bs4QX1fP2S226N8j\` (V171B), and \`AKgE96Xvbqxw4rGb\` (V171C) are inactive QA simulations, **not provider-hosted authorization evidence**.
- Published version, drafts, credential IDs and any signed webhook canaries must be cataloged independently before altering a live caller. Do not conflate n8n Data Tables, Google Sheets, and Supabase PostgreSQL data models.

## G0 — Private four-row Original Owner/Store evidence: BLOCKED
Exactly four records require a **private**, source-specific ledger. Do **not** upload original UUIDs, auth/JWT/session, customer PII or merchant signatures to GitHub/ChatGPT/CI.

| Alias (anonymized) | Entity | Tenant slot | Actual primary Store evidence | Merchant signature | Independent reviewer | Decision |
|---|---|---|---|---|---|---|
| T1:PRODUCT:1 | Product | 1 | MISSING | MISSING | MISSING | HOLD |
| T1:ORDER:1 | Order | 1 | MISSING | MISSING | MISSING | HOLD |
| T2:PRODUCT:1 | Product | 2 | MISSING | MISSING | MISSING | HOLD |
| T2:ORDER:1 | Order | 2 | MISSING | MISSING | MISSING | HOLD |

For each record privately: hosted row ID + tenant ID → original merchant onboarding, channel Page/OA binding, legal owner authorization, effective Store membership, unique canonical Store id, source digest & timestamp; merchant owner and **independent** security reviewer validate the *same* original record. Any multiple-owner dispute, missing binding, or stale claim = HOLD.

Use existing private-only shape linter in RPC.7 and H11R.11 signature metadata code in PR #205. Neither code nor mere \`true\` fields can authenticate the original human/record. Tenant membership, order_source, product name/SKU, one configured bot or model inference are **not** owner attestation.

## G1 — Actual disposable PostgreSQL 17 QA: TESTED/VERIFIED
Branch RPC.10 child of PR #233, Draft PR #247. CI:
https://github.com/ngoctien20/demo-git/actions/runs/43996434462
- **SUCCESS**: GitHub Actions PostgreSQL 17 disposable container at \`t404_rpc8_ci\` with \`tien404.rpc8_ephemeral=RPC8_DISPOSABLE\`, PG17 guard and fake A/B (same Tenant), C (different Tenant).
- Inherits RPC.8 M1 and RPC.9 guarded atomic M2+M4 in **one transaction**, extends to six surfaces.
- Proves old permissive Tenant reads cross-Shop; atomic rollback of data/policies; induced fourth Message drift causes full abort; commit in disposable DB; A/B/C scoped reads, nonmember denial, revoked Manager denial; 10 composite FK constraints and negative cross-Store Order→Customer, OrderItem→Product, Message→Conversation writes; scoped SKU allows same SKU across Stores.
- **SUCCESS**: 47 Node release-gate cases + read-only baseline \`HOSTED_NO_GO\` + static IO denials.
- Does NOT prove real Supabase JWT/PostgREST claims, concurrency/load, real DDL compatibility, existing writer schema, production rollback or real merchant Owner acceptance.
- No synthetic Store rows or DDL have been sent to hosted Supabase.

## G2 — Recovery and migration gate: DESIGN VERIFIED; EXECUTION BLOCKED
0. **Preserve prior H11R owner-accepted partial application backup inspection** (\`H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS\`). Do not repeat it for ceremony. This is **not** independent full Auth/Storage restore or current complete recovery consent.
1. M0 hosted specific recovery: independently authorized actual backup scope, Auth/ACL/Storage/external config coverage, encrypted retention, same-schema restore to isolated target and observed restore receipt; approval for cost and resource creation separately.
2. G0: private four-row original canonical Store mapping + independent review + exception resolution.
3. Caller inventory: Supabase Data API/Edge RPC (especially three SECURITY DEFINER functions), n8n published/draft flows, Cloudflare/Render clients, manual scripts, Meta/Zalo webhook guard, authentication token freshness and service_role bypass. Record exact versions and independent operator approval; no unilateral REVOKE.
4. M1 controlled expand-only schema, compatibility and original policy inventory; M1 alone **does not** create Store isolation.
5. M3 composite constraints, scoped keys and writer compatibility across **all six surfaces**. Sequence constraints to avoid corrupting old live writers; review lock budget and migration ordering against real schema.
6. M2+M4: with complete owner mappings, **single transaction**, verified absence of old permissive Tenant-wide policies; lock/read blackout \`ACCESS EXCLUSIVE\`, short timeouts, drift abort and rollback. Never expose partially backfilled Store rows under legacy Tenant-only policy. After COMMIT, rollback requires a separately validated recovery protocol and handling for any intervening writes; do not assume that simply reversing DDL is safe.
7. Post-cutover independent review, least-privilege RPC grants and only then UAT. Controller approves each exact staging operation; production approval is separate.

## G3 — Real JWT Owner A/B Commerce acceptance: BLOCKED until G0/G2
**Independent named UAT cases, no execution has been claimed.** Real server-issued and session-bound JWT; never fabricate \`auth.uid()\`, user_metadata or trust client-provided tenant/store claims. Test read + denied writes through real PostgREST and service paths, compare to direct DBA row counts in private environment. Do not send PII/JWT to public CI.

| UAT | Actual authenticated identity / scenario | Expected |
|---|---|---|
| A01 | Owner A GET own Store Products | allowed only A |
| A02 | Owner A GET Store B Products in same Tenant | empty/403 |
| A03 | Owner A GET Store B Orders | empty/403 |
| A04 | Owner A GET Store B Order Items | empty/403 |
| A05 | Owner A GET Store B Customers | empty/403 |
| A06 | Owner A GET Store B Conversations | empty/403 |
| A07 | Owner A GET Store B Messages | empty/403 |
| B01 | Owner B same-Tenant GET own Store | allowed only B |
| B02 | Manager A GET own Store + allowed tool actions | scoped/role-limited |
| B03 | Manager A GET/write Store B | denied |
| C01 | Cross-Tenant Owner C GET Store A/B | denied |
| C02 | Anonymous and unassigned user GET protected records | denied |
| C03 | Revoked / disabled membership with existing session | denied after verified revocation logic |
| C04 | Fake/mutated Store and tenant claims/header | no privilege expansion |
| C05 | Expired/replayed JWT; session invalidation | denied according to actual policy |
| C06 | Insert/Update OrderItem A referencing Product B | denied by FK/privilege |
| C07 | Update Order A referencing Customer B | denied by FK/privilege |
| C08 | Write Message A referencing Conversation B | denied by FK/privilege |
| C09 | Duplicate SKU cross-Store with in-Store uniqueness enforced | behaves as approved |
| C10 | Legacy writer omits \`store_id\` | fail-closed with explicit migration compatibility |
| C11 | SECURITY DEFINER callable anon/auth, attempt cross-Store lookup | denied; independently prove caller confinement |
| C12 | Original Messenger/Zalo order reference across channels | only after trusted customer link & re-confirmation |
| C13 | Provider signature + bot binding + replay + cross-Shop spoofing | denied unless verified |
| C14 | Maintenance rollback scenario after a failed cutover | data, policy and auth state restored |
| C15 | Commerce read-only price, stock, order ownership UAT | no writes/sends until separately authorized |
| C16 | Service_role / backend bypass attempt | operational least privilege / direct audit evidence |
| C17 | Tenant-shared private support functions (outbox, channel secrets, idempotency) | reviewed scoping and no other-Shop leak |

**STOP conditions:** any cross-Store read/write; missing real owner; old RLS permissive policy; JWT stale/forged approval; leaked credential; incomplete backup/restore; unreviewed privileged RPC or published caller; unapproved downtime/cost. End state remains \`HOSTED_NO_GO\`, independent UAT not yet performed.

## Scope / rollback / status
- VERIFIED: real row counts, source metadata booleans, policies, function role grants, n8n workflow architecture/versions, actual GitHub PG17 CI.
- IMPLEMENTED + TESTED: source-only six-surface PG17 disposable regression and 47 Node tests.
- BLOCKED: real per-row Store ownership, private merchant/reviewer signatures, full recovery authority, real JWT/UAT, hosted Store migration.
- Changes: only GitHub Draft PR #247 source/CI; no hosted DDL/RLS data, n8n Published, provider send, subscription or credentials changed.
- Rollback: close unmerged Draft PR #247; no hosted rollback necessary.
- **Checkpoint:** \`RPC10_G1_PG17_6_SURFACE_PASS__G0_G2_G3_HOSTED_NO_GO\`.

## Additional G0/G2 operator inventory — n8n Data Tables, anonymized (READ ONLY)
Observed in connected n8n project \`WW82YsCCaAxGC9dp\`, without exposing account IDs, tenant/store identifiers, recipient refs or credentials:
- \`TIEN404_COMMERCE_CHANNELS\`: 6/6 rows have Tenant + channel-account bindings, **0 credential refs**, and **no Store column in this contract**. Cannot establish Shop-level Commerce isolation from this channel mapping.
- \`AI_SALES_V45_MERCHANT_CHANNELS_STAGING\`: 3/3 rows have \`store_id\`, 2/3 \`owner_verified=true\`, 2/3 \`verified=true\`, 2/3 have recipient binding. **Self-asserted staging fields are not independently authenticated original merchant-to-Store proof, nor safely linked to the four hosted Supabase Commerce rows.**
- \`TIEN404_V171C_QA_INSTALLATION_BOT_BINDINGS_NO_SEND\`: 3/3 have store/tenant refs, 3/3 are read-only, **0/3** \`owner_authority_verified=true\`. QA-only bindings are not production authority.
- \`TIEN404_R1_SHOP_BOT_REGISTRY_QA\`: 2/2 rows have store and tenant labels, QA identity metadata only.
**P0 interface-contract finding:** n8n Commerce resolver and channel registry must move from Tenant-only \`tenantId\` to server-verified canonical \`tenant_id + store_id\`; the provider account/page and store owner proof must be checked out-of-band. Do not take a staging \`owner_verified=true\` flag as authorization for a hosted RLS migration. Never splice DEMO, Merchant Channels staging and Supabase hosted Commerce rows without an approved, audited source mapping.

## GitHub CI evidence
- On head \`37979edaedbcb49e2c756f35f807ce0d64c3de9f\`: https://github.com/ngoctien20/demo-git/actions/runs/43996434462 — **SUCCESS**, both PostgreSQL 17 disposable and 47 Node gate jobs.
- Later documentation changes do not change the tested six-surface SQL logic. Re-check GitHub Actions on final HEAD before declaring a newer commit tested.

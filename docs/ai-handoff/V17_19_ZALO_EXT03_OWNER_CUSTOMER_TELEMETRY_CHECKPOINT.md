# TIEN404 V17.19 — Zalo Bot EXT03 owner-vs-customer telemetry-only release

**Date:** 2026-11-17 JST. **Scope:** Implement the user's approval to continue Zalo Customer UAT while respecting Owner/Customer isolation. **Verdict:** `IMPLEMENTED_AND_OFFLINE_TESTED` for additive staging telemetry; `PENDING_REAL_NON_OWNER_ZALO_CUSTOMER_INGRESS`; `NO_GO_NATIVE_ZALO_OA_COMMERCE`.

## 1. Exact baseline and source evidence

- Existing Zalo Bot staging workflow `TIEN404_ZALO_BOT_LAB_V1_STAGING`, ID `yIJk8LvJoLF40Z62`, former Published version **`776486b2-092f-49ec-a7c4-f74ec8b60f07`**; active with 12 nodes and 200 OK webhook ACK. The integration is **Zalo Bot protected staging**, NOT official merchant Zalo OA.
- Existing private Customer Router `sIPs6egzIwOY1GNv`, Published `8d91d23c-cd87-462f-a112-9cca2340bec8`. Its code explicitly returns `status=OWNER_ROUTE_SEPARATE, route=OWNER, reason=owner_isolation` for an authenticated owner, ahead of customer-case logic. This is a security feature.
- Actual owner's prior `TIEN404 EXT 03` inbound: `v123_ext03_ingress=SEEN_AUTHENTICATED_WEBHOOK`, `owner_gate=eligible`, but `v123_ext03_customer=NOT_ACCEPTED_BY_CUSTOMER_ROUTER` because it is an owner, not a customer. Prior technical Core bridge #5002 → Core #5003 FAIL-CLOSED without sending or writing.
- Snapshot of original EXACT n8n Code node source saved in `qa/v1719-zalo-owner-customer-route/EXT03_marker_before_V1719.n8n.js` before patch.
- Candidate source saved in `qa/v1719-zalo-owner-customer-route/EXT03_marker_candidate_V1719.n8n.txt`, compared byte-for-byte (ignoring terminal newline) to the current published n8n node source.
- Reproducible Node built-in `node:test` test file `qa/v1719-zalo-owner-customer-route/EXT03_marker_candidate_V1719.test.mjs` tests the actual n8n Code node source in a sandboxed `node:vm` context with synthetic `$input`, `$` and Date. No network, Zalo credentials, webhook, real chat ID or Orders.

## 2. Minimal implemented fix and compatibility

Only one n8n Code node changed: `Build EXT03 Sanitized Markers V12.3`.

When a properly normalized `TIEN404 EXT 03` event is encountered:
- Preserve **both original upserts unchanged**:
  - `v123_ext03_ingress` → `SEEN_AUTHENTICATED_WEBHOOK`
  - `v123_ext03_customer` → `CUSTOMER_ROUTE_ELIGIBLE` only for an actual Customer Router ACCEPT; otherwise `NOT_ACCEPTED_BY_CUSTOMER_ROUTER`.
- Add a **third PII-free marker** `v123_ext03_route`:
  - `CUSTOMER_ROUTE_ELIGIBLE` only for `PUBLIC_CUSTOMER_EVENT_ACCEPTED`, `route=CUSTOMER`, `qa_ext03_match=true`, `external_sends=0`, `orders_written=0`.
  - `OWNER_ROUTE_SEPARATE` only for `status=OWNER_ROUTE_SEPARATE`, `route=OWNER`, `reason=owner_isolation`, `external_sends=0`, `orders_written=0`.
  - `ROUTE_UNVERIFIED` for everything else, including malformed/missing Customer Router output and any unexpected sends or order writes.
- All markers contain exactly `slot`, `outcome`, and `observed_at`: no customer identity or text, chat ID, token, owner identifier, product/Order data or credentials.
- Existing Owner allowlist, Customer Router, product DB, webhook authentication, response ACK, Zalo Shadow, shared Core, Messenger and Website were **not changed**.
- New marker is an extra row in the existing QA marker table (when next EXT03 event arrives); it does **not** modify or delete existing marker slots or retroactively rewrite prior evidence.

## 3. Verified QA and evidence

- **14/14 Node.js v22 built-in tests PASS**, executed locally in a real Node.js sandbox on exact candidate Code node behavior: 10 owner/customer/bad-status/fail-closed policy cases and four invalid or non-EXT03 event cases. Re-executed 14/14 after creation of GitHub candidate and test files.
- Updated node config validated with n8n node schema: `valid:true`.
- Exact version diff from previous Published `776486b2-092f-49ec-a7c4-f74ec8b60f07`: **one existing Code node modified**, **no nodes or connections added/removed**, no settings/credential changes.
- **Published staging** new version **`2d912cb0-007f-452f-9536-b92ba12a03e6`**; n8n readback confirmed `active:true`, `activeVersionId=versionId`, unchanged 12 nodes.
- Current QA marker Data Table after Published still has seven preexisting rows and **no `v123_ext03_route` row yet**. This is **expected** because the additive marker is written only on the NEXT EXT03 webhook event. No provider webhook test was intentionally injected to avoid overwriting authentic customer/owner QA evidence.
- No real non-owner Zalo Customer event or upsert under the updated version has been observed. **Do not claim customer-route UAT PASS.**

## 4. Residual security and current release decisions

| Gate | Current status |
| --- | --- |
| Zalo Bot protected webhook positive 200 / missing-header 403 | **VERIFIED earlier V17.18 test #4992** |
| Owner EXT03 authentic ingress / Owner Gate eligible | **VERIFIED earlier real owner action, V17.18R** |
| New owner-vs-customer marker policy | **IMPLEMENTED / LOCAL TESTED 14/14 / PUBLISHED staging** |
| New marker end-to-end live write/read after this release | **PENDING NEXT EXT03 EVENT** |
| Customer route from a distinct non-Owner Zalo account | **PENDING REAL NON-OWNER TEST** |
| Native Zalo OA channel, real merchant Store ownership, hosted Store RLS | **BLOCKED / NO-GO** |
| Public customer reply / Commerce create order / stock update / payment | **NOT ENABLED** |

**Next safe customer action:** An independent, consented **non-Owner** Zalo Bot staging test account (not a real customer) may send exactly `TIEN404 EXT 03` **once** to the existing Bot. The owner should not remove their own Owner allowlist entry, spoof a chat ID, or send the message again from the same Owner account to try to make the customer marker pass. After the tester confirms, inspect three marker slots, Owner Gate as `denied` for the nonowner (expected), actual shared Core shadow as denied, zero external sends/orders. In the Customer Router, only a registered synthetic staging bot binding can take the `CUSTOMER` route.

**Rollback:** Restore Zalo Bot previous Published `776486b2-092f-49ec-a7c4-f74ec8b60f07` to remove new marker behavior. Existing two legacy markers remain and are still compatible. Do not rollback unless a regression is found. PR #243 stays DRAFT and unmerged.

# TIEN404 AI — RPC14 Private Merchant Evidence Hardening × Durable Replay × Host Go/No-Go

**Date: 2026-11-17 JST.** Stack-on RPC13 Draft PR #285, RPC12 #281, RPC11 #279. Do not merge or deploy without separate review.

## Verified current hosted data (read-only)
- Cloudflare account: one Access app for existing Pages staging with allow-by-email, **not** a dedicated Merchant proof intake app.
- Cloudflare R2 listing returns **HTTP 403 / error 10042: Please enable R2 through the Cloudflare Dashboard**. R2 is not provisioned; this is a billing/owner enablement gate, not a reason to improvise customer evidence storage.
- Supabase staging project `ifxlvrhyjhbzbrkdsida`: **0 Storage buckets, 0 Storage objects**. A private bucket could be considered as an alternative, but has not been authorized, created, audited, or scanned.
- Existing Commerce: **2 Products, 2 Orders**, no `public.stores`, no `public.store_memberships`, `store_id` on **0/6 tables**. No source-authenticated original ownership proof for P1/P2/O1/O2.
- Same-Tenant two distinct confirmed Auth Owners exist, but only one ever signed in according to `auth.users.last_sign_in_at` at RPC13 check. Global session counts do not prove two separate authenticated Owner Store sessions.

## RPC13 risk audit remediated in RPC14 source
1. Body-size DoS: RPC13 called `.formData()` before bounding the total request; RPC14 reads the stream **up to 8 MiB + 64 KiB maximum**, rejects larger requests before multipart parse; checks Content-Length early too.
2. Input smuggling: exactly three allowed multipart keys; duplicate slot/type/file or extra Store ID is rejected.
3. Content spoofing: stronger PDF EOF, PNG signature/IEND and JPEG SOI/EOI checks (still **not** a substitute for antivirus, CDR or malware scanning).
4. Unauthorized invitation: invitation is bound to the **server-verified** Supabase Auth ID + signed Cloudflare Access subject + one slot **and** the authorized original source type. The owner cannot choose or change Store binding or source type.
5. Replay: a strict `reserveOnce` contract consumes an invite before object upload. Failed uploads/failed finalization **never re-open** the invitation; orphaned quarantine objects require a separate audited retention sweeper.
6. Quarantine state: 202 only means PENDING_MALWARE_SCAN; signed scanner receipt can transition to SCANNED_CLEAN/MALWARE_REJECTED but **never** to Owner APPROVED. Reviewer must be distinct from Merchant and independently assigned, yet code still refuses final original-source authority without external primary evidence.
7. Pre-auth rate limiter adapter receives **only static route metadata**, never tokens or headers. Hosted rate/concurrency implementation not present.
8. Separate strict PostgreSQL 17 disposable fixture tests one-use durable UPDATE and two concurrent reservations for the same invite. The fixture is **not** a production identity verification or a Supabase migration.

## Unmet production prerequisites
- Merchant/Owner must explicitly enable R2 (free tier does not guarantee zero cost, and enabled account may require billing setup), or approve a secure private Supabase Storage alternative under a separate plan.
- Dedicated isolated Access application with server-validated Access signature, origin/audience and owner-reviewed allowlist. Do not change existing Pages Access app.
- Dedicated worker, least-privilege secret binding, private object storage (deny public URLs), genuine durable owner-authorized invitation ledger, per-IP/global rate/concurrency, signed malware scanner integration and CDR or equivalent.
- Retention and deletion schedule, backup/recovery, immutable access logs, incident controls, independent reviewer, privacy/consent process.
- Four **original** Merchant source records with independently verified provenance (not just HMACs/synthetic screenshots), and owner signatures.
- Canonical Store mapping, SQL compatibility, independently approved migrations and actual same-Tenant two-Owner **real signed Supabase Auth JWT** read-only UAT across six tables before any Store Commerce release.

## Authority
- **SOURCE-ONLY:** IMPLEMENTED.
- **NODE / PG17 CI:** actual GitHub Actions run must be checked before claiming TESTED.
- **R2 / Supabase Storage / Cloudflare Access merchant route:** BLOCKED; **none created**.
- **Merchant proofs:** 0/4 independently verified.
- **Real JWT UAT:** NOT RUN, impossible with current hosted Store mapping.
- **HOSTED:** NO-GO for every action.

Rollback: Close RPC14 Draft PR and delete branch. New source files only; no hosted data, uploads, payments, credentials, owner memberships or Messenger/Zalo workflow changed.
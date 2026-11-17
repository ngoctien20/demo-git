# TIEN404 AI — V17.1K-S1 Zero-Trust Merchant Image Intake and Malicious File Security

Date: 2026-11-17 JST
Parent: Draft PR #267 HEAD 85ed0d520d359451d1a717a86ceeb12f0456fb1c
Status before CI: IMPLEMENTED SOURCE CANDIDATE / QA PENDING / HOSTED P0 NO-GO.

## Threat model and observed code gaps

A malicious person can register or pay for a Store, submit a hostile link/file, spoof an owner, attack reviewers or try to pivot to n8n/Supabase/other Stores. Paid account status and staff visual inspection are not a security boundary. An image may contain malicious EXIF, polyglot trailing bytes, pixel bombs, decoder exploits and prompt-injection text visible to a multimodal model.

Verified code limitation in parent: qa/v171k-commerce/staff-image-intake.cjs checks only PNG/JPEG/WebP magic prefix + SHA (not full raster); qa/v171h-commerce/multiformat-local-media.py decodes actual raster and produces a safe 16D descriptor, not a newly re-encoded media file. Neither proves independent staff session, isolation, scanner, private storage or legal image rights.

OWASP File Upload Cheat Sheet: allowlist, verify content and file signature, random server-generated names, isolate private storage, scan and where appropriate re-encode. OWASP SSRF Cheat Sheet: uploaded image URL can trigger internal-network SSRF if server retrieves unchecked links.

## Security source added

- qa/v171k-security/image_quarantine_reencode.py: byte cap 2 MiB, SHA-256 binding, PNG/JPEG/WebP signature and real Pillow decode, 1024-pixel/768k-pixel max, rejects animated/GIF/SVG/HTML; EXIF orientation, regenerate a new RGB-only PNG without original metadata, return safe pixel image bytes ONLY to a private isolated worker handoff, not to web UI/n8n/GSheets. It intentionally does not claim that a re-encoded image is guaranteed malware-free.
- qa/v171k-security/zero-trust-media-review.cjs: merchant URL is non-clickable UNTRUSTED TEXT; rejects unsafe protocols, local hostnames/IP, credentials, query tokens, HTML/control characters and encoded delimiters. Only SHA and hostname returned; absolutely zero automatic preview, DNS or download. For staff visual website visits, use independently isolated disposable browser with NO n8n/Supabase staff admin sessions.
- Staff review candidate: require a private Store/SKU-bound sanitized SHA storage receipt, recent independent scanner declaration, distinct MFA reviewer and external staff-authorizer callback. Even if all supplied fixture flags pass, response cannot publish media or enable model. A forged test callback or scanner receipt is not proof of external authority.

## Mandatory hosted P0 gates (not implemented)
1. Verify merchant account and independently attest Store ownership. Payment is not proof. Tenant/store must derive from server JWT/RLS, never form fields. Signup abuse/rate limiting and upload quotas.
2. Private untrusted staging bucket, random object keys, no execution, no publicly retrievable original file, object TTL and revoke/appeals; deny CSRF, path traversal, content-type confusion, CSRF and cross-store IDOR.
3. Dedicated worker sandbox for image decoding: no network egress, no cloud metadata endpoint, no persistent credentials, read-only root FS, bounded CPU/memory, patched codec; no privileged n8n/Commerce process handles hostile bytes.
4. Scan original/clean payload as feasible with actual independent malware scanner. Fail closed if scanner unavailable, ambiguous or timed out. Independently sign verdict bound to media SHA; scanner is defence-in-depth not a guarantee.
5. Two-person TIEN404 staff media review: authenticated role and MFA, uploader != approver, recheck staff Store authorization at approval, review only reconstructed preview; audit immutable user/time/hash. Separate legal rights and license audit.
6. All image/OCR/product text and remote content remain UNTRUSTED DATA. Never obey instructions embedded in images and never grant model tool permission to change SKU/price/stock/order or access other shops.
7. Real clean Store-private storage RLS and independent cross-shop A/B adversarial tests. No remote URL fetching. If ever required, separately audited egress proxy pinning validated IP/hostname and TLS with redirect denial.
8. Hostile image penetration testing, decoder fuzzing, malware corpus, quota/DoS/SSRF tests, privacy and rollback before anything production.

## QA and rollback

New offline Python image reconstruction security fixtures + Node malicious URL/two-person review fixtures. Preserve 395 inherited cases from V17.1K to V17.1D. Count only after GitHub Actions logs.
Production NO-GO intentionally red. Zero real malicious files uploaded, zero real websites fetched, zero real scanner/hosted JWT/RLS tested, zero real Vision calls or Messenger/Zalo sends, zero hosted changes.
Rollback by closing child Draft PR; parent PR #267 and all hosted data unchanged.


## VERIFIED — GitHub Actions security QA receipt (2026-11-17 JST)

Implementation tested HEAD: 8ea59ec6b2afcc5455db5cea93beebfcfabcc78b.
Actions: https://github.com/ngoctien20/demo-git/actions/runs/44015248230

- New V17.1K-S1 Python actual encoded PNG/JPEG/WebP, malicious prefix, trailing payload removal through reconstructed pixels, EXIF metadata strip, animation refusal, decompression size limits, SKU/store scope and false hosted-authority claims: 31/31 PASS.
- New V17.1K-S1 Node malicious URL, non-clickable link digest, staff impersonation, scope mismatch, forged scanner/private storage declarations, two-person MFA review and denied public/model release: 36/36 PASS.
- Inherited V17.1K 45/45, V17.1J 76/76, V17.1I 82/82, V17.1H 40/40, V17.1G 40/40, V17.1F 32/32, V17.1E 28/28, V17.1D 52/52: 395/395 PASS.
- Total 462/462 offline source tests PASS, zero failed. Source job 133811498277 SUCCESS; source-only no-network/no-provider/no-secret static guard PASS.
- Hosted security release job 133811656462 intentionally FAILURE. Overall workflow conclusion FAILURE by policy, NOT because source test failed.
- There was NO real malware scanner, NO independently verified developer sandbox/egress policy, NO private media bucket, NO verified Store JWT/RLS, NO real staff MFA workflow, NO malicious external URL opened, NO genuine merchant image uploaded, NO vendor model call or Messenger/Zalo SEND. Synthetic test callbacks and scanner receipts are not trusted external proofs.

**Classification:** V17.1K-S1 IMPLEMENTED / OFFLINE TESTED / P0 HOSTED FILE INTAKE NO-GO.

**Remaining P0 gates:** independent image decoder worker isolation; no-network/no-credential enforcement; fail-closed real AV scanner; Store RLS on private upload/storage and revocation; secure staff panel (MFA, CSRF, roles, 2-person independent review); protected media object signed receipts; upload abuse/rate/size/CPU quotas; no automatic URL fetch; adversarial cross-tenant tests and rollback rehearsal; independent security review. None can be waived merely because a staff member clicked Approve.

**Rollback:** close Draft child PR #270; parent #267 and production data unchanged. No hosted backup restoration required.

**Checkpoint-only documentation change:** reverify CI at the final HEAD before declaring the final commit tested.

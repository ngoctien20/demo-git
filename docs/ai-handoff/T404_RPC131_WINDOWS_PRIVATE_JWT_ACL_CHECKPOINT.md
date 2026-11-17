# TIEN404 RPC13.1 — Private JWT file on Windows: NTFS ACL hardening

**Date:** 2026-11-17 JST. **Source-only / FAKE JWT tests / real JWT NOT used.**

**Parent:** [RPC13 PR #285](https://github.com/ngoctien20/demo-git/pull/285), exact pinned HEAD ead41f53df4d0609fb5f5f6b2733a6c3c0e91ac0. Related [V17.03B PR #310](https://github.com/ngoctien20/demo-git/pull/310), provenance QA_LIKELY not independently established.

## Concrete security defect and fix

Original qa/v152-rpc13/live-auth-uat.mjs only enforced strict POSIX file mode when process.platform was not win32. Native Windows skipped NTFS discretionary ACL inspection, so a JWT file readable by Users or Everyone could pass size/format checks. This is a source-level vulnerability, NOT evidence that a real token was exposed.

The new qa/v152-rpc13/private-token-file-security.mjs inspects the actual Windows account SID and NTFS ACL via PowerShell; denies non-current-user principals except SYSTEM and built-in Administrators, owner mismatch, Deny ACL entries, and file reparse points. No JWT bytes are supplied to PowerShell (only a base64-encoded filename). If the native check fails, JWT reading fails closed.

POSIX mode 0600-like checks remain; symlinks are rejected and opened-file identity/metadata are compared before/after reading. Original RPC13 UAT logic, real six-surface Auth PostgREST checks and CI stop gates remain unchanged.

## Verification plan

GitHub Actions workflow .github/workflows/v152-rpc131-jwt-file-acl-qa.yml runs fake-token ACL tests on native Windows 2022 and Ubuntu 24.04, and inherited RPC13 synthetic security tests. A Windows test creates and inspects a private NTFS DACL; a second fake-file test adds the Everyone SID to establish rejection. No live provider requests, real JWTs or merchant files are used in CI.

**Limitations:** ACL protection does not defend against malware with the same user's permissions, an administrator, keyloggers, memory theft, or a compromised host. Operators must use a trusted encrypted device, short-lived sessions, a private workspace and independently approved credentials. No tokens in ChatGPT, PR, n8n, screenshots or logs.

## Release and rollback

- Actual same-Tenant Store A/B real JWT UAT remains BLOCKED until authentic two independent owners, approved Store and Staff mapping, six-surface Store RLS, read-only QA sentinels and PRE-M1 recovery are separately verified.
- Existing four legacy records are QA_LIKELY_NOT_VERIFIED_SYNTHETIC, not eligible for automatic Merchant ownership certification.
- Do not alter hosted RLS, public Worker, Access policies, R2 data, n8n Published, Meta/Zalo resources or billing from this source-only child PR.
- If ACL validation fails on a Windows operator host, do NOT weaken the control. Only a separately authorized Security operator should review and restrict local NTFS DACLs; never execute this against live JWTs until approval.
- Rollback this source-only change by closing the Draft child PR. Do not "repair" a real JWT failure by returning to the insecure Windows bypass.

**QA status:** require exact HEAD GitHub Actions successful Windows and Linux jobs before marking TESTED. Passing fake-token ACL tests never proves independent real JWT owner authority.

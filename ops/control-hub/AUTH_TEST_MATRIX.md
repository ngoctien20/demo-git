# TIEN404 Control Hub — authorized authentication and security test matrix

**NOT EXECUTED.** Use only with owner-approved test accounts and a staging snapshot of the *existing* Sites project. Never brute force, bypass access controls, or use real customer data in test inputs.

| ID | Test case | Expected result | Evidence required |
|---|---|---|---|
| AUTH-01 | Anonymous `/` and private API | Login redirect or 401/403 per existing policy, never private data | HTTP codes + redacted headers |
| AUTH-02 | Correct authorized login | Session established, intended role displayed | Browser trace without cookies |
| AUTH-03 | Refresh dashboard | Identity retained according to session TTL | Browser trace |
| AUTH-04 | Sign out and open private deep-link | Session revoked; no private content from cache | Browser/network trace |
| AUTH-05 | Re-login and revisit deep-link | User lands on intended authorized page; no open redirect | E2E assertions |
| AUTH-06 | Viewer calls owner API by URL | `403`, with server-side permission check | API response and audit log |
| AUTH-07 | Untrusted request without valid CSRF proof | Reject, no mutation | API assertions and D1 check |
| AUTH-08 | Session expiry and key rotation | Fail closed; refresh/relogin as designed | Clock-controlled test |
| AUTH-09 | Tenant A requests tenant B resource | `403`/`404`, no data from tenant B | Redacted test fixtures |
| AUTH-10 | Provider upstream 429/5xx/timeout | `RATE_LIMITED`/`SERVICE_ERROR`/`CONNECTION_ERROR`; no false `OK` | Stub response + UI screenshot |
| AUTH-11 | Attempt to inject HTML / SVG / JSON instruction in displayed fields | Values safely escaped, no script execution | CSP+XSS test evidence |
| AUTH-12 | Credential/API key leak scan | No credentials in JS bundle, logs, downloadable backups or D1 exports | Secret scan report |
| AUTH-13 | Controlled backup/restore | Checksum verified; restore on staging with no live mutation | Test recording + log |

Before running: identify Sites source, auth mechanism, cookie policy, identity provider, D1 schema, allowed roles, backup location. Record actual results in `QA_REPORT.md`; `NOT_EXECUTED` must never change to PASS without evidence.
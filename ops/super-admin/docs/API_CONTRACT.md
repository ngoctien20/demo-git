# TIEN404 AI V4 — API_CONTRACT

**Stage:** tested locally over FastAPI/SQLite; not mounted on Control Hub Sites/D1. All response bodies include source-qualified status where meaningful. No n8n management write endpoints exist.

## Authentication

All administrative read/write routes require `__Host-tien404_sid` (Secure, HttpOnly, SameSite=Strict, path=/, 8h TTL). The session token is stored only as a SHA-256 digest in the backend. Login uses Argon2id password verification + TOTP MFA, with replay protection and failed-attempt throttling. Every state-changing browser request requires `Origin: <exact admin HTTPS origin>` and `X-CSRF-Token` issued to the session.

| Method | Path | Role / guard | Response |
|---|---|---|---|
| `GET` | `/health` | Public | `STAGING_ONLY`, `production_readiness: NOT_APPROVED` |
| `POST` | `/api/v1/auth/login` | Password + TOTP | `csrf`, session expiry; HttpOnly cookie |
| `GET` | `/api/v1/auth/me` | Session | User ID, role, expiry |
| `POST` | `/api/v1/auth/csrf` | Session | Rotated CSRF token (not persisted by JS localStorage) |
| `POST` | `/api/v1/auth/reauth` | Session + CSRF + new password/TOTP | Extend sensitive-operation reauth window |
| `POST` | `/api/v1/auth/logout` | Session + CSRF | Revoke current session |
| `POST` | `/api/v1/auth/logout-all` | Session + CSRF | Revoke all personal sessions |
| `POST` | `/api/v1/admin/users/{id}/revoke-sessions` | SUPER_ADMIN + recent MFA + CSRF + reason | Revoke named user's sessions |

## Tenant service and billing staging endpoints

| Method | Path | Role / guard | Semantics |
|---|---|---|---|
| GET | `/api/v1/admin/tenants` | Global admins, read-only | Staging tenants; source `staging_sqlite` |
| POST | `/api/v1/admin/tenants` | SUPER_ADMIN + fresh MFA | Create tenant with an existing STORE_OWNER ID |
| POST | `/api/v1/admin/plans` | SUPER_ADMIN + fresh MFA | Configurable plan with integer VND and limits |
| POST | `/api/v1/admin/tenants/{id}/subscription` | SUPER_ADMIN + fresh MFA + `confirm_tenant_id==id` | Create subscription; paid assignment is PAYMENT_DUE, not ACTIVE |
| GET | `/api/v1/tenants/{id}/entitlement` | Global admin or verified membership | `allowed`, reason, state, checked-at; fail-closed |
| POST | `/api/v1/admin/tenants/{id}/service` | SUPER_ADMIN + fresh MFA + confirmation + reason | Tenant flag only. Does **not** activate/deactivate n8n workflows |
| POST | `/api/v1/admin/tenants/{id}/reconcile` | SUPER_ADMIN + fresh MFA | Idempotent lifecycle reconciliation; no notification send |
| GET | `/api/v1/admin/audit` | SUPER_ADMIN | Redacted audit and chain verification |

## Channel and knowledge staging endpoints

| Method | Path | Role / guard | Semantics |
|---|---|---|---|
| POST | `/api/v1/admin/tenants/{id}/channels` | SUPER_ADMIN/TECH_ADMIN + fresh MFA + exact ID | Store opaque `vault://` reference only; connection status UNKNOWN |
| GET | `/api/v1/tenants/{id}/channels` | Admin or tenant member | Metadata only, never token or `secret_ref` |
| POST | `/api/v1/admin/knowledge/drafts` | SUPER_ADMIN + fresh MFA | Versioned DRAFT record |
| POST | `/api/v1/admin/knowledge/{id}/approve` | SUPER_ADMIN + fresh MFA | Publish approved knowledge state **only in staging DB** |
| GET | `/api/v1/public/knowledge/{kind}` | Public for PRODUCT/PRICING/PUBLIC_DOC only | Latest approved version or 404; no fabricated pricing |

## Internal API (staging only, disabled by default)

- `POST /api/v1/internal/gateway/entitlement`: enabled only when a private staging `gateway_secret` is injected; exact JSON `{platform, account_ref, request_id, purpose:'CHECK_ENTITLEMENT'}`, timestamp, signed HMAC. No inbound tenant ID accepted. Returns entitlement after resolving verified channel identity. The platform webhook itself must already be authenticated by a different official platform adapter (not yet implemented). Never expose this endpoint to untrusted public clients in production.
- `POST /api/v1/internal/qa/test-payment-webhook`: enabled only in isolated QA when private test HMAC secret and explicit enable flag are provided. `SANDBOX_HMAC` events only. Not compatible with a real payment processor and must be disabled in production.

## Errors

`401` not logged in; `403` role, CSRF, signature, origin, token or freshness rejected; `404` tenant/knowledge/disabled integration unknown; `409` duplicate or illegal transition; `422` validation errors; `429` login rate limited. Denials must not expose account secrets, backend tokens or full payment bodies.

## Production response envelope proposal (not implemented)

```json
{"data":null,"source":"n8n-private-proxy","observed_at":"2026-11-10T10:00:00Z","status":"UNKNOWN","error_code":"BACKEND_NOT_CONNECTED"}
```

Use `UNKNOWN/CONNECTION_ERROR` for unavailable GitHub/n8n sources. Do not use local staging counts as live tenant or revenue metrics. Define tenant and role-specific response schemas before porting into Sites.
## V9 · Hạn mức tin nhắn staging

- `POST /api/v1/internal/gateway/reserve-message` nhận assertion HMAC hiện có với purpose `RESERVE_MESSAGE`. Tenant lấy từ mapping kênh VERIFIED. Gateway từ chối khi dịch vụ tắt, bot nghỉ, thuê bao hết quyền hoặc đã dùng hết hạn mức. Chỉ một lượt cho mỗi tenant, kênh và mã sự kiện. Retry trả `reserved=false, reason=ALREADY_RESERVED`.
- `GET /api/v1/admin/usage?page=1` cần phiên MFA của super/support/tech-admin. Trả tối đa 50 tenant mỗi trang, số lượt giữ và hạn mức tháng UTC. Gói thiếu trả quota null. Không ghi nội dung tin nhắn, số điện thoại hay chi phí ước đoán.
- Một lượt đo là một quyết định giữ chỗ trước khi xử lý. Chưa đấu nối nhà cung cấp, xác nhận giao tin, thu phí, hoàn lượt hoặc đối soát. Hạn mức tháng UTC chỉ dùng cho ứng viên staging. Khi hồi quy, revert commit ứng viên và giữ bảng số liệu để điều tra.

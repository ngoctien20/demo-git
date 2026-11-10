# TIEN404 AI V4 — ONE_CLICK_SETUP Readiness Contract

**Design only, not active UI or n8n workflow orchestration.** A setup wizard must not silently create credentials, modify Orders/Products, start billing or publish shared workflows.

| Step | Expected source | Readiness |
|---|---|---|
| Select tenant | Server-side tenant registry | Verified session and tenant role; membership test |
| Select industry | Approved industry profile | Profile and approved version available |
| Choose core bot | Signed approved core template registry | Stable release ID, QA and rollback version |
| Choose channel | Provider-specific adapter metadata | Confirm official eligibility and permission grant |
| Authorize account | Official OAuth / secure token intake | Provider-signed webhook and unique account mapping |
| Import products | Tenant-specific import staging | CSV validation and no cross-tenant SKU or inventory reads |
| Configure shop hours | Tenant store settings | Timezone/DST tests, no shared workflow pause |
| Configure notifications | Verified destination + consent | Retry policy and idempotency |
| Assign plan | Approved pricing catalog | Staged entitlement only; payment proof required for ACTIVE |
| Dry run QA | Read-only test suite | All required tests passed against sample records |
| Approval | Role-based verified approval | Audit trail + fresh MFA, optional second approver |
| Activate | Signed tenant entitlement mapping | Only tenant-level flag, NOT unpublish shared workflow |

Product selection and feature readiness must preserve the pipeline: **Messenger Test Bot → QA → Approved Core Template → Industry Profile → Customer Bot**. This code does not promote any n8n workflow or bot version.

Missing credentials, failing QA, unverified provider permissions, no approved pricing or an unapproved template must display **NOT_READY** with a specific reason. The admin cannot override these guards from a client-side button.
# TIEN404 Control Hub V2 — Integration contract (staging proposal)

**Status:** design and independently tested public-source probe. **NOT installed in the live Sites Control Hub.** Do not treat this document as an enabled feature.

## Non-negotiable boundary

Keep the existing Sites application's routes, framework, auth, D1 bindings and UI intact. Inspect those resources first. Add a small *server-side, authenticated* read-only data adapter; never expose GitHub App keys, n8n API keys, workflow credentials, D1 service bindings, or private execution inputs in the browser or static artifacts. The public `demo-git` repository does not own the existing Control Hub source.

## Truthful provider value

Each displayed metric needs an envelope, not an unqualified number:

```json
{
  "key": "n8n.workflows.active",
  "value": null,
  "unit": "workflows",
  "state": "UNKNOWN",
  "observed_at": null,
  "source": "n8n API /workflows",
  "scope": "production+qa (explicit)",
  "reason": "Authenticated server-side integration not configured"
}
```

States: `OK`, `STALE`, `UNKNOWN`, `AUTH_REQUIRED`, `RATE_LIMITED`, `CONNECTION_ERROR`, `SERVICE_ERROR`, `PARSE_ERROR`, `NOT_TESTED`. A `200` or a green GitHub build is **not** a passing authorization/functional test. Never fill `null` with zero. On a non-2xx reply show an error state instead of reusing an old value without a STALE label.

## Read-only backend endpoints (proposal; NOT live)

| Server endpoint | Source | Required guarantees |
|---|---|---|
| `GET /api/control/health` | public site and GitHub API | existing session, `viewer` role+, source freshness and traceable timestamps |
| `GET /api/control/workflows` | n8n credential in server vault | server RBAC, project segregation, filtered metadata, paginated, no node secrets |
| `GET /api/control/executions?workflowId=` | n8n execution API | authenticated viewer, pagination, status/time only, no sensitive input/output payloads |
| `GET /api/control/qa` | GitHub Actions artifact metadata | restrict linked evidence and redaction; never fetch private logs in public browser |
| `GET /api/control/approvals` | existing Control Hub D1 | server auth, CSRF/session controls, audit trail |

No `POST`, `PATCH` or `DELETE` administrative action is authorized by this contract. Any future sensitive operation needs distinct server permission checks, human approval, optimistic concurrency, immutable audit entries, dry run, and rollback validation. Avoid making n8n executions with production inputs just to populate graphs.

### Role and access matrix to verify in **existing Sites** source

| Action | Viewer | Operator | Owner |
|---|---|---|---|
| Read scrubbed metrics | yes | yes | yes |
| See private workflow configuration | no | case-by-case | yes |
| Propose patch / PR | no | yes | yes |
| Approve production publish | no | no | yes + re-auth |
| Rotate credentials / modify billing | no | no | separately approved + audit trail |

These are **requirements**, not a claim that current roles exist. Protect every server route independently of frontend buttons.

## Version tracking

For each n8n workflow, store both the **draft `versionId`** and **live `activeVersionId`**, plus `active` flag, workflowId, node count, last run/status, total counts and time-window metadata, sampled-vs-complete flag, source and timestamp. A mismatched draft/live version must surface as `PUBLISH_REVIEW_REQUIRED`, not automatically publish. Segregate `AI_SALES_DEMO` from TIEN404 Commerce data and credentials, in line with the user's n8n preference.

## Release and monitoring policy

`DETECT → ANALYZE → PLAN → PATCH → TEST → REVIEW → APPROVE → DEPLOY → MONITOR`. Approval is mandatory before production changes. Merge checks must include:
1. Authenticated Control Hub routes verified, including successful session re-entry and expected anonymous 401.
2. Role privilege escalation and cross-tenant tests pass.
3. GitHub Actions and n8n metadata adapters tested with success, 401, 403, 429, timeout, invalid JSON and stale data.
4. Existing Sites source and D1 backup recorded with SHA-256; **staging** restore succeeds.
5. Unmodified production order workflows; customer data changes explicitly approved.
6. UI at 320, 390, 768, 1440 px, keyboard and reduced-motion verified.

The separate `probe_public.py` can supply *public-source health evidence* to a backend after authenticated server integration, but it is not a substitute for the hub's own authorization or telemetry.
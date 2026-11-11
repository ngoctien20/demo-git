# Agent Factory V1 — Canonical backlog

**Source of truth:** Supabase staging `factory_private.tasks`, not a Markdown file or n8n inbox. Snapshot only; re-query before acting.

| task_key | State | Priority | Next objective |
|---|---|---|---|
| AF-BRIDGE-20261112 | NEW | P0 | Secure, signed, idempotent n8n inbox → private PostgreSQL enqueue bridge with least-privilege runtime and durable replay protection |
| AF-MODEL-20261112 | NEW | P0/BLOCKED BY APPROVAL | Select costed model and actual provider credentials with user-approved per-task/day caps, validate existing draft Agents |
| AF-E2E-20261112 | NEW | P1/DEPENDENT | True on-demand CTO→Developer→QA_FAIL→Fix→QA_PASS→Security Review→Report with branch and CI evidence |

Every task is initialized at $0 and cannot be claimed by an unready Agent. Do not create another Supabase project, n8n Agent or Control Plane queue. Keep inherited Dev Team governance from PR #20, including review gate and max 2 fix loops.

Linked Linear issue: https://linear.app/ngoctien20/issue/NGO-15

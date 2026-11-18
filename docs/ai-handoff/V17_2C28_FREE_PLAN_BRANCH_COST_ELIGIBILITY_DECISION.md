# TIEN404 AI — V17.2C.28 Branch Cost Feasibility × Free Plan Admission Decision

Date: 2026-11-18 JST. Parent draft PR #392, approval issue #399. No hosted changes permitted in this stage.

## Evidence VERIFIED directly through Supabase connector
- Organization **ngoctien20's Org** ID `pjdoiuhtwrhzkzlhelvr`, `plan=free`, `tier=tier_free`.
- Project `tien404-staging` ref `ifxlvrhyjhbzbrkdsida` owns **zero Supabase development branches**.
- `get_cost(type=branch,organization_id=pjdoiuhtwrhzkzlhelvr)` returned `amount=0.01344` and `recurrence=hourly`; this is a price quote, NOT approval, eligibility, a full invoice, or a payment confirmation.
- PR #392 remains OPEN DRAFT, HEAD `a100df75498c0b3a4e6e78e4064a5d1559f533b5` at start of review.

## Current official Supabase docs, verified Nov 18 2026
- https://supabase.com/docs/guides/deployment — Supabase preview branching is available on **Pro** (not included in the Free tier).
- https://supabase.com/pricing — Free tier has Branching `Not included`, Pro lists $0.01344 per branch per hour.
- https://supabase.com/docs/guides/platform/manage-your-usage/branching — default Micro Preview Branch starts at **USD $0.01344/hour**, other usage (Disk, Egress, Storage) can accrue; **Branching Compute is not covered by the Spend Cap or compute credits**.
- https://supabase.com/docs/guides/deployment/branching/dashboard — dashboard-created branches inherit source project schema/migration history, configurations and some deployables; source production data is not cloned by default, and opting into data copy must be forbidden.
- https://supabase.com/docs/guides/deployment/branching — review inherited Auth, webhooks, Edge Functions, network settings, keys and all migrations before enabling; vendor documents note branch Database Webhooks may be enabled by default.
- https://supabase.com/pricing — Pro is advertised as starting **USD $25/month**, but actual organization total, taxes, billing timing and upgrade eligibility have NOT been quoted for this user. No upgrade was performed.

## Arithmetic, not an all-in price quote
Micro compute only at $0.01344/hour:
- 2h = $0.02688; 4h = $0.05376; 8h = $0.10752; 24h = $0.32256.
- If Pro required, the plan subscription can dominate a short 2–8h QA session. Do not describe these Micro figures as full cost.
- There is no hard enforced branch compute spend cap from Supabase's Spend Cap. Set an external wall-clock deletion runbook and independent confirmation if later approved.

## Decision matrix
**Option A (no paid upgrade, recommended for now)**: continue no-send, isolated PostgreSQL 17 ephemeral CI and build protected route/real Auth admission contract without connecting live credentials. Cost increment for Supabase Branching: $0. Real Supabase Auth A/B hosted UAT still NO-GO; ephemeral Postgres does not simulate actual Supabase Auth/GoTrue.

**Option B (requires separate explicit owner approval)**: confirm Pro upgrade pricing/terms in billing dashboard; accept subscription impact, quote, expiry, cleanup, reviewer, controlled migration and restore rehearsal before creating a short-lived QA branch. This is NOT implicitly approved by generic "continue".

**Option C (independent Supabase QA project)**: only consider after checking provider `get_cost(type=project)`, subscription/project limits and owner approval. Separate Auth/project may be more suitable than branching but it is NOT assumed free, automatically eligible, or cheaper.

## Mandatory hosted GO gates (unchanged)
- Paid resource + Pro upgrade if applicable explicitly approved; isolation and maximum cost understood.
- Synthetic no-send Store A/B, migration and inherited webhook audit; backup/restore drill and deletion owner.
- Independently authenticated QA owner A & B, separate private consent, trusted owner→Store authority, reviewer independent of owners.
- Protected HTTPS with real Supabase Auth `/user` + current `auth.sessions` check and negative cross-store UAT.
- No production, notifications, live orders or credential change before independent security acceptance.

## Status and rollback
**Cost quote VERIFIED; Free plan blocker VERIFIED; branch existence NONE; subscription change NOT APPROVED; Hosted Real JWT UAT NO-GO.**
This checkpoint modifies Draft PR documentation only; rollback by reverting file and/or closing Draft PR. No Supabase data, billing, credentials, integrations, webhook or branch state modified.

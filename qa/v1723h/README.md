# TIEN404 V17.23H — Disposable PG17 M1 compatibility rehearsal

**Status: DRAFT / CI-ONLY / REAL M0 NO-GO / REAL JWT NO-GO / PRODUCTION NO-GO**

Stacked review child of [PR #319](https://github.com/ngoctien20/demo-git/pull/319), reusing unchanged `qa/v176b3-private-authority/ci-disposable-pg17.sh` in GitHub Actions `postgres:17`.

## Executable scope
- Two existing products, two existing orders, and one order item created with **synthetic** identifiers.
- M1 only: add nullable store_id to product/order/item; create stores and store memberships, **no automatic legacy owner assignment**. Assert old rows and foreign keys retained.
- Dedicated synthetic future M4 candidate: same-Tenant Store A/B, distinct owners; model legacy tenant-wide permissive read *and* restrictive store membership AND; verify A→A, B→B, deny A→B, B→A, no actor and no write grants.
- Transaction ROLLBACK, assert no test schema/role residue. Keep parent PR319 source unmodified.
- Runner restricted to loopback 127.0.0.1, fixed disposable database `t404_b3_disposable`, PostgreSQL 17, CI sentinel. Never send or write to Supabase hosted.

## Explicit limits
- NOT a production migration or proof that legacy tenant-wide policies are safely replaced.
- PG17 synthetic actor claim **is not cryptographically verified JWT**; separate independent private Auth and Owner admission still required.
- H11R application archive has limited past acceptance; **current M0 scope is UNDECIDED** and real local backup has been **deferred by Owner**. No real restore receipt is accepted.
- The independent-recovery-gate intentionally always returns `NO_GO`, including all self-reported evidence flags true. No credentials, JWT, Merchant files or customer data in GitHub.
- Never merge or deploy until standalone M0 backup/restore approval, original four-row Store lineage, caller compatibility, staged M1/M2/M3/M4 plans and real JWT no-send acceptance.

## Rollback
Close this Draft PR; no existing GitHub files altered, no schema or hosted writes. CI test transaction rolls back.

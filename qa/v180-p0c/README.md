# TIEN404 V18.0-P0C — Independent disposable RPC negative QA

Status: SOURCE-ONLY CANDIDATE. This workflow does not deploy anything. It is based on the **actual deployed definitions** read through the authorized Supabase SQL connector on 2026-11-18, with **two hard-coded QA tenant allowlist UUID literals replaced by synthetic UUIDs**. Those are the only deliberate edits inside the three top-level RPC functions. The Auth, Vault, R1 QA and public dependencies are **synthetic stubs**, not exact replicas of Supabase or Zalo provider infrastructure.

Deployed definition SHA256 captured read-only:
- qa_owner_pairing: c0997a0959cf19f7f9454699d25cd0fbad9328f292e5b913e84a96f0b54db012
- qa_shop_b_zalo_claim: 25039e790d087aac5e71a32116f85e3f6269494c3c1dbc6aa9562237c72027dd
- save_merchant_product: 06e091c4537ceaf2dcfe693672a66b8f4860e6bb0e34b14eb678dcb490d6e52e

The PostgreSQL 17 test database is **disposable only**, with no network call from the script and no customer secrets. Reproduced behaviors: role-level GRANT denial, anon/no token denial, staff/outsider/metadata impersonation denial, synthetic Vault header guard, invalid claim/replay, synthetic owner challenge issue, product validation, optimistic-lock conflict, synthetic success + audit count.

**Critical not proven:** exact historical R1 QA helper function semantics; native Zalo signed ingress; real Supabase JWT; real PostgREST request headers; Store A/B same-tenant isolation; provider event authenticity; M0 backup. RP-07 and RP-08 remain explicitly **BLOCKED** because public.products lacks store_id and has tenant-scoped SKU uniqueness. Do not count this job as real hosted security acceptance.

M0 waiver: founder deferred proof **only for source/disposable QA**. No migration, RLS/grants, Data API change, provider send, production deployment, or new cost permission.

Parent: draft PR #362; source-only child branch, no merge until reviewed. Source CI is free/within existing public CI subject to actual account billing controls, no paid external service invoked.

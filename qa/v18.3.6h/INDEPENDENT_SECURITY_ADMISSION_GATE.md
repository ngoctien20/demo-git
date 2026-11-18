# V18.3.6H — Independent Security Admission Gate

## What the gate verifies offline

A **signed test reviewer evidence statement** is validated cryptographically using an Ed25519 public key pinned to an offline QA registry. The statement binds:
- review scope/audience/environment;
- reviewed code commit SHA;
- reviewer hash and a **different** implementer hash;
- nonce proof hash, session adapter contract hash and evidence package hash;
- issuance/expiry ≤ 24 h;
- explicit P0 findings closure flag.

The gate also examines canonical Store schema, six `store_id` columns, restrictive RLS, independent real Owner A/B evidence and backup/rollback approval. The actual staging snapshot is missing these prerequisites and must return `BLOCKED`.

Even if every synthetic field is populated and a valid test signature is supplied, the highest possible return value is `EVIDENCE_READY_FOR_SEPARATE_HUMAN_ADMISSION`, **NEVER** `APPROVED`, `REAL_AUTH_VERIFIED`, or production release.

## Independent human reviewer requirements — NOT MET

An authorized reviewer **other than the implementer/operator** must independently inspect deployed code SHA, actual private Auth evidence, real Store A/B same-Tenant proof, privileged gateway ACLs, active session revocation, owner/media/provider consent and actual PostgreSQL nonce persistence. They must document actionable P0/P1 closures and digitally sign an attestation using an independently controlled key. Never put raw personal identifiers, JWTs, sessions, credentials or customer records into GitHub.

The current Ed25519 test key is ephemeral and **not proof that such a person signed anything**. This automated check is a repeatable engineering QA suite only.

## Existing P0 blockers retained

- Real Supabase Auth JWT signature/session validation not implemented.
- Real private signed issuer and signing-key lifecycle not deployed.
- `service_role`/BYPASSRLS live gateway not independently admitted.
- Supabase staging lacks canonical Store tables/Store RLS and same-Tenant Store A/B real mapping.
- No independent human security signoff or owner consent proof.

**Verdict:** real UAT BLOCKED, staging DDL NO-GO, provider sends NO-GO, Commerce writer NO-GO and production release NO-GO.

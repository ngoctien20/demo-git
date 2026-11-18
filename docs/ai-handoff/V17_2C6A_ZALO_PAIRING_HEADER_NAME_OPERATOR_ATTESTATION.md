# V17.2C.6A — Operator-visible Zalo Pairing Header Name Attestation

Date: 2026-11-18 JST
Parent: V17.2C.6, Draft PR #392, previous HEAD `22be79ad50f25a48d278bb60782e4faa78a7b4b2`.

## Evidence

The operator provided a visual screenshot of the **n8n Credential editor** for `TIEN404_QA_SHOP_B_ZALO_PAIRING`. The visible, non-secret fields are:

- Credential type: `Header Auth`.
- `Name`: **`x-tien404-pairing`** — exact name required by the deployed SQL RPC `public.qa_shop_b_zalo_claim`.
- `Value`: masked; no secret is visible or included in this evidence record.
- `Allowed HTTP Request Domains`: `Specific Domains`.
- Allowed domain: `ifxlvrhyjhbzbrkdsida.supabase.co`, consistent with the Supabase staging project.
- No UI save action, credential update or test POST was performed as part of the evidence review.

The independently verified active n8n published workflow `OgDZNSAvKEvhnAvn` binds this credential for the POST node `Submit pending claim for Shop B` (version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`).

## Decision / qualification

**VERIFIED — credential Header Name and allowed-domain UI configuration.** This closes the *header-name-attestation* gap in V17.2C.6. It does NOT prove that the masked Value equals the current Supabase Vault secret, that POST succeeds, that provider ingress is trusted, that replay is prevented, or that two QA actors gave independent consent.

The previous read-only SQL gate `NO_GO_STRUCTURAL` remains valid: no canonical stores or Store-level memberships/policies and no same-Tenant pair of independently mapped QA Store keys. **Do not change the RPC grant, edit the published workflow, create Auth users, deploy schema or send a Zalo message.**

Next: private, independent QA actor A/B consent and disposable same-Tenant Store admission; then no-send isolated request-gate QA and real JWT A/B read-only UAT with separately authorized test resources.

No secret, screenshot pixels, JWT, email, phone or credential value committed to GitHub.

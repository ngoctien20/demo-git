# TIEN404 Open Core boundary — PROPOSED

| Component | Initial plan |
| --- | --- |
| Website components and accessibility utilities | Community candidate, after security review |
| Synthetic offline QA, non-production fixtures, sample SDK contracts | Community candidate, after rights/security review |
| AI Sales Core, Commerce Core, billing and subscriptions | Private by default |
| n8n live workflows, Meta/Zalo installations, auth credentials | Private; no publication |
| RLS privileged SQL/RPC, recovery runbooks and operator evidence | Private review before any publication |
| Merchant catalog data, product images, customer messages and contact details | Private unless explicit legal permission |

## Release gates (all mandatory)

- G0: Review all currently public branches and Git history for sensitive data; follow up on GitHub Secret Scanning alerts.
- G1: If secret exposure is confirmed, rotate affected credentials and validate system access.
- G2: Enforce protected branches/rulesets, required checks and reviews before outsiders can contribute.
- G3: Approve an explicit public/private architecture and export only vetted code into a clean community repository.
- G4: Approve open-source license, contribution/IP terms, and security disclosure process.
- G5: Pass independent offline QA with synthetic data, then authorize public launch.

This document is not authorization to copy commercial code, merge changes or deploy to production.

# Agent Factory V1 — Next actions (ordered)

1. **Do not create duplicate resources.** Verify Supabase migration `tien404_factory_control_plane_v1`, n8n manual workflow `7hwH3kW6GtNwpgDk`, staging folder, Data Table and PR #20/#21 before new edits.
2. Implement a server-side staging bridge for n8n inbox → `factory_private.enqueue`: authenticated/signed requests, whitelisted task fields, nonce replay store and per-task idempotent mapping, scoped DB credential only in secret manager; do not expose Postgres privileged credentials to n8n workflow source or frontend.
3. Fix/verify reliability defects: reject event_id reuse with divergent payload/actor/target; independently verify GitHub CI/source SHA and checkpoint before DONE. Test CAS leases concurrently from two independent DB sessions.
4. **Owner approval gate:** choose AI provider/model/credential, price, per-task/day/month hard caps, initial budget allocation; no calls until approved. Draft Agents presently not runnable.
5. Connect only CTO, Developer, QA first. Give read-only GitHub/Linear tools to CTO/QA; Developer staging-branch Draft-PR scoped write only. Keep Security Reviewer as independent final gate.
6. Exercise one synthetic task across actual model execution, SHA change, QA fail/fix/pass, review and report, and one forced exceeded-budget/blocked case. No customer data.
7. Select human report destination and test one explicit delivery. Do not send unsolicited email or publish workflows.
8. Review existing unrelated Supabase Security Advisor warnings without modifying payment/merchant functionality in this factory PR.
9. Maintain PR #21 Draft, update these checkpoints after each real test or modification; never merge/deploy production without explicit approval.

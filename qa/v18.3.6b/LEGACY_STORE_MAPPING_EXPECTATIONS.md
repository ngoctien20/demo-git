# V18.3.6B — Legacy Store Mapping Evidence Contract

The full migration is a synthetic rehearsal, not a backfill plan for production.

| Synthetic table | Total rows | Store mapped | NULL legacy rows | Expected treatment |
|---|---:|---:|---:|---|
| products | 4 | 3 | 1 | QA-LEGACY remains unmapped |
| customers | 2 | 2 | 0 | Explicit synthetic A/B mappings |
| orders | 3 | 2 | 1 | Legacy order remains unmapped |
| order_items | 2 | 2 | 0 | Composite parent links same Store |
| conversations | 2 | 2 | 0 | Explicit synthetic A/B mappings |
| messages | 2 | 2 | 0 | Composite conversation link same Store |

Rules:
- Do not infer Store ownership from tenant ID, channel, product name, customer address, or current workflow routing.
- Do not map every legacy row to Store A or the first Store in a tenant.
- A row without independently approved ownership remains NULL/quarantined and invisible to Store-scoped actors.
- Composite tenant+store+record FKs must validate; an order item cannot link an order in A to a product in B even within one tenant.
- This table describes only disposable synthetic fixtures. It is not a real-data row count or migration instruction.

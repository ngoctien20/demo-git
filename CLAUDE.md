

## TIEN404 AI — MULTI-AI ORCHESTRATION (V1, local only)

- Continue from the newest verified checkpoint. Do not rebuild, duplicate changes, or overwrite existing `CLAUDE.md` instructions.
- Claude owns planning, minimal code changes, reviews, local testing, and reporting. GPT Worker is a *read-only advisor*, not a privileged agent.
- Delegate only bounded, independent tasks (security review of selected source, QA case review, bug hypothesis, documentation validation). Do not delegate credentials, private production data, admin privileges, authentication tokens, or direct live integrations.
- Start with the smallest context. Never scan the whole repo or send a complete customer dataset unless explicitly authorized and safeguarded.
- To call GPT Worker, use skill `gpt-worker` and `py -3 tools/gpt_worker.py --task "..." --file "relative/path"` from the repo root. Maximum one worker call per task unless owner approves another.
- GPT Worker must stay in `read-only` and only receive explicitly scoped copies. Never route it to production n8n/Supabase/Cloudflare/GitHub writes.
- Stop if a command fails; no blind retries or recursive delegation.
- Any production publish, tenant data change, payment change, sensitive permission change, token/credential update, deployment, or monetary expense needs explicit owner approval first.
- Return concise Vietnamese status: VERIFIED | IMPLEMENTED | TESTED | PROPOSED | BLOCKED, modified paths, QA evidence, risks, approval, checkpoint, next step.
- Do not claim success merely from GPT Worker output. Independent QA needed.

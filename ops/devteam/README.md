# TIEN404 DEV TEAM: deterministic staging contract

This folder is an **offline reference**, not a deployed autonomous orchestrator.
No network calls or LLM requests. All releases remain draft.

Run: python -m unittest discover -s ops/devteam/tests -v

Real automation needs durable queue, atomic compare-and-swap, per-task writer lock, event deduplication, verified GitHub/Linear scopes, cost gate and approval. See docs/DEV_TEAM_MULTIAGENT_V1.md and Linear NGO-15.

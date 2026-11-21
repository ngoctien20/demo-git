---
name: gpt-worker
description: Delegate a bounded, independent read-only code review or QA analysis to Codex CLI with explicit file allowlisting; useful for a second opinion and token savings.
---

# GPT Worker — TIEN404 AI

Only use this skill when an independent second opinion has clear value. NEVER launch for every task by default.

Prerequisite: user has signed in to Codex CLI with ChatGPT (not an API key unless explicitly approved).

1. State the exact small task; identify at most 8 safe text/code files (max 24 KiB/file, 80 KiB total).
2. Do not include private keys, secrets, `.env`, customer information, credential/config dumps, or production data.
3. On Windows PowerShell, invoke from repo root, e.g.:

   `py -3 tools/gpt_worker.py --task "Review inventory validation for cross-store access; do not change code" --file src/inventory.ts`

   If `py` is unavailable, use `python`.

4. The script isolates copies, runs `codex exec` with read-only sandbox, saves the report outside the repo, and returns a concise result.
5. Claude verifies every finding against the actual checked-out code and tests before implementing anything. No production or sensitive changes without owner approval.
6. Limit to one worker call per task. If a retry is needed, ask permission and explain why.
7. Do NOT run `codex exec` with danger/full-access or auto-approval. Do not bypass sandboxing or safety checks.
8. Mark all findings PROPOSED until independently verified. Reports are never test evidence by themselves.
9. If the relevant file is too large or contains sensitive information, manually create a sanitized excerpt only with the owner's permission, and list precisely what was excluded.

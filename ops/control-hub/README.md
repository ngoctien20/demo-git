# TIEN404 Control Hub v2 — Audit package

**Not the Control Hub website code.** Read-only audit tools + checkpoints, intended for review and integration into the *existing* Sites Control Hub when authorized workspace is available.

Run locally (offline unit test):

```bash
python -m unittest discover -s ops/control-hub/tests -v
```

Live endpoint probe (requires outbound HTTPS, outputs only public metadata):

```bash
python ops/control-hub/tools/probe_public.py
```

A new GitHub Actions workflow can run the probe on the staging branch and, after approval, daily on `main`. No n8n API key is bundled. No backend/Control Hub source is modified.

The `PRIVATE_AUDIT_DETAILS.md` file is **excluded from the GitHub PR** and intended only for a trusted owner.
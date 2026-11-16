#!/usr/bin/env python3
"""TIEN404 ADV5 reproducible offline single-file UAT artifact (no external I/O)."""
from __future__ import annotations
from base64 import b64encode
from hashlib import sha256
from pathlib import Path
import argparse
import json
import re

SCRIPTS = (
    "studio-core.js",
    "advanced-presentation-policy.js",
    "advanced-channel-registry.js",
    "advanced-ai-presentation-evaluator.js",
    "advanced-studio-capability-crosswalk.js",
    "advanced-custom-studio.js",
    "advanced-merchant-uat.js",
    "advanced-merchant-uat-view.js",
)

def build(out: Path) -> dict:
    root = Path(__file__).parent
    template = (root / "advanced-custom-studio.html").read_text(encoding="utf-8")
    actual = tuple(re.findall(r'<script src="\./([^"]+)" defer></script>', template))
    if actual != SCRIPTS:
        raise RuntimeError(f"STANDALONE_SOURCE_DRIFT: {actual!r}")
    code = "\n;\n".join((root / p).read_text(encoding="utf-8") for p in SCRIPTS) + "\n"
    if "</script" in code.lower():
        raise RuntimeError("UNEXPECTED_HTML_SCRIPT_ESCAPE")
    digest = sha256(code.encode("utf-8")).digest()
    hash_b64 = b64encode(digest).decode("ascii")
    if "script-src 'self'" not in template:
        raise RuntimeError("EXPECTED_LOCAL_CSP_MISSING")
    page = template.replace("script-src 'self'", f"script-src 'sha256-{hash_b64}'")
    page = re.sub(r'<script src="\./([^"]+)" defer></script>', "", page)
    if page.count("</body>") != 1 or "<script " in page:
        raise RuntimeError("STANDALONE_TEMPLATE_UNEXPECTED")
    page = page.replace("</body>", f"<script>{code}</script>\n</body>")
    if page.count("<script>") != 1 or page.count("</script>") != 1:
        raise RuntimeError("UNSAFE_INLINE_SCRIPT_COUNT")
    for required in (
        "connect-src 'none'", "img-src 'none'", "form-action 'none'",
        "default-src 'none'", "frame-src 'none'", "noindex,nofollow",
        "id=\"uatRows\"", "id=\"capabilityRows\"",
    ):
        if required not in page:
            raise RuntimeError(f"SECURITY_ASSERTION_FAILED: {required}")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    meta = {
        "contract": "T404_ADV5_SINGLE_FILE_UAT_NO_SEND",
        "mode": "PUBLIC_SYNTHETIC_ONLY",
        "file": out.name, "source_files": list(SCRIPTS),
        "source_sha256": sha256(template.encode("utf-8")).hexdigest(),
        "inline_script_sha256": sha256(code.encode("utf-8")).hexdigest(),
        "inline_script_csp_hash": hash_b64,
        "html_sha256": sha256(page.encode("utf-8")).hexdigest(),
        "merchantIdentityVerified": False, "releaseAuthorized": False,
        "providerSends": 0, "hostedWrites": 0, "paidModelCalls": 0,
    }
    (out.parent / (out.stem + "_MANIFEST.json")).write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return meta

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="qa-artifacts-v152-adv5-package/TIEN404_ADV5_Merchant_UAT_Offline.html")
    args = parser.parse_args()
    result = build(Path(args.out))
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))

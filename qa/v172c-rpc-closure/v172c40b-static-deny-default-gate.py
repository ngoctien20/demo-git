#!/usr/bin/env python3
"""V17.2C.40B immutable registry source admission (NO LIVE AUTH)."""
import json
from pathlib import Path

path = Path("qa/v172c-rpc-closure/v172c40b-owner-authority-registry-NOT_APPROVED.json")
candidate = json.loads(path.read_text(encoding="utf-8"))
def require(condition, msg):
    if not condition:
        raise SystemExit("FAIL_CLOSED_V17_2C40B: " + msg)

require(candidate.get("contract") == "TIEN404_V17_2C40B_OWNER_AUTHORITY_REGISTRY_CANDIDATE", "unexpected contract")
require(candidate.get("status") == "NOT_APPROVED", "owner approval cannot be inferred")
require(candidate.get("scope") == "DESIGN_ONLY_NO_WRITE", "must remain no-write")
require(candidate.get("authority_effect") == "NONE", "must not grant authority")
require(candidate.get("immutable_checkpoint") is True, "checkpoint cannot silently become live mapping")
release = candidate.get("release_gate")
require(isinstance(release, dict) and len(release) >= 6, "missing release gates")
require(all(v is False for v in release.values()), "any live release gate unexpectedly enabled")
for field in (
    "protected_mapping_records", "owner_store_grant_records",
    "channel_installation_records", "alias_crosswalk_records",
    "approval_evidence_refs",
):
    require(candidate.get(field) == [], field + " must be empty in this source-only checkpoint")
require(len(candidate.get("required_private_evidence", [])) >= 8, "missing proof requirements")
require(len(candidate.get("forbidden_promotion_sources", [])) >= 6, "missing QA promotion guards")
require(len(candidate.get("explicitly_unresolved", [])) >= 5, "missing unresolved conflicts")
print("V17.2C.40B_STATIC_REGISTRY_DENY_BY_DEFAULT_PASS")
print("NOT_APPROVED | NO_AUTHORITY_GRANTED | NO_DB_WRITE | NO_PROVIDER_SEND | NO_REAL_AB_JWT_TEST")

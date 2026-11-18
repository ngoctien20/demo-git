"""V17.2C.40E S3 decision lock and no-authority transition guard.

Pure source contract only. No cryptography, identity/session verification,
database access, permission grant, migration, or provider operation occurs.
A valid synthetic transition can only request private review; it cannot admit
real authority or mutate the prior S3 decision record.
"""
from __future__ import annotations

from typing import Any

from v172c40d_owner_decision_crosswalk_contract import (
    _has_sensitive_key,
    _synthetic,
    _time,
)

DECISION_GATES = frozenset({
    "store_membership_granted",
    "real_auth_uat_admitted",
    "real_ab_uat_admitted",
    "canonical_alias_resolution_admitted",
    "order_read_admitted",
    "order_write_admitted",
    "migration_admitted",
    "provider_dispatch_admitted",
    "production_release_admitted",
})
CROSSWALK_GATES = frozenset({
    "tenant_resolution",
    "store_resolution",
    "channel_installation_resolution",
    "customer_identity_binding",
    "order_ownership_binding",
    "order_read",
    "order_write",
    "migration",
    "provider_dispatch",
    "production_release",
})


def _result(state: str, reasons: set[str] | None = None) -> dict[str, Any]:
    return {
        "preflight": state if not reasons else "BLOCKED",
        "authority_granted": False,
        "store_membership_granted": False,
        "real_auth_uat_admitted": False,
        "real_ab_uat_admitted": False,
        "canonical_alias_resolution_admitted": False,
        "order_read_admitted": False,
        "order_write_admitted": False,
        "migration_admitted": False,
        "provider_dispatch_admitted": False,
        "production_release_admitted": False,
        "reasons": sorted(reasons or set()),
    }


def validate_s3_lock(decision: Any, crosswalk: Any) -> dict[str, Any]:
    """Validate the selected S3 lock and its empty, non-authorizing crosswalk."""
    reasons: set[str] = set()
    if not isinstance(decision, dict) or not isinstance(crosswalk, dict):
        return _result("BLOCKED", {"INVALID_S3_LOCK_INPUT"})
    if _has_sensitive_key(decision) or _has_sensitive_key(crosswalk):
        reasons.add("FORBIDDEN_PRIVATE_DATA_FIELD")

    expected_decision = {
        "contract": "TIEN404_V17_2C40E_S3_LOCK",
        "status": "OWNER_DECISION_LOCKED",
        "record_type": "POLICY_SELECTION_ONLY",
        "scope": "SYNTHETIC_ONLY",
        "authority_effect": "NONE",
        "real_authority_requested": False,
        "decision": "S3",
        "decision_source": "EXPLICIT_PROJECT_OPERATOR_SELECTION",
        "lock_state": "LOCKED",
        "lock_reason": "OWNER_RELATIONSHIP_NOT_YET_ESTABLISHED",
    }
    for key, expected in expected_decision.items():
        if decision.get(key) != expected:
            reasons.add("S3_DECISION_LOCK_FIELD_MISMATCH:" + key)
    if not _synthetic(decision.get("decision_ref"), "synthetic-decision-s3-"):
        reasons.add("INVALID_S3_DECISION_REF")
    if decision.get("decision_version") != 1:
        reasons.add("INVALID_INITIAL_S3_DECISION_VERSION")
    if decision.get("previous_decision_ref") is not None:
        reasons.add("S3_INITIAL_RECORD_MUST_NOT_HAVE_PREDECESSOR")
    if not isinstance(decision.get("decision_date"), str) or len(decision["decision_date"]) != 10:
        reasons.add("INVALID_S3_DECISION_DATE")
    if decision.get("store_refs") != []:
        reasons.add("S3_STORE_REFS_MUST_BE_EMPTY")
    if decision.get("owner_consents") != []:
        reasons.add("S3_OWNER_CONSENTS_MUST_BE_EMPTY")
    if decision.get("alias_mappings") != []:
        reasons.add("S3_ALIAS_MAPPINGS_MUST_BE_EMPTY")
    if decision.get("owner_authority_verified") is not False:
        reasons.add("S3_OWNER_AUTHORITY_MUST_REMAIN_UNVERIFIED")
    if decision.get("identity_verified") is not False:
        reasons.add("S3_IDENTITY_MUST_REMAIN_UNVERIFIED")

    transition = decision.get("transition_policy")
    required_transition = {
        "mode": "NEW_DECISION_VERSION_ONLY",
        "preserve_this_record": True,
        "in_place_edit_allowed": False,
        "requires_private_owner_authentication": True,
        "requires_fresh_challenge_and_nonce_consumption": True,
        "requires_per_store_signed_owner_consent": True,
        "requires_current_membership_and_revocation_check": True,
        "requires_independent_security_reviewer": True,
        "requires_separate_release_approval": True,
    }
    if not isinstance(transition, dict):
        reasons.add("MISSING_S3_TRANSITION_POLICY")
    else:
        for key, expected in required_transition.items():
            actual = transition.get(key)
            # Compare JSON scalar values, while preserving strict JSON types
            # so numeric 1 cannot masquerade as boolean true.
            if type(actual) is not type(expected) or actual != expected:
                reasons.add("S3_TRANSITION_POLICY_MISMATCH:" + key)

    decision_gates = decision.get("release_gates")
    if not isinstance(decision_gates, dict) or not DECISION_GATES.issubset(decision_gates):
        reasons.add("S3_DECISION_RELEASE_GATES_INCOMPLETE")
    elif any(decision_gates.get(key) is not False for key in DECISION_GATES):
        reasons.add("S3_DECISION_RELEASE_GATE_MUST_DENY")

    expected_crosswalk = {
        "contract": "TIEN404_V17_2C40E_S3_CROSSWALK_LOCK",
        "status": "CROSSWALK_LOCKED_NO_MAPPINGS",
        "scope": "SYNTHETIC_ONLY",
        "authority_effect": "NONE",
        "real_authority_requested": False,
        "owner_decision": "S3",
        "owner_decision_ref": decision.get("decision_ref"),
    }
    for key, expected in expected_crosswalk.items():
        if crosswalk.get(key) != expected:
            reasons.add("S3_CROSSWALK_LOCK_FIELD_MISMATCH:" + key)
    if crosswalk.get("mappings") != []:
        reasons.add("S3_CROSSWALK_MAPPINGS_MUST_BE_EMPTY")
    crosswalk_gates = crosswalk.get("release_gates")
    if not isinstance(crosswalk_gates, dict) or not CROSSWALK_GATES.issubset(crosswalk_gates):
        reasons.add("S3_CROSSWALK_RELEASE_GATES_INCOMPLETE")
    elif any(crosswalk_gates.get(key) is not False for key in CROSSWALK_GATES):
        reasons.add("S3_CROSSWALK_RELEASE_GATE_MUST_DENY")

    if reasons:
        return _result("BLOCKED", reasons)
    return _result("S3_LOCKED_DENY")


def inspect_s3_transition_attempt(current: Any, proposed: Any) -> dict[str, Any]:
    """Require a new private-authority decision version; never unlock in place."""
    current_result = validate_s3_lock(current, _crosswalk_from_lock(current))
    if current_result["preflight"] != "S3_LOCKED_DENY":
        return _result("BLOCKED", {"CURRENT_S3_LOCK_NOT_VALID"})
    reasons: set[str] = set()
    if not isinstance(proposed, dict):
        return _result("BLOCKED", {"INVALID_TRANSITION_PROPOSAL"})
    if _has_sensitive_key(proposed):
        reasons.add("FORBIDDEN_PRIVATE_DATA_FIELD")
    current_ref = current.get("decision_ref")
    if proposed.get("decision_ref") == current_ref:
        reasons.add("IN_PLACE_S3_DECISION_MUTATION_PROHIBITED")
    if proposed.get("previous_decision_ref") != current_ref:
        reasons.add("TRANSITION_MUST_REFERENCE_PRIOR_S3_RECORD")
    if proposed.get("decision_version") != current.get("decision_version", 0) + 1:
        reasons.add("TRANSITION_MUST_INCREMENT_DECISION_VERSION")
    if proposed.get("transition_mode") != "NEW_IMMUTABLE_DECISION_RECORD":
        reasons.add("TRANSITION_MUST_CREATE_NEW_RECORD")
    if proposed.get("decision") not in ("S1", "S2"):
        reasons.add("TRANSITION_DECISION_MUST_BE_EXPLICIT_S1_OR_S2")
    if proposed.get("scope") != "SYNTHETIC_ONLY" or proposed.get("authority_effect") != "NONE":
        reasons.add("TRANSITION_MUST_REMAIN_NON_AUTHORIZING")
    if proposed.get("real_authority_requested") is not False:
        reasons.add("REAL_AUTHORITY_PROHIBITED")
    if not _synthetic(proposed.get("decision_ref"), "synthetic-decision-"):
        reasons.add("INVALID_NEW_DECISION_REF")
    if not _synthetic(proposed.get("private_owner_flow_ref"), "synthetic-private-owner-flow-"):
        reasons.add("PRIVATE_OWNER_AUTHORITY_FLOW_NOT_PROVEN")
    if not _synthetic(proposed.get("independent_reviewer_ref"), "synthetic-reviewer-"):
        reasons.add("INDEPENDENT_REVIEWER_NOT_PROVEN")
    approvals = proposed.get("per_store_approval_refs")
    if not isinstance(approvals, list) or len(approvals) < 2:
        reasons.add("PER_STORE_OWNER_APPROVAL_EVIDENCE_INCOMPLETE")
        approvals = []
    if any(not _synthetic(ref, "synthetic-owner-approval-") for ref in approvals):
        reasons.add("INVALID_SYNTHETIC_OWNER_APPROVAL_REF")
    if len(approvals) != len(set(ref for ref in approvals if isinstance(ref, str))):
        reasons.add("DUPLICATE_OWNER_APPROVAL_REF")
    required_true = (
        "private_service_verified_current_sessions",
        "fresh_challenges_consumed",
        "signed_per_store_owner_consents_verified",
        "current_memberships_verified",
        "revocation_and_expiry_checked",
        "independent_security_review_complete",
    )
    if not all(proposed.get(key) is True for key in required_true):
        reasons.add("PRIVATE_OWNER_TRANSITION_EVIDENCE_INCOMPLETE")
    evaluated = _time(proposed.get("evaluated_at"))
    valid_from = _time(proposed.get("valid_from"))
    expires = _time(proposed.get("expires_at"))
    if evaluated is None or valid_from is None or expires is None or not (valid_from <= evaluated < expires):
        reasons.add("TRANSITION_EVIDENCE_NOT_CURRENT")
    if reasons:
        return _result("BLOCKED", reasons)
    # All inputs remain synthetic. A private service and independent release
    # approval must still verify real evidence; this source test never admits.
    return _result("PRIVATE_AUTHORITY_REVIEW_REQUIRED")
    

def _crosswalk_from_lock(decision: Any) -> dict[str, Any]:
    """Build a minimal expected crosswalk only for validating the current lock."""
    if not isinstance(decision, dict):
        return {}
    return {
        "contract": "TIEN404_V17_2C40E_S3_CROSSWALK_LOCK",
        "status": "CROSSWALK_LOCKED_NO_MAPPINGS",
        "scope": "SYNTHETIC_ONLY",
        "authority_effect": "NONE",
        "real_authority_requested": False,
        "owner_decision": "S3",
        "owner_decision_ref": decision.get("decision_ref"),
        "mappings": [],
        "release_gates": {key: False for key in CROSSWALK_GATES},
    }

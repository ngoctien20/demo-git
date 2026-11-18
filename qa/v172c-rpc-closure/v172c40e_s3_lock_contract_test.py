"""V17.2C.40E S3 lock and transition guard tests; synthetic only."""
import copy
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from v172c40e_s3_lock_contract import (
    inspect_s3_transition_attempt,
    validate_s3_lock,
)


def load_records():
    decision = json.loads((HERE / "v172c40e-s3-owner-decision-LOCKED-NO-AUTHORITY.json").read_text())
    crosswalk = json.loads((HERE / "v172c40e-s3-crosswalk-LOCKED-NO-MAPPINGS.json").read_text())
    return decision, crosswalk


def transition_fixture(current):
    return {
        "decision_ref": "synthetic-decision-s1-v2",
        "previous_decision_ref": current["decision_ref"],
        "decision_version": current["decision_version"] + 1,
        "transition_mode": "NEW_IMMUTABLE_DECISION_RECORD",
        "decision": "S1",
        "scope": "SYNTHETIC_ONLY",
        "authority_effect": "NONE",
        "real_authority_requested": False,
        "private_owner_flow_ref": "synthetic-private-owner-flow-1",
        "independent_reviewer_ref": "synthetic-reviewer-independent",
        "per_store_approval_refs": [
            "synthetic-owner-approval-A",
            "synthetic-owner-approval-B",
        ],
        "private_service_verified_current_sessions": True,
        "fresh_challenges_consumed": True,
        "signed_per_store_owner_consents_verified": True,
        "current_memberships_verified": True,
        "revocation_and_expiry_checked": True,
        "independent_security_review_complete": True,
        "evaluated_at": "2026-11-18T00:00:00Z",
        "valid_from": "2026-11-17T00:00:00Z",
        "expires_at": "2026-11-19T00:00:00Z",
    }


class S3LockTests(unittest.TestCase):
    def setUp(self):
        self.decision, self.crosswalk = load_records()

    def assert_no_authority(self, result):
        self.assertFalse(result["authority_granted"])
        self.assertFalse(result["store_membership_granted"])
        self.assertFalse(result["real_auth_uat_admitted"])
        self.assertFalse(result["real_ab_uat_admitted"])
        self.assertFalse(result["canonical_alias_resolution_admitted"])
        self.assertFalse(result["order_read_admitted"])
        self.assertFalse(result["order_write_admitted"])
        self.assertFalse(result["migration_admitted"])
        self.assertFalse(result["provider_dispatch_admitted"])
        self.assertFalse(result["production_release_admitted"])

    def assert_blocked(self, decision=None, crosswalk=None, reason=None):
        result = validate_s3_lock(
            self.decision if decision is None else decision,
            self.crosswalk if crosswalk is None else crosswalk,
        )
        self.assertEqual(result["preflight"], "BLOCKED")
        if reason:
            self.assertIn(reason, result["reasons"])
        self.assert_no_authority(result)

    def test_selected_s3_is_locked_deny(self):
        result = validate_s3_lock(self.decision, self.crosswalk)
        self.assertEqual(result["preflight"], "S3_LOCKED_DENY")
        self.assertEqual(result["reasons"], [])
        self.assert_no_authority(result)

    def test_s3_is_explicit_project_selection_not_owner_proof(self):
        self.assertEqual(self.decision["decision_source"], "EXPLICIT_PROJECT_OPERATOR_SELECTION")
        self.assertFalse(self.decision["owner_authority_verified"])
        self.assertFalse(self.decision["identity_verified"])
        self.assertEqual(self.decision["record_type"], "POLICY_SELECTION_ONLY")

    def test_s3_has_no_store_refs(self):
        f = copy.deepcopy(self.decision); f["store_refs"] = ["synthetic-store-A"]
        self.assert_blocked(decision=f, reason="S3_STORE_REFS_MUST_BE_EMPTY")

    def test_s3_has_no_owner_consents(self):
        f = copy.deepcopy(self.decision); f["owner_consents"] = [{"owner_ref": "synthetic-owner-A"}]
        self.assert_blocked(decision=f, reason="S3_OWNER_CONSENTS_MUST_BE_EMPTY")

    def test_s3_has_no_alias_mappings(self):
        f = copy.deepcopy(self.decision); f["alias_mappings"] = [{"alias_ref": "fixture-alias-x"}]
        self.assert_blocked(decision=f, reason="S3_ALIAS_MAPPINGS_MUST_BE_EMPTY")

    def test_s3_cannot_be_relabelled_s2(self):
        f = copy.deepcopy(self.decision); f["decision"] = "S2"
        self.assert_blocked(decision=f, reason="S3_DECISION_LOCK_FIELD_MISMATCH:decision")

    def test_s3_lock_state_cannot_be_unlocked(self):
        f = copy.deepcopy(self.decision); f["lock_state"] = "UNLOCKED"
        self.assert_blocked(decision=f, reason="S3_DECISION_LOCK_FIELD_MISMATCH:lock_state")

    def test_every_decision_release_gate_must_deny(self):
        f = copy.deepcopy(self.decision); f["release_gates"]["order_read_admitted"] = True
        self.assert_blocked(decision=f, reason="S3_DECISION_RELEASE_GATE_MUST_DENY")

    def test_crosswalk_must_have_zero_mappings(self):
        f = copy.deepcopy(self.crosswalk); f["mappings"] = [{"alias_ref": "fixture-alias-A"}]
        self.assert_blocked(crosswalk=f, reason="S3_CROSSWALK_MAPPINGS_MUST_BE_EMPTY")

    def test_crosswalk_gate_must_deny(self):
        f = copy.deepcopy(self.crosswalk); f["release_gates"]["store_resolution"] = True
        self.assert_blocked(crosswalk=f, reason="S3_CROSSWALK_RELEASE_GATE_MUST_DENY")

    def test_crosswalk_must_reference_locked_decision(self):
        f = copy.deepcopy(self.crosswalk); f["owner_decision_ref"] = "synthetic-decision-other"
        self.assert_blocked(crosswalk=f, reason="S3_CROSSWALK_LOCK_FIELD_MISMATCH:owner_decision_ref")

    def test_secret_fields_are_rejected(self):
        f = copy.deepcopy(self.crosswalk); f["providerToken"] = "never-store"
        self.assert_blocked(crosswalk=f, reason="FORBIDDEN_PRIVATE_DATA_FIELD")

    def test_transition_cannot_mutate_s3_in_place(self):
        proposal = transition_fixture(self.decision)
        proposal["decision_ref"] = self.decision["decision_ref"]
        result = inspect_s3_transition_attempt(self.decision, proposal)
        self.assertEqual(result["preflight"], "BLOCKED")
        self.assertIn("IN_PLACE_S3_DECISION_MUTATION_PROHIBITED", result["reasons"])
        self.assert_no_authority(result)

    def test_transition_must_reference_prior_s3_record(self):
        proposal = transition_fixture(self.decision); proposal["previous_decision_ref"] = "synthetic-decision-other"
        result = inspect_s3_transition_attempt(self.decision, proposal)
        self.assertEqual(result["preflight"], "BLOCKED")
        self.assertIn("TRANSITION_MUST_REFERENCE_PRIOR_S3_RECORD", result["reasons"])

    def test_transition_requires_new_version(self):
        proposal = transition_fixture(self.decision); proposal["decision_version"] = 1
        result = inspect_s3_transition_attempt(self.decision, proposal)
        self.assertEqual(result["preflight"], "BLOCKED")
        self.assertIn("TRANSITION_MUST_INCREMENT_DECISION_VERSION", result["reasons"])

    def test_transition_requires_private_owner_flow(self):
        proposal = transition_fixture(self.decision); proposal["private_owner_flow_ref"] = None
        result = inspect_s3_transition_attempt(self.decision, proposal)
        self.assertEqual(result["preflight"], "BLOCKED")
        self.assertIn("PRIVATE_OWNER_AUTHORITY_FLOW_NOT_PROVEN", result["reasons"])

    def test_transition_requires_signed_per_store_approvals(self):
        proposal = transition_fixture(self.decision); proposal["per_store_approval_refs"] = []
        result = inspect_s3_transition_attempt(self.decision, proposal)
        self.assertEqual(result["preflight"], "BLOCKED")
        self.assertIn("PER_STORE_OWNER_APPROVAL_EVIDENCE_INCOMPLETE", result["reasons"])

    def test_transition_requires_current_and_revocation_checks(self):
        proposal = transition_fixture(self.decision); proposal["revocation_and_expiry_checked"] = False
        result = inspect_s3_transition_attempt(self.decision, proposal)
        self.assertEqual(result["preflight"], "BLOCKED")
        self.assertIn("PRIVATE_OWNER_TRANSITION_EVIDENCE_INCOMPLETE", result["reasons"])

    def test_expired_transition_is_denied(self):
        proposal = transition_fixture(self.decision); proposal["expires_at"] = "2026-11-17T12:00:00Z"
        result = inspect_s3_transition_attempt(self.decision, proposal)
        self.assertEqual(result["preflight"], "BLOCKED")
        self.assertIn("TRANSITION_EVIDENCE_NOT_CURRENT", result["reasons"])

    def test_synthetic_transition_never_grants_authority(self):
        proposal = transition_fixture(self.decision)
        result = inspect_s3_transition_attempt(self.decision, proposal)
        self.assertEqual(result["preflight"], "PRIVATE_AUTHORITY_REVIEW_REQUIRED")
        self.assert_no_authority(result)

    def test_invalid_current_lock_blocks_every_transition(self):
        current = copy.deepcopy(self.decision); current["lock_state"] = "UNLOCKED"
        result = inspect_s3_transition_attempt(current, transition_fixture(self.decision))
        self.assertEqual(result["preflight"], "BLOCKED")
        self.assertIn("CURRENT_S3_LOCK_NOT_VALID", result["reasons"])
        self.assert_no_authority(result)

    def test_policy_selection_date_and_version_are_explicit(self):
        self.assertEqual(self.decision["decision_date"], "2026-11-18")
        self.assertEqual(self.decision["decision_version"], 1)
        self.assertIsNone(self.decision["previous_decision_ref"])
        self.assertFalse(self.decision["transition_policy"]["in_place_edit_allowed"])


if __name__ == "__main__":
    unittest.main(verbosity=2)

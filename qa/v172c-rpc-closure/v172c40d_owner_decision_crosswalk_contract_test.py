"""V17.2C.40D synthetic-only contract tests. No identity or DB access."""
import copy
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from v172c40d_owner_decision_crosswalk_contract import (
    inspect_alias_crosswalk, inspect_owner_decision,
)


def consent(owner, store, decision="synthetic-decision-1", reviewer=None):
    reviewer = reviewer or "synthetic-reviewer-independent"
    return {
        "owner_ref": owner,
        "tenant_ref": "synthetic-tenant-1",
        "store_ref": store,
        "decision_ref": decision,
        "role": "owner",
        "scope": "STORE_BOUNDARY_DECISION",
        "source": "SYNTHETIC_ONLY",
        "explicit_owner_consent": True,
        "auth_session_verified_by_server": True,
        "auth_session_ref": "synthetic-session-" + owner.rsplit("-", 1)[-1],
        "challenge_ref": "synthetic-challenge-" + owner.rsplit("-", 1)[-1],
        "challenge_confirmed": True,
        "challenge_consumed": True,
        "nonce_consumed": True,
        "membership_snapshot_ref": "synthetic-membership-" + owner.rsplit("-", 1)[-1],
        "independent_reviewer_verified": True,
        "reviewer_ref": reviewer,
        "signature_ref": "synthetic-signature-" + owner.rsplit("-", 1)[-1],
        "signature_profile_ref": "synthetic-signature-profile-v1",
        "signed_payload_sha256": "sha256:" + "a" * 64,
        "signature_verified_by_trusted_server": True,
        "issued_at": "2026-11-17T00:00:00Z",
        "expires_at": "2026-11-19T00:00:00Z",
        "revoked_at": None,
    }


def owner_fixture(scenario="S2"):
    stores = ["synthetic-store-A", "synthetic-store-B"] if scenario == "S2" else (
        ["synthetic-store-A"] if scenario == "S1" else []
    )
    approvals = (
        [consent("synthetic-owner-A", "synthetic-store-A"),
         consent("synthetic-owner-B", "synthetic-store-B")]
        if scenario == "S2" else
        [consent("synthetic-owner-A", "synthetic-store-A"),
         consent("synthetic-owner-B", "synthetic-store-A")]
        if scenario == "S1" else []
    )
    return {
        "contract": "TIEN404_V17_2C40D_OWNER_DECISION",
        "status": "OWNER_DECISION_DRAFT",
        "scope": "SYNTHETIC_ONLY",
        "authority_effect": "NONE",
        "real_authority_requested": False,
        "decision_ref": "synthetic-decision-1",
        "tenant_ref": "synthetic-tenant-1",
        "decision": scenario,
        "evaluated_at": "2026-11-18T00:00:00Z",
        "store_refs": stores,
        "owner_consents": approvals,
    }


def alias_row(kind, alias, store=None, installation=None, source="SYNTHETIC_N8N_COMMERCE_CHANNELS", namespace="synthetic:n8n-channels", mapping="synthetic-mapping-1"):
    row = {
        "mapping_ref": mapping,
        "source_system": source,
        "namespace": namespace,
        "alias_kind": kind,
        "alias_ref": alias,
        "source_revision_ref": "synthetic-source-revision-1",
        "tenant_ref": "synthetic-tenant-1",
        "store_ref": store,
        "installation_ref": installation,
        "owner_decision_ref": "synthetic-decision-1",
        "evidence_ref": "synthetic-evidence-1",
        "signature_ref": "synthetic-signature-1",
        "signature_profile_ref": "synthetic-signature-profile-v1",
        "signed_payload_sha256": "sha256:" + "b" * 64,
        "reviewer_ref": "synthetic-reviewer-independent",
        "source_provenance_verified_by_server": True,
        "signature_verified_by_trusted_server": True,
        "independent_reviewer_verified": True,
        "source_status": "ACTIVE",
        "valid_from": "2026-11-17T00:00:00Z",
        "expires_at": "2026-11-19T00:00:00Z",
        "revoked_at": None,
    }
    if kind == "installation":
        row["provider_proof_ref"] = "synthetic-provider-proof-1"
    return row


def crosswalk_fixture():
    return {
        "contract": "TIEN404_V17_2C40D_ALIAS_CROSSWALK",
        "status": "CROSSWALK_DRAFT",
        "scope": "SYNTHETIC_ONLY",
        "authority_effect": "NONE",
        "real_authority_requested": False,
        "owner_decision": "S2",
        "owner_decision_ref": "synthetic-decision-1",
        "tenant_ref": "synthetic-tenant-1",
        "evaluated_at": "2026-11-18T00:00:00Z",
        "mappings": [
            alias_row("tenant", "fixture-alias-tenant", None,
                      source="SYNTHETIC_N8N_COMMERCE_TENANTS",
                      namespace="synthetic:n8n-tenants",
                      mapping="synthetic-mapping-tenant"),
            alias_row("store", "fixture-alias-store-A", "synthetic-store-A",
                      mapping="synthetic-mapping-store-A"),
            alias_row("installation", "fixture-alias-install-A", "synthetic-store-A",
                      "synthetic-installation-A",
                      mapping="synthetic-mapping-install-A"),
        ],
    }


class OwnerDecisionContractTests(unittest.TestCase):
    def assert_blocked(self, fixture, reason):
        result = inspect_owner_decision(fixture)
        self.assertEqual(result["preflight"], "BLOCKED")
        self.assertIn(reason, result["reasons"])
        self.assertFalse(result["authority_granted"])
        self.assertFalse(result["store_membership_granted"])
        self.assertFalse(result["real_auth_uat_admitted"])
        self.assertFalse(result["real_ab_uat_admitted"])
        self.assertFalse(result["migration_admitted"])
        self.assertFalse(result["production_send_admitted"])

    def test_s1_two_cowners_one_store_review_only(self):
        result = inspect_owner_decision(owner_fixture("S1"))
        self.assertEqual(result["preflight"], "SYNTHETIC_REVIEW_ELIGIBLE_ONLY")
        self.assertFalse(result["real_ab_uat_admitted"])
        self.assertFalse(result["store_membership_granted"])

    def test_s2_two_stores_two_owners_review_only(self):
        result = inspect_owner_decision(owner_fixture("S2"))
        self.assertEqual(result["preflight"], "SYNTHETIC_REVIEW_ELIGIBLE_ONLY")
        self.assertFalse(result["authority_granted"])
        self.assertFalse(result["real_ab_uat_admitted"])

    def test_s3_unresolved_is_always_blocked(self):
        self.assert_blocked(owner_fixture("S3"), "OWNER_DECISION_UNRESOLVED")

    def test_s3_cannot_carry_store_consents(self):
        f = owner_fixture("S3")
        f["store_refs"] = ["synthetic-store-A"]
        f["owner_consents"] = [consent("synthetic-owner-A", "synthetic-store-A")]
        self.assert_blocked(f, "S3_MUST_NOT_CARRY_STORE_GRANTS")

    def test_s1_requires_exactly_one_store(self):
        f = owner_fixture("S1")
        f["store_refs"].append("synthetic-store-B")
        self.assert_blocked(f, "S1_REQUIRES_EXACTLY_ONE_STORE")

    def test_s1_requires_two_distinct_cowners(self):
        f = owner_fixture("S1")
        f["owner_consents"][1]["owner_ref"] = "synthetic-owner-A"
        self.assert_blocked(f, "S1_REQUIRES_TWO_DISTINCT_COOWNERS")

    def test_s2_requires_exactly_two_stores(self):
        f = owner_fixture("S2")
        f["store_refs"].append("synthetic-store-C")
        self.assert_blocked(f, "S2_REQUIRES_EXACTLY_TWO_STORES")

    def test_s2_requires_distinct_owner_identities_for_ab(self):
        f = owner_fixture("S2")
        f["owner_consents"][1]["owner_ref"] = "synthetic-owner-A"
        self.assert_blocked(f, "S2_AB_TEST_REQUIRES_DISTINCT_OWNER_IDENTITIES")

    def test_missing_owner_approval(self):
        f = owner_fixture("S2"); f["owner_consents"] = []
        self.assert_blocked(f, "MISSING_PRIVATE_OWNER_CONSENT")

    def test_wrong_tenant(self):
        f = owner_fixture("S2"); f["owner_consents"][0]["tenant_ref"] = "synthetic-tenant-X"
        self.assert_blocked(f, "OWNER_TENANT_SCOPE_MISMATCH")

    def test_wrong_store(self):
        f = owner_fixture("S2"); f["owner_consents"][0]["store_ref"] = "synthetic-store-X"
        self.assert_blocked(f, "OWNER_STORE_SCOPE_MISMATCH")

    def test_missing_signature_verification(self):
        f = owner_fixture("S2"); f["owner_consents"][0]["signature_verified_by_trusted_server"] = False
        self.assert_blocked(f, "INCOMPLETE_SIGNED_OWNER_PROVENANCE")

    def test_invalid_signature_digest(self):
        f = owner_fixture("S2"); f["owner_consents"][0]["signed_payload_sha256"] = "sha256:bad"
        self.assert_blocked(f, "INVALID_SIGNED_PAYLOAD_DIGEST")

    def test_reviewer_must_be_independent(self):
        f = owner_fixture("S2"); f["owner_consents"][0]["reviewer_ref"] = f["owner_consents"][0]["owner_ref"]
        self.assert_blocked(f, "INVALID_OR_NONINDEPENDENT_REVIEWER")

    def test_challenge_must_be_consumed(self):
        f = owner_fixture("S2"); f["owner_consents"][0]["challenge_consumed"] = False
        self.assert_blocked(f, "INCOMPLETE_SIGNED_OWNER_PROVENANCE")

    def test_owner_evidence_must_be_current(self):
        f = owner_fixture("S2"); f["owner_consents"][0]["expires_at"] = "2026-11-17T12:00:00Z"
        self.assert_blocked(f, "OWNER_EVIDENCE_NOT_CURRENT")

    def test_revocation_state_must_be_explicit(self):
        f = owner_fixture("S2"); del f["owner_consents"][0]["revoked_at"]
        self.assert_blocked(f, "OWNER_EVIDENCE_REVOKED_OR_REVOCATION_UNKNOWN")

    def test_session_cannot_be_reused(self):
        f = owner_fixture("S2")
        f["owner_consents"][1]["auth_session_ref"] = f["owner_consents"][0]["auth_session_ref"]
        self.assert_blocked(f, "OWNER_SESSION_REUSE")

    def test_sensitive_user_id_field_rejected(self):
        f = owner_fixture("S2"); f["owner_consents"][0]["authUserId"] = "synthetic"
        self.assert_blocked(f, "FORBIDDEN_PRIVATE_DATA_FIELD")

    def test_client_cannot_request_real_authority(self):
        f = owner_fixture("S2"); f["real_authority_requested"] = True
        self.assert_blocked(f, "REAL_AUTHORITY_PROHIBITED")


class AliasCrosswalkContractTests(unittest.TestCase):
    def assert_blocked(self, fixture, reason):
        result = inspect_alias_crosswalk(fixture)
        self.assertEqual(result["preflight"], "BLOCKED")
        self.assertIn(reason, result["reasons"])
        self.assertFalse(result["authority_granted"])
        self.assertFalse(result["store_membership_granted"])
        self.assertFalse(result["real_ab_uat_admitted"])
        self.assertFalse(result["migration_admitted"])
        self.assertFalse(result["production_send_admitted"])

    def test_valid_namespaced_crosswalk_is_review_only(self):
        result = inspect_alias_crosswalk(crosswalk_fixture())
        self.assertEqual(result["preflight"], "SYNTHETIC_REVIEW_ELIGIBLE_ONLY")
        self.assertFalse(result["authority_granted"])

    def test_same_alias_text_different_namespace_is_not_joined(self):
        f = crosswalk_fixture()
        row = copy.deepcopy(f["mappings"][1])
        row["mapping_ref"] = "synthetic-mapping-store-B"
        row["namespace"] = "synthetic:other-qa-registry"
        row["alias_ref"] = f["mappings"][1]["alias_ref"]
        row["store_ref"] = "synthetic-store-B"
        row["source_revision_ref"] = "synthetic-source-revision-B"
        row["evidence_ref"] = "synthetic-evidence-B"
        row["signature_ref"] = "synthetic-signature-B"
        row["signed_payload_sha256"] = "sha256:" + "c" * 64
        f["mappings"].append(row)
        self.assertEqual(inspect_alias_crosswalk(f)["preflight"], "SYNTHETIC_REVIEW_ELIGIBLE_ONLY")

    def test_same_namespace_alias_conflicting_store_denied(self):
        f = crosswalk_fixture()
        row = copy.deepcopy(f["mappings"][1])
        row["mapping_ref"] = "synthetic-mapping-conflict"
        row["store_ref"] = "synthetic-store-B"
        f["mappings"].append(row)
        self.assert_blocked(f, "ALIAS_COLLISION_MULTIPLE_CANONICAL_TARGETS")

    def test_duplicate_active_alias_same_target_denied(self):
        f = crosswalk_fixture()
        row = copy.deepcopy(f["mappings"][1])
        row["mapping_ref"] = "synthetic-mapping-duplicate"
        f["mappings"].append(row)
        self.assert_blocked(f, "DUPLICATE_ACTIVE_ALIAS_MAPPING")

    def test_one_installation_cannot_claim_two_stores(self):
        f = crosswalk_fixture()
        row = copy.deepcopy(f["mappings"][2])
        row["mapping_ref"] = "synthetic-mapping-install-B"
        row["alias_ref"] = "fixture-alias-install-B"
        row["store_ref"] = "synthetic-store-B"
        row["source_revision_ref"] = "synthetic-source-revision-B"
        row["installation_ref"] = f["mappings"][2]["installation_ref"]
        f["mappings"].append(row)
        self.assert_blocked(f, "INSTALLATION_COLLISION_MULTIPLE_STORES")

    def test_tenant_alias_cannot_infer_store(self):
        f = crosswalk_fixture()
        f["mappings"][0]["store_ref"] = "synthetic-store-A"
        self.assert_blocked(f, "TENANT_ALIAS_MUST_NOT_INFER_STORE")

    def test_s3_owner_decision_blocks_crosswalk(self):
        f = crosswalk_fixture(); f["owner_decision"] = "S3"
        self.assert_blocked(f, "OWNER_DECISION_UNRESOLVED")

    def test_unknown_source_denied(self):
        f = crosswalk_fixture(); f["mappings"][0]["source_system"] = "LIVE_UNVERIFIED"
        self.assert_blocked(f, "UNRECOGNIZED_SOURCE_NAMESPACE")

    def test_namespace_must_be_declared(self):
        f = crosswalk_fixture(); f["mappings"][0]["namespace"] = "n8n"
        self.assert_blocked(f, "UNSCOPED_ALIAS_NAMESPACE")

    def test_alias_must_be_fixture_reference(self):
        f = crosswalk_fixture(); f["mappings"][0]["alias_ref"] = "actual-account-id"
        self.assert_blocked(f, "UNVERIFIED_EXTERNAL_ALIAS")

    def test_signature_must_be_verified_server_side(self):
        f = crosswalk_fixture(); f["mappings"][0]["signature_verified_by_trusted_server"] = False
        self.assert_blocked(f, "UNVERIFIED_ALIAS_EVIDENCE")

    def test_revocation_state_must_be_explicit(self):
        f = crosswalk_fixture(); del f["mappings"][0]["revoked_at"]
        self.assert_blocked(f, "ALIAS_REVOKED_OR_REVOCATION_UNKNOWN")

    def test_expired_alias_denied(self):
        f = crosswalk_fixture(); f["mappings"][0]["expires_at"] = "2026-11-17T12:00:00Z"
        self.assert_blocked(f, "ALIAS_EVIDENCE_NOT_CURRENT")

    def test_installation_requires_provider_proof(self):
        f = crosswalk_fixture(); del f["mappings"][2]["provider_proof_ref"]
        self.assert_blocked(f, "MISSING_PROVIDER_INSTALLATION_PROOF")

    def test_owner_decision_reference_must_match(self):
        f = crosswalk_fixture(); f["mappings"][0]["owner_decision_ref"] = "synthetic-decision-X"
        self.assert_blocked(f, "ALIAS_OWNER_DECISION_REF_MISMATCH")

    def test_tenant_target_must_be_canonical_tenant(self):
        f = crosswalk_fixture(); f["mappings"][0]["tenant_ref"] = "synthetic-tenant-X"
        self.assert_blocked(f, "ALIAS_CANONICAL_TENANT_MISMATCH")

    def test_crosswalk_never_grants_real_authority(self):
        f = crosswalk_fixture()
        result = inspect_alias_crosswalk(f)
        self.assertFalse(result["authority_granted"])
        self.assertFalse(result["real_auth_uat_admitted"])
        self.assertFalse(result["real_ab_uat_admitted"])
        self.assertFalse(result["migration_admitted"])
        self.assertFalse(result["production_send_admitted"])

    def test_sensitive_provider_token_field_rejected(self):
        f = crosswalk_fixture(); f["mappings"][2]["providerToken"] = "synthetic"
        self.assert_blocked(f, "FORBIDDEN_PRIVATE_DATA_FIELD")


if __name__ == "__main__":
    unittest.main(verbosity=2)

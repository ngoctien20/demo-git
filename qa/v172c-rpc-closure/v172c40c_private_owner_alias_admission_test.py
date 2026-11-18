"""Negative security tests for V17.2C.40C: source-only synthetic fixtures."""
import copy
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from v172c40c_private_owner_alias_admission import inspect_synthetic_proposal


def fresh_fixture():
    tenant = "synthetic-tenant-1"
    def consent(owner, store):
        return {
            "owner_ref": owner, "tenant_ref": tenant, "store_ref": store,
            "explicit_owner_consent": True,
            "challenge_confirmed": True,
            "challenge_consumed": True,
            "current_session_attested": True,
            "independent_reviewer_attested": True,
            "revoked": False, "expired": False, "source": "SYNTHETIC_ONLY"
        }
    def crosswalk(source, ns, alias, store, installation):
        return {
            "source": source, "namespace": ns, "external_alias": alias,
            "tenant_ref": tenant, "store_ref": store,
            "installation_ref": installation,
            "origin_provenance_attested": True,
            "private_reviewer_attested": True,
            "source_binding_attested": True,
            "current_provider_proof_attested": True,
            "revoked": False, "expired": False
        }
    return {
        "scope": "SYNTHETIC_ONLY",
        "real_authority_requested": False,
        "owner_scenario": "S2",
        "tenant_ref": tenant,
        "store_refs": ["synthetic-store-A", "synthetic-store-B"],
        "owner_consents": [
            consent("synthetic-owner-A", "synthetic-store-A"),
            consent("synthetic-owner-B", "synthetic-store-B"),
        ],
        "alias_mappings": [
            crosswalk(
                "SYNTHETIC_N8N_COMMERCE_TENANTS", "synthetic:n8n-commerce",
                "fixture-alias-A", "synthetic-store-A",
                "fixture-install-A"
            ),
            crosswalk(
                "SYNTHETIC_N8N_COMMERCE_CHANNELS", "synthetic:n8n-channels",
                "fixture-alias-B", "synthetic-store-B",
                "fixture-install-B"
            ),
        ]
    }


class SecurityGateTests(unittest.TestCase):
    def result(self, f):
        return inspect_synthetic_proposal(f)

    def assert_block(self, f, marker):
        r = self.result(f)
        self.assertEqual(r["preflight"], "BLOCKED")
        self.assertIn(marker, r["reasons"])
        self.assertIs(r["authority_granted"], False)
        self.assertIs(r["real_ab_uat_admitted"], False)
        self.assertIs(r["production_send_admitted"], False)

    def test_positive_synthetic_review_still_never_grants(self):
        result = self.result(fresh_fixture())
        self.assertEqual(result["preflight"], "SYNTHETIC_REVIEW_ELIGIBLE_ONLY")
        self.assertEqual(result["reasons"], [])
        self.assertIs(result["authority_granted"], False)
        self.assertIs(result["real_ab_uat_admitted"], False)
        self.assertIs(result["migration_admitted"], False)
        self.assertIs(result["production_send_admitted"], False)

    def test_co_owners_single_store_no_cross_store_admission(self):
        f = fresh_fixture()
        f["owner_scenario"] = "S1"
        f["store_refs"] = ["synthetic-store-A"]
        f["owner_consents"][1]["store_ref"] = "synthetic-store-A"
        f["alias_mappings"] = f["alias_mappings"][:1]
        r = self.result(f)
        self.assertEqual(r["preflight"], "SYNTHETIC_REVIEW_ELIGIBLE_ONLY")
        self.assertIs(r["real_ab_uat_admitted"], False)

    def test_owner_decision_unresolved(self):
        f = fresh_fixture();f["owner_scenario"] = "UNDECIDED"
        self.assert_block(f, "OWNER_DECISION_NOT_CONFIRMED")

    def test_s2_requires_two_stores(self):
        f = fresh_fixture()
        f["store_refs"] = ["synthetic-store-A"]
        self.assert_block(f, "TWO_DISTINCT_STORES_REQUIRED")

    def test_s1_rejects_multiple_stores(self):
        f = fresh_fixture();f["owner_scenario"] = "S1"
        self.assert_block(f, "COOWNER_ONE_STORE_REQUIRED")

    def test_missing_owner_approval(self):
        f = fresh_fixture();f["owner_consents"] = []
        self.assert_block(f, "MISSING_PRIVATE_OWNER_CONSENT")

    def test_unconsumed_challenge(self):
        f = fresh_fixture()
        f["owner_consents"][1]["challenge_consumed"] = False
        self.assert_block(f, "INCOMPLETE_OWNER_PROVENANCE")

    def test_missing_current_session_attestation(self):
        f = fresh_fixture()
        f["owner_consents"][0]["current_session_attested"] = False
        self.assert_block(f, "INCOMPLETE_OWNER_PROVENANCE")

    def test_missing_independent_owner_reviewer(self):
        f = fresh_fixture()
        f["owner_consents"][0]["independent_reviewer_attested"] = False
        self.assert_block(f, "INCOMPLETE_OWNER_PROVENANCE")

    def test_revoked_owner(self):
        f = fresh_fixture();f["owner_consents"][1]["revoked"] = True
        self.assert_block(f, "REVOKED_OR_EXPIRED_OWNER_EVIDENCE")

    def test_expired_owner(self):
        f = fresh_fixture();f["owner_consents"][1]["expired"] = True
        self.assert_block(f, "REVOKED_OR_EXPIRED_OWNER_EVIDENCE")

    def test_owner_in_wrong_tenant(self):
        f = fresh_fixture()
        f["owner_consents"][1]["tenant_ref"] = "synthetic-tenant-attacker"
        self.assert_block(f, "OWNER_TENANT_SCOPE_MISMATCH")

    def test_owner_for_unlisted_store(self):
        f = fresh_fixture()
        f["owner_consents"][0]["store_ref"] = "synthetic-store-X"
        self.assert_block(f, "OWNER_STORE_SCOPE_MISMATCH")

    def test_one_owner_does_not_prove_distinct_ab(self):
        f = fresh_fixture()
        f["owner_consents"][1]["owner_ref"] = "synthetic-owner-A"
        self.assert_block(f, "INDEPENDENT_AB_OWNERS_NOT_PROVEN")

    def test_qa_pairing_label_is_not_owner_proof(self):
        f = fresh_fixture()
        f["owner_consents"][0]["challenge_confirmed"] = False
        f["owner_consents"][0]["qa_pairing_status"] = "paired"
        self.assert_block(f, "INCOMPLETE_OWNER_PROVENANCE")

    def test_untrusted_owner_record(self):
        f = fresh_fixture();f["owner_consents"][0]["source"] = "QA_APPROVED"
        self.assert_block(f, "UNTRUSTED_OWNER_EVIDENCE_SOURCE")

    def test_missing_crosswalk(self):
        f = fresh_fixture();f["alias_mappings"] = []
        self.assert_block(f, "MISSING_ALIAS_PROVENANCE")

    def test_same_namespace_conflicting_store_target(self):
        f = fresh_fixture()
        f["alias_mappings"][1]["source"] = f["alias_mappings"][0]["source"]
        f["alias_mappings"][1]["namespace"] = f["alias_mappings"][0]["namespace"]
        f["alias_mappings"][1]["external_alias"] = f["alias_mappings"][0]["external_alias"]
        self.assert_block(f, "ALIAS_COLLISION_MULTIPLE_STORES")

    def test_distinct_namespace_can_reuse_alias_without_auto_join(self):
        f = fresh_fixture()
        f["alias_mappings"][1]["external_alias"] = f["alias_mappings"][0]["external_alias"]
        self.assertEqual(
            self.result(f)["preflight"], "SYNTHETIC_REVIEW_ELIGIBLE_ONLY"
        )

    def test_provider_installation_shared_between_stores_denied(self):
        f = fresh_fixture()
        f["alias_mappings"][1]["installation_ref"] = f["alias_mappings"][0]["installation_ref"]
        self.assert_block(f, "INSTALLATION_COLLISION_MULTIPLE_STORES")

    def test_alias_wrong_tenant(self):
        f = fresh_fixture()
        f["alias_mappings"][0]["tenant_ref"] = "synthetic-tenant-X"
        self.assert_block(f, "ALIAS_CANONICAL_SCOPE_MISMATCH")

    def test_alias_source_not_trusted(self):
        f = fresh_fixture()
        f["alias_mappings"][0]["source"] = "REAL_UNVERIFIED_PROVIDER"
        self.assert_block(f, "UNRECOGNIZED_SOURCE_NAMESPACE")

    def test_missing_namespace(self):
        f = fresh_fixture();f["alias_mappings"][0]["namespace"] = "n8n"
        self.assert_block(f, "UNSCOPED_ALIAS_NAMESPACE")

    def test_alias_without_provider_proof(self):
        f = fresh_fixture()
        f["alias_mappings"][0]["current_provider_proof_attested"] = False
        self.assert_block(f, "UNVERIFIED_ALIAS_EVIDENCE")

    def test_expired_alias(self):
        f = fresh_fixture()
        f["alias_mappings"][0]["expired"] = True
        self.assert_block(f, "REVOKED_OR_EXPIRED_ALIAS")

    def test_missing_store_crosswalk(self):
        f = fresh_fixture();f["alias_mappings"] = f["alias_mappings"][:1]
        self.assert_block(f, "STORE_WITHOUT_ALIAS_EVIDENCE")

    def test_no_real_authority_input_can_be_promoted(self):
        f = fresh_fixture();f["real_authority_requested"] = True
        self.assert_block(f, "REAL_AUTHORITY_PROHIBITED")

    def test_malicious_authority_granted_claim_rejected(self):
        f = fresh_fixture();f["authority_granted"] = True
        self.assert_block(f, "INJECTED_AUTHORITY_PROHIBITED")

    def test_private_jwt_field_rejected_without_logging_value(self):
        f = fresh_fixture();f["jwt"] = "DO_NOT_EXPOSE_A_TEST_TOKEN"
        self.assert_block(f, "FORBIDDEN_PRIVATE_DATA_FIELD")

    def test_pii_nested_phone_rejected(self):
        f = fresh_fixture();f["owner_consents"][0]["phone"] = "synthetic-only"
        self.assert_block(f, "FORBIDDEN_PRIVATE_DATA_FIELD")

    def test_real_scope_fails_closed(self):
        f = fresh_fixture();f["scope"] = "PRODUCTION"
        self.assert_block(f, "NON_SYNTHETIC_SCOPE")

    def test_registry_remains_unapproved(self):
        j = json.loads((HERE / "v172c40b-owner-authority-registry-NOT_APPROVED.json").read_text())
        self.assertEqual(j["status"], "NOT_APPROVED")
        self.assertEqual(j["authority_effect"], "NONE")
        self.assertTrue(all(v is False for v in j["release_gate"].values()))
        self.assertEqual(j["owner_store_grant_records"], [])
        self.assertEqual(j["alias_crosswalk_records"], [])


    def test_unhashable_alias_source_fails_closed(self):
        f = fresh_fixture()
        f["alias_mappings"][0]["source"] = {"malformed": True}
        self.assert_block(f, "UNRECOGNIZED_SOURCE_NAMESPACE")

    def test_camel_case_credential_ref_rejected(self):
        f = fresh_fixture()
        f["alias_mappings"][0]["credentialRef"] = "fake-fixture-only"
        self.assert_block(f, "FORBIDDEN_PRIVATE_DATA_FIELD")

    def test_camel_case_access_token_rejected(self):
        f = fresh_fixture()
        f["accessToken"] = "fake-fixture-only"
        self.assert_block(f, "FORBIDDEN_PRIVATE_DATA_FIELD")

    def test_hyphenated_private_key_rejected(self):
        f = fresh_fixture()
        f["private-key"] = "fake-fixture-only"
        self.assert_block(f, "FORBIDDEN_PRIVATE_DATA_FIELD")


    def test_missing_revocation_state_is_not_an_approval(self):
        f = fresh_fixture()
        del f["owner_consents"][0]["revoked"]
        self.assert_block(f, "REVOKED_OR_EXPIRED_OWNER_EVIDENCE")

    def test_missing_alias_revocation_state_is_not_an_approval(self):
        f = fresh_fixture()
        del f["alias_mappings"][0]["expired"]
        self.assert_block(f, "REVOKED_OR_EXPIRED_ALIAS")

    def test_authority_requested_must_be_explicitly_false(self):
        f = fresh_fixture()
        del f["real_authority_requested"]
        self.assert_block(f, "REAL_AUTHORITY_PROHIBITED")

    def test_s2_requires_exactly_two_canonical_store_candidates(self):
        f = fresh_fixture()
        f["store_refs"].append("synthetic-store-C")
        self.assert_block(f, "TWO_DISTINCT_STORES_REQUIRED")

if __name__ == "__main__":
    unittest.main(verbosity=2)

"""V17.2C.40F static threat-model/API contract checks; no network or DB."""
import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONTRACT = json.loads((HERE / "v172c40f-owner-transition-api-NOT_APPROVED.json").read_text())
FORBIDDEN = {
    "auth_user_id", "user_id", "tenant_id", "store_id", "role",
    "owner_verified", "session_id", "provider_account_id",
    "channel_installation_id", "credential_ref", "jwt", "access_token",
    "refresh_token", "service_role_key",
}


class PrivateOwnerTransitionContractTests(unittest.TestCase):
    def test_contract_is_not_approved_design_only(self):
        self.assertEqual(CONTRACT["contract"], "TIEN404_V17_2C40F_PRIVATE_OWNER_TRANSITION_API")
        self.assertEqual(CONTRACT["status"], "NOT_APPROVED")
        self.assertEqual(CONTRACT["scope"], "DESIGN_ONLY_NO_WRITE")
        self.assertEqual(CONTRACT["authority_effect"], "NONE")

    def test_current_decision_remains_s3(self):
        self.assertEqual(CONTRACT["default_decision"], "S3")
        self.assertEqual(CONTRACT["decision_ref"], "synthetic-decision-s3-v1")

    def test_no_service_or_hosted_route_exists(self):
        self.assertIs(CONTRACT["service_deployed"], False)
        self.assertIsNone(CONTRACT["service_base_url"])
        self.assertIs(CONTRACT["hosted_route_registered"], False)
        self.assertIs(CONTRACT["credentials_configured"], False)
        self.assertIs(CONTRACT["production_enabled"], False)

    def test_every_route_is_disabled(self):
        self.assertGreaterEqual(len(CONTRACT["routes"]), 5)
        self.assertTrue(all(route["enabled"] is False for route in CONTRACT["routes"]))

    def test_no_activation_endpoint_is_defined(self):
        self.assertIs(CONTRACT["activation_endpoint_defined"], False)
        self.assertFalse(any("activate" in route["id"] or "activate" in route["path"]
                             for route in CONTRACT["routes"]))

    def test_no_store_grant_or_writer_endpoint_is_defined(self):
        paths = [route["path"] for route in CONTRACT["routes"]]
        self.assertFalse(any("store-grant" in path or "order-writer" in path
                             or "provider-dispatch" in path for path in paths))

    def test_mutating_routes_require_idempotency(self):
        for route in CONTRACT["routes"]:
            if route["method"] == "POST":
                self.assertIn("idempotency_key", route.get("request_allowlist", []))

    def test_client_cannot_submit_authority_fields(self):
        forbidden = set(CONTRACT["forbidden_client_fields"])
        self.assertTrue(FORBIDDEN.issubset(forbidden))
        for route in CONTRACT["routes"]:
            allowlist = set(route.get("request_allowlist", []))
            self.assertFalse(allowlist & forbidden)

    def test_transition_intent_has_no_client_store_or_owner_id(self):
        route = next(r for r in CONTRACT["routes"] if r["id"] == "create_transition_intent")
        self.assertEqual(set(route["request_allowlist"]), {
            "previous_decision_ref", "requested_decision", "idempotency_key"
        })
        self.assertEqual(route["requested_decision_values"], ["S1", "S2"])
        self.assertTrue(route["must_not_change_current_s3_record"])

    def test_store_and_session_scope_is_server_bound(self):
        route = next(r for r in CONTRACT["routes"] if r["id"] == "issue_owner_challenge")
        self.assertEqual(route["request_allowlist"], ["transition_intent_ref", "idempotency_key"])
        for key in ("actor_ref", "session_id_digest", "tenant_ref", "store_ref",
                    "decision_ref", "decision_version", "nonce_digest", "expires_at"):
            self.assertIn(key, route["server_binds"])

    def test_challenge_is_single_use(self):
        route = next(r for r in CONTRACT["routes"] if r["id"] == "issue_owner_challenge")
        self.assertEqual(route["challenge_use"], "SINGLE_USE")

    def test_challenge_consumption_and_consent_event_are_atomic(self):
        route = next(r for r in CONTRACT["routes"] if r["id"] == "submit_owner_consent")
        self.assertEqual(route["atomicity"],
                         "CONSUME_CHALLENGE_AND_APPEND_CONSENT_EVENT_IN_ONE_TRANSACTION")
        self.assertEqual(route["response_state"], "CONSENT_RECORDED_NOT_AUTHORITY_GRANTED")

    def test_reviewer_must_be_independent(self):
        route = next(r for r in CONTRACT["routes"] if r["id"] == "independent_review")
        self.assertEqual(route["auth"], "SERVER_VERIFIED_INDEPENDENT_REVIEWER_SESSION")
        self.assertIn("reviewer_not_any_owner_in_transition", route["reviewer_constraints"])

    def test_revocation_is_append_only_and_deny_future_admissions(self):
        route = next(r for r in CONTRACT["routes"] if r["id"] == "revoke_owner_consent")
        self.assertIn("APPEND_REVOCATION_EVENT", route["effect"])
        self.assertIn("DENY_FUTURE_ADMISSIONS", route["effect"])

    def test_security_invariants_all_required_true(self):
        self.assertTrue(all(value is True for value in CONTRACT["security_invariants"].values()))

    def test_release_gates_all_false(self):
        self.assertGreaterEqual(len(CONTRACT["release_gates"]), 10)
        self.assertTrue(all(value is False for value in CONTRACT["release_gates"].values()))

    def test_s3_lock_and_crosswalk_are_empty_and_denied(self):
        decision = json.loads((HERE / "v172c40e-s3-owner-decision-LOCKED-NO-AUTHORITY.json").read_text())
        crosswalk = json.loads((HERE / "v172c40e-s3-crosswalk-LOCKED-NO-MAPPINGS.json").read_text())
        self.assertEqual(decision["decision"], "S3")
        self.assertEqual(decision["store_refs"], [])
        self.assertEqual(decision["owner_consents"], [])
        self.assertEqual(crosswalk["mappings"], [])
        self.assertTrue(all(v is False for v in decision["release_gates"].values()))
        self.assertTrue(all(v is False for v in crosswalk["release_gates"].values()))

    def test_deployment_rule_is_explicitly_disabled(self):
        self.assertEqual(CONTRACT["deployment_rule"],
                         "SPEC_ONLY_DISABLED_NO_ROUTE_NO_SECRET_NO_DB_WRITE_NO_SEND")


if __name__ == "__main__":
    unittest.main(verbosity=2)

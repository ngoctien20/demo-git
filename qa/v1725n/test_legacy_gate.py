"""Only synthetic source-level denial tests. No provider or database network."""
import unittest
from legacy_gate import decide_legacy_orders


class TestLegacyGate(unittest.TestCase):
    def test_denies_every_count_including_one_store(self):
        for count in (None, -1, 0, 1, 2, 3, 100, 10**16, True, "1", {}, []):
            with self.subTest(count=str(count)):
                self.assertFalse(decide_legacy_orders(tenant_store_count=count).read_allowed)

    def test_denies_self_approved_and_dual_owner(self):
        for approval in (False, True, 1, "true", {"signed": True}):
            with self.subTest(approval=str(approval)):
                result = decide_legacy_orders(owner_id="synthetic-owner-a-b", requested_store="B",
                                              client_approved=approval)
                self.assertEqual(
                    (result.http_status, result.read_allowed, result.write_allowed,
                     result.provider_send_allowed, result.production_allowed),
                    (503, False, False, False, False)
                )

    def test_denial_contains_no_identifiers(self):
        result = decide_legacy_orders(tenant_store_count=1, owner_id="synthetic-private",
                                      requested_store="synthetic-private")
        self.assertEqual(result.code, "LEGACY_ORDERS_STORE_SCOPE_REQUIRED")
        self.assertNotIn("synthetic-private", repr(result))


if __name__ == "__main__":
    unittest.main()

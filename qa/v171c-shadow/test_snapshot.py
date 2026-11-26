"""V17.1-C strict source QA for the exact inactive n8n shadow checkpoint. No network or SDK dependencies."""
import json
import re
import unittest
from collections import Counter
from pathlib import Path

SNAPSHOT = json.loads((Path(__file__).parent / 'inactive-n8n-shadow-qa-snapshot.json').read_text())
WORKFLOW = SNAPSHOT['n8n']
NODES = WORKFLOW['nodes']
REGISTRY = SNAPSHOT['registry']
ROWS = REGISTRY['rows']
EXEC = SNAPSHOT['execution']
CASES = {c['case_id']: c for c in EXEC['cases']}


class TestShadowCheckpoint(unittest.TestCase):
    def test_01_fixture_only(self):
        self.assertEqual(SNAPSHOT['schema_version'], 'T404_V171C_INACTIVE_NATIVE_SHADOW_QA_SNAPSHOT_V1')

    def test_02_workflow_is_inactive(self):
        self.assertIs(WORKFLOW['active'], False)
        self.assertIsNone(WORKFLOW['active_version_id'])

    def test_03_workflow_exact_pinned_version(self):
        self.assertEqual(WORKFLOW['workflow_id'], 'AKgE96Xvbqxw4rGb')
        self.assertEqual(WORKFLOW['version_id'], 'dbfc0311-c08c-4c0d-86b9-92074608e127')

    def test_04_manual_qa_folder(self):
        self.assertEqual(WORKFLOW['qa_folder'], '90_QA - DIAGNOSTICS')

    def test_05_six_nodes_only(self):
        self.assertEqual(len(NODES), 6)

    def test_06_only_safe_node_types(self):
        self.assertEqual({n['type'] for n in NODES}, {
            'n8n-nodes-base.manualTrigger',
            'n8n-nodes-base.code',
            'n8n-nodes-base.dataTable'
        })

    def test_07_one_manual_trigger(self):
        self.assertEqual(sum(n['type'] == 'n8n-nodes-base.manualTrigger' for n in NODES), 1)

    def test_08_no_credential_assignments(self):
        self.assertTrue(all('credentials' not in n for n in NODES))

    def test_09_only_data_table_get(self):
        fetch = [n for n in NODES if n['type'] == 'n8n-nodes-base.dataTable']
        self.assertEqual(len(fetch), 1)
        self.assertEqual(fetch[0]['parameters']['resource'], 'row')
        self.assertEqual(fetch[0]['parameters']['operation'], 'get')
        self.assertIs(fetch[0]['parameters']['returnAll'], True)
        self.assertEqual(fetch[0]['parameters']['dataTableId']['value'], REGISTRY['data_table_id'])

    def test_10_no_real_meta_page_id(self):
        raw = json.dumps(SNAPSHOT)
        self.assertNotIn('2379295362359912', raw)

    def test_11_hmac_raw_body_and_timing_safe(self):
        v = next(n for n in NODES if n['name'] == 'Verify Raw Meta QA Signature and Normalize')
        js = v['parameters']['jsCode']
        self.assertIn('createHmac', js)
        self.assertIn('timingSafeEqual', js)
        self.assertIn('raw_body', js)
        self.assertIn("sha256=", js)

    def test_12_denies_client_store_spoof(self):
        v = next(n for n in NODES if n['name'] == 'Verify Raw Meta QA Signature and Normalize')
        js = v['parameters']['jsCode']
        for marker in ['p.store_id', 'p.tenant_id', 'p.bot_id', 'p.verification_status']:
            self.assertIn(marker, js)
        self.assertIn('CLIENT_SCOPE_SPOOF', js)

    def test_13_meta_page_recipient_scope(self):
        v = next(n for n in NODES if n['name'] == 'Verify Raw Meta QA Signature and Normalize')
        js = v['parameters']['jsCode']
        self.assertIn('item?.recipient?.id!==e.id', js)
        self.assertIn('WRONG_META_RECIPIENT', js)

    def test_14_dedupe_and_conflicting_replay(self):
        v = next(n for n in NODES if n['name'] == 'Verify Raw Meta QA Signature and Normalize')
        js = v['parameters']['jsCode']
        self.assertIn('CONFLICTING_MID_REPLAY', js)
        self.assertIn('QA_DUPLICATE', js)

    def test_15_registry_scoped_to_qa(self):
        self.assertEqual(REGISTRY['authority_claim'], 'QA_FIXTURES_ONLY_NO_OWNER_PROOF')
        self.assertEqual(REGISTRY['name'], 'TIEN404_V171C_QA_INSTALLATION_BOT_BINDINGS_NO_SEND')

    def test_16_three_rows_and_unique_installations(self):
        self.assertEqual(len(ROWS), 3)
        self.assertEqual(len({r['installation_ref'] for r in ROWS}), 3)

    def test_17_same_tenant_distinct_stores(self):
        self.assertEqual({r['tenant_ref'] for r in ROWS}, {'QA_TENANT_1'})
        self.assertEqual({r['store_ref'] for r in ROWS}, {'QA_STORE_A', 'QA_STORE_B'})

    def test_18_all_rows_no_owner_authority(self):
        self.assertTrue(all(r['owner_authority_verified'] is False for r in ROWS))

    def test_19_no_real_approval_scope(self):
        self.assertTrue(all(r['approval_scope'] == 'SYNTHETIC_ONLY' for r in ROWS))

    def test_20_registry_read_only(self):
        self.assertTrue(all(r['read_only'] is True for r in ROWS))

    def test_21_one_revoked(self):
        self.assertEqual(Counter(r['binding_status'] for r in ROWS),
                         {'QA_APPROVED': 2, 'REVOKED': 1})

    def test_22_bot_version_matches_profile(self):
        for r in ROWS:
            self.assertEqual(r['bot_version'], r['bot_profile_ref'] + '_V1')

    def test_23_binding_policy_verified_server_side(self):
        b = next(n for n in NODES if n['name'] == 'Apply Trusted QA Registry Bot Policy and Mock Only')
        js = b['parameters']['jsCode']
        for rule in ['approval_scope', 'owner_authority_verified', 'read_only',
                     'QA_APPROVED', 'INSTALLATION_POLICY_OR_STORE_BINDING_DENIED']:
            self.assertIn(rule, js)

    def test_24_no_hardcoded_trusted_registry_in_verifier(self):
        v = next(n for n in NODES if n['name'] == 'Verify Raw Meta QA Signature and Normalize')
        self.assertNotIn('QA_BOT_A_V1', v['parameters']['jsCode'])
        self.assertNotIn('159000', v['parameters']['jsCode'])

    def test_25_n8n_actual_manual_execution(self):
        self.assertEqual(EXEC['id'], '4341')
        self.assertEqual(EXEC['status'], 'success')
        self.assertEqual(EXEC['mode'], 'manual')

    def test_26_actual_outcomes(self):
        self.assertEqual(EXEC['result_summary'],
                         {'total': 20, 'passed': 20, 'allowed': 3,
                          'denied': 16, 'duplicate': 1})
        self.assertEqual(len(CASES), 20)

    def test_27_success_binds_distinct_bots(self):
        self.assertEqual(CASES['QA_V171C_01']['store'], 'QA_STORE_A')
        self.assertEqual(CASES['QA_V171C_01']['bot'], 'QA_BOT_A')
        self.assertEqual(CASES['QA_V171C_01']['price_vnd'], 159000)
        self.assertEqual(CASES['QA_V171C_02']['store'], 'QA_STORE_B')
        self.assertEqual(CASES['QA_V171C_02']['bot'], 'QA_BOT_B')
        self.assertEqual(CASES['QA_V171C_02']['price_vnd'], 259000)

    def test_28_invalid_sig_denied(self):
        self.assertEqual(CASES['QA_V171C_03']['status'], 'QA_DENY')

    def test_29_client_scope_spoof_denied(self):
        for case in ['QA_V171C_06', 'QA_V171C_14', 'QA_V171C_18']:
            self.assertEqual(CASES[case]['reason'], 'CLIENT_SCOPE_SPOOF')

    def test_30_unbound_page_denied(self):
        self.assertEqual(CASES['QA_V171C_07']['status'], 'QA_DENY')

    def test_31_revoked_page_denied(self):
        self.assertEqual(CASES['QA_V171C_08']['status'], 'QA_DENY')

    def test_32_same_event_duplicate(self):
        self.assertEqual(CASES['QA_V171C_12']['status'], 'QA_DUPLICATE')

    def test_33_conflicting_replay_denied(self):
        self.assertEqual(CASES['QA_V171C_13']['reason'], 'CONFLICTING_MID_REPLAY')

    def test_34_all_denied_cases_have_no_store(self):
        self.assertTrue(all(c['store'] is None and c['bot'] is None
                            for c in CASES.values() if c['status'] == 'QA_DENY'))

    def test_35_no_live_release(self):
        gate = SNAPSHOT['release_gate']
        for key in ['provider_owner_verified', 'verified_real_event_routed_to_new_bot',
                    'hosted_store_rls_verified']:
            self.assertIs(gate[key], False)

    def test_36_no_billable_or_send_activity(self):
        gate = SNAPSHOT['release_gate']
        for key in ['model_calls', 'provider_sends', 'orders_written']:
            self.assertEqual(gate[key], 0)

    def test_37_no_network_credential_in_public_snapshot(self):
        raw = json.dumps(SNAPSHOT)
        for pattern in [r'https://graph\.facebook\.com', r'httpBearerAuth',
                        r'googleSheetsOAuth2Api', r'sk-[a-zA-Z0-9_-]{16,}']:
            self.assertIsNone(re.search(pattern, raw))

    def test_38_no_true_vendor_owner_field(self):
        self.assertNotIn('"owner_authority_verified": true', json.dumps(SNAPSHOT))

    def test_39_source_hash_not_private_payload(self):
        for case in CASES.values():
            self.assertTrue(set(case).issubset(
                {'case_id', 'status', 'reason', 'store', 'bot', 'price_vnd'}))

    def test_40_release_gate_hard_failed_for_live(self):
        g = next(n for n in NODES if n['name'] == 'Fail Closed Twenty Case Shadow Acceptance')
        self.assertIn('QA_ONLY_GO_REAL_META_NO_GO', g['parameters']['jsCode'])


if __name__ == '__main__':
    unittest.main(verbosity=2)

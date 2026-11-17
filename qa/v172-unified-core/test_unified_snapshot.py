"""TIEN404 V17.2 independent snapshot checks on actual n8n QA execution 4358."""
import json
import unittest
from pathlib import Path

s=json.loads((Path(__file__).parent/'actual-n8n-unified-core-qa-snapshot.json').read_text())
w=s['n8n']
rows=s['registry']['rows']
n={x['name']:x for x in w['nodes']}
e=s['actual_execution']
a=e['result']
cases={x['id']:x for x in a['cases']}

class UnifiedCoreAcceptance(unittest.TestCase):
    def test_01_contract(self): self.assertEqual(s['schema_version'],'T404_V172_CENTRAL_QA_CHANNEL_BOT_SECURITY_SNAPSHOT_V1')
    def test_02_expected_workflow(self): self.assertEqual(w['workflow_id'],'AjG4xCGD4OEvvgeB')
    def test_03_inactive(self): self.assertFalse(w['active']);self.assertIsNone(w['active_version_id'])
    def test_04_five_nodes(self): self.assertEqual(len(n),5)
    def test_05_manual_only(self): self.assertEqual(sum(x['type']=='n8n-nodes-base.manualTrigger' for x in n.values()),1)
    def test_06_safe_node_types(self):
        self.assertEqual({x['type'] for x in n.values()},{'n8n-nodes-base.manualTrigger','n8n-nodes-base.code','n8n-nodes-base.dataTable'})
    def test_07_no_credentials(self): self.assertTrue(all('credentials' not in x for x in n.values()))
    def test_08_data_table_get_only(self):
        t=n['Load Central QA Channel and Bot Profiles']['parameters']
        self.assertEqual(t['operation'],'get');self.assertEqual(t['resource'],'row');self.assertIs(t['returnAll'],True)
    def test_09_correct_table(self): self.assertEqual(n['Load Central QA Channel and Bot Profiles']['parameters']['dataTableId']['value'],s['registry']['table_id'])
    def test_10_seven_unique_channel_installations(self):
        self.assertEqual(len(rows),7)
        self.assertEqual(len({(x['channel'],x['installation_ref']) for x in rows}),7)
    def test_11_channels_covered(self): self.assertEqual({x['channel'] for x in rows},{'messenger','zalo_bot','zalo_oa','website'})
    def test_12_same_tenant_multiple_stores(self):
        t={x['store_ref'] for x in rows if x['tenant_ref']=='QA_TENANT_1'}
        self.assertEqual(t,{'QA_STORE_A','QA_STORE_B'})
    def test_13_independent_other_tenant(self):
        self.assertEqual({x['store_ref'] for x in rows if x['tenant_ref']=='QA_TENANT_2'},{'QA_STORE_C'})
    def test_14_fake_owner_scope_only(self):
        self.assertTrue(all(x['approval_scope']=='SYNTHETIC_ONLY' and x['owner_authority_verified'] is False for x in rows))
    def test_15_read_only_all(self): self.assertTrue(all(x['read_only'] is True for x in rows))
    def test_16_no_write_tools(self): self.assertTrue(all(x['tool_allowlist']=='catalog_read' for x in rows))
    def test_17_one_revoked(self):
        self.assertEqual(sum(x['status']=='REVOKED' for x in rows),1)
    def test_18_approved_count(self): self.assertEqual(sum(x['status']=='QA_APPROVED' for x in rows),6)
    def test_19_bot_versions(self):
        for x in rows:
            self.assertEqual(x['bot_version'],x['bot_ref']+'_V1')
            self.assertEqual(x['prompt_version'],'QA_PROMPT_'+x['store_ref'][-1]+'_V1')
    def test_20_no_cross_store_profile_conflict(self):
        for x in rows:
            self.assertEqual(x['bot_ref'],'QA_BOT_'+x['store_ref'][-1])
    def test_21_same_store_consistent_profile(self):
        for store in {x['store_ref'] for x in rows}:
            relevant=[x for x in rows if x['store_ref']==store]
            self.assertEqual(len({(x['tone'],x['selling_mode'],x['price_vnd'],x['stock']) for x in relevant}),1)
    def test_22_prices_distinct(self):
        prices={x['store_ref']:x['price_vnd'] for x in rows}
        self.assertEqual(prices,{'QA_STORE_A':159000,'QA_STORE_B':259000,'QA_STORE_C':309000})
    def test_23_real_execution_success(self):
        self.assertEqual(e['id'],'4358');self.assertEqual(e['status'],'success');self.assertEqual(e['mode'],'manual')
    def test_24_case_counts(self):
        self.assertEqual((a['total'],a['passed'],a['allow'],a['deny'],a['duplicate']),(26,26,6,19,1))
        self.assertEqual(len(cases),26)
    def test_25_qa_messenger_a_b(self):
        self.assertEqual(cases['QA_V172_01']['store'],'QA_STORE_A')
        self.assertEqual(cases['QA_V172_02']['store'],'QA_STORE_B')
    def test_26_qa_zalo_oa_b(self): self.assertEqual(cases['QA_V172_04']['store'],'QA_STORE_B')
    def test_27_qa_website_a(self): self.assertEqual(cases['QA_V172_05']['store'],'QA_STORE_A')
    def test_28_different_tenant_c(self): self.assertEqual(cases['QA_V172_06']['store'],'QA_STORE_C')
    def test_29_revoked_page_denied(self): self.assertEqual(cases['QA_V172_07']['status'],'DENY')
    def test_30_spoofed_store_bot_tenant_denied(self):
        for i in [10,11,12,13,26]: self.assertEqual(cases['QA_V172_'+str(i).zfill(2)]['status'],'DENY')
    def test_31_order_and_write_tools_denied(self):
        for i in [15,16,17,18]: self.assertEqual(cases['QA_V172_'+str(i).zfill(2)]['status'],'DENY')
    def test_32_identical_duplicate_ignored(self): self.assertEqual(cases['QA_V172_19']['status'],'DUPLICATE')
    def test_33_conflicting_replay_denied(self): self.assertEqual(cases['QA_V172_20']['reason'],'CONFLICTING_EVENT_REPLAY')
    def test_34_empty_event_id_denied(self): self.assertEqual(cases['QA_V172_23']['status'],'DENY')
    def test_35_no_scope_on_denials(self):
        self.assertTrue(all(x['store'] is None and x['bot'] is None for x in cases.values() if x['status']=='DENY'))
    def test_36_first_bug_fixed_not_masked(self):
        js=n['Generate 26 Unified Channel QA Events']['parameters']['jsCode']
        self.assertIn("Object.hasOwn(options,'event_id')",js)
        self.assertNotIn("event_id:options.event_id||",js)
    def test_37_server_mapping_not_user_supplied(self):
        js=n['Server QA Resolver plus Custom Bot Security Policy']['parameters']['jsCode']
        for x in ['CLIENT_SCOPE_OR_IDENTITY_SPOOF','UNBOUND_INSTALLATION','UNAUTHORIZED_WRITE_OR_ORDER_LOOKUP','QA_CROSS_STORE_PROFILE_CONFLICT']:
            self.assertIn(x,js)
    def test_38_no_identity_link_without_challenge(self): self.assertIs(a['customer_cross_channel_identity_verified'],False)
    def test_39_no_provider_auth_claims(self):
        self.assertFalse(a['provider_webhooks_verified'])
        self.assertFalse(a['hosted_rls_verified'])
        self.assertFalse(a['actual_messenger_zalo_website_ingress'])
    def test_40_no_send_model_or_commerce_write(self):
        self.assertEqual((a['provider_sends'],a['model_calls'],a['commerce_writes']),(0,0,0))
        self.assertEqual(a['outbound'],'MOCK_ONLY_NOT_SENT')
    def test_41_no_external_integrations_in_graph(self):
        raw=json.dumps(s)
        for token in ['n8n-nodes-base.webhook','n8n-nodes-base.httpRequest','sk-proj-','Bearer eyJ','googleSheetsOAuth2Api']:
            self.assertNotIn(token,raw)

if __name__=='__main__':
    unittest.main(verbosity=2)

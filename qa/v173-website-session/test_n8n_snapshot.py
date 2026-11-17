"""Independent V17.3 n8n execution and central QA Store/Bot snapshot audit."""
import json
import unittest
from pathlib import Path

S=json.loads((Path(__file__).parent/'inactive-n8n-website-session-qa-snapshot.json').read_text())
W=S['workflow']
R=S['registry']
E=S['execution']
O=E['summary']
N={n['name']:n for n in W['nodes']}
C={x['id']:x for x in O['cases']}

class V173WebsiteSessionAcceptance(unittest.TestCase):
    def test_01_contract(self): self.assertEqual(S['schema_version'],'T404_V173_N8N_WEBSITE_SIGNED_SESSION_QA_SNAPSHOT_V1')
    def test_02_workflow_id(self): self.assertEqual(W['id'],'lN6rKmmu11oIDVFO')
    def test_03_version(self): self.assertEqual(W['version_id'],'7e6c988f-8b22-4d5d-85ab-4c9a39d6a425')
    def test_04_inactive(self): self.assertIs(W['active'],False)
    def test_05_no_active_version(self): self.assertIsNone(W['active_version_id'])
    def test_06_separate_qa_folder(self): self.assertEqual(W['folder'],'90_QA - DIAGNOSTICS')
    def test_07_five_nodes(self): self.assertEqual(len(N),5)
    def test_08_manual_only(self): self.assertEqual(sum(x['type']=='n8n-nodes-base.manualTrigger' for x in N.values()),1)
    def test_09_node_allowlist(self):
        self.assertEqual({x['type'] for x in N.values()},
        {'n8n-nodes-base.manualTrigger','n8n-nodes-base.dataTable','n8n-nodes-base.code'})
    def test_10_no_credential_reference(self): self.assertTrue(all('credentials' not in x for x in N.values()))
    def test_11_read_only_registry(self):
        p=N['Load V17.2 QA Store Bot Profiles']['parameters']
        self.assertEqual(p['resource'],'row');self.assertEqual(p['operation'],'get');self.assertIs(p['returnAll'],True)
    def test_12_shared_v172_table(self): self.assertEqual(R['table_id'],'AAlsUnaAxbp0BscT')
    def test_13_get_node_reuses_v172(self):
        self.assertEqual(N['Load V17.2 QA Store Bot Profiles']['parameters']['dataTableId']['value'],R['table_id'])
    def test_14_registry_rows(self): self.assertEqual(len(R['rows']),7)
    def test_15_registry_is_synthetic(self):
        self.assertTrue(all(x['approval_scope']=='SYNTHETIC_ONLY' and x['owner_authority_verified'] is False for x in R['rows']))
    def test_16_readonly_flag(self): self.assertTrue(all(x['read_only'] is True for x in R['rows']))
    def test_17_site_installation_unique(self):
        x=[x for x in R['rows'] if x['channel']=='website']
        self.assertEqual(len(x),1);self.assertEqual(x[0]['installation_ref'],'QA_WEB_WIDGET_A')
    def test_18_site_a_binding(self):
        x=next(x for x in R['rows'] if x['channel']=='website')
        self.assertEqual((x['tenant_ref'],x['store_ref'],x['bot_ref']),('QA_TENANT_1','QA_STORE_A','QA_BOT_A'))
    def test_19_site_cat_allowlist(self): self.assertEqual(next(x for x in R['rows'] if x['channel']=='website')['tool_allowlist'],'catalog_read')
    def test_20_other_shop_unbound_to_site(self):
        self.assertFalse(any(x['channel']=='website' and x['store_ref']=='QA_STORE_B' for x in R['rows']))
    def test_21_other_tenant_in_registry_but_not_site(self):
        self.assertTrue(any(x['tenant_ref']=='QA_TENANT_2' for x in R['rows']))
        self.assertFalse(any(x['channel']=='website' and x['tenant_ref']=='QA_TENANT_2' for x in R['rows']))
    def test_22_actual_n8n_execution(self): self.assertEqual(E['id'],'4363')
    def test_23_manual_execution_only(self): self.assertEqual(E['mode'],'manual')
    def test_24_success_execution(self): self.assertEqual(E['status'],'success')
    def test_25_qa_result_contract(self): self.assertEqual(O['status'],'V173_WEBSITE_SESSION_TO_STORE_BOT_QA_PASS')
    def test_26_case_count(self): self.assertEqual((O['total'],O['passed'],len(C)),(38,38,38))
    def test_27_case_distribution(self): self.assertEqual((O['allow'],O['deny'],O['duplicate']),(3,34,1))
    def test_28_site_session_hmac_qa_only(self): self.assertIs(O['website_qa_session_hmac_verified'],True)
    def test_29_v172_binding_used(self): self.assertIs(O['central_v172_bot_binding_read'],True)
    def test_30_reusable_multiturn_qa_session(self):
        self.assertTrue(all(C['QA_V173_'+str(i).zfill(2)]['status']=='ALLOW' for i in (1,2,3)))
    def test_31_identical_duplicate(self): self.assertEqual(C['QA_V173_04']['status'],'DUPLICATE')
    def test_32_conflicting_replay_denied(self): self.assertEqual(C['QA_V173_05']['status'],'DENY')
    def test_33_invalid_signature_denied(self): self.assertEqual(C['QA_V173_06']['status'],'DENY')
    def test_34_expiry_and_future_denied(self):
        self.assertTrue(all(C['QA_V173_'+str(i).zfill(2)]['status']=='DENY' for i in (12,13,35)))
    def test_35_wrong_origin_and_widget_denied(self):
        self.assertTrue(all(C['QA_V173_'+str(i).zfill(2)]['status']=='DENY' for i in (8,9,10,37,38)))
    def test_36 cross_store_bot_versions_denied(self):
        self.assertTrue(all(C['QA_V173_'+str(i).zfill(2)]['status']=='DENY' for i in (17,18,19,20,36)))
    def test_37_order_and_write_denied(self):
        self.assertTrue(all(C['QA_V173_'+str(i).zfill(2)]['status']=='DENY' for i in (23,24,25)))
    def test_38 untrusted client claims denied(self):
        self.assertTrue(all(C['QA_V173_'+str(i).zfill(2)]['status']=='DENY' for i in (29,30,31,32,33,34)))
    def test_39 no_denied_case_leaks_store(self):
        self.assertTrue(all(x['store'] is None and x['bot'] is None for x in C.values() if x['status']=='DENY'))
    def test_40_qa_source_has_fake_key_marker(self):
        code=N['Mint QA Server Session and 38 Browser Messages']['parameters']['jsCode']
        self.assertIn('QA_ONLY_V173_FAKE_PRIVATE_KEY_NEVER_PRODUCTION',code)
    def test_41_crypto_hmac_verifier(self):
        code=N['Validate HMAC Session Origin and Store Bot Policy']['parameters']['jsCode']
        self.assertIn('timingSafeEqual',code);self.assertIn('createHmac',code)
        self.assertIn('SESSION_BOT_STORE_PROFILE_CHANGED',code)
    def test_42_real_actions_disabled(self):
        self.assertEqual((O['all_provider_sends'],O['all_llm_calls'],O['all_commerce_writes']),(0,0,0))
        self.assertEqual(O['reply'],'MOCK_ONLY_NOT_SENT')
    def test_43_no_live_claims(self):
        self.assertFalse(O['real_website_session_issued'])
        self.assertFalse(O['hosted_store_rls_verified'])
        self.assertFalse(O['customer_cross_channel_identity_verified'])
    def test_44_public_website_untouched(self):
        self.assertIs(S['release']['public_website_code_changed'],False)
        self.assertIs(S['release']['marketing_bot_unchanged'],True)
    def test_45_no_real_production_secrets_or_webhook(self):
        x=json.dumps(S)
        for bad in ['n8n-nodes-base.webhook','n8n-nodes-base.httpRequest','sk-proj-','Bearer eyJ','googleSheetsOAuth2Api']:
            self.assertNotIn(bad,x)
    def test_46_no_cross_worker_replay_proof(self):
        self.assertIs(S['release']['atomic_cross_worker_claim_proven'],False)
    def test_47_no_billed_requests(self): self.assertEqual(S['release']['model_calls'],0)
    def test_48_qa_cases_do_not_store_session_token(self):
        self.assertTrue(all(set(c).issubset({'id','status','reason','store','bot','price_vnd'}) for c in C.values()))

if __name__=='__main__':
    unittest.main(verbosity=2)

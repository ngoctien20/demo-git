import importlib.util
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'tools' / 'probe_public.py'
spec = importlib.util.spec_from_file_location('probe_public', SOURCE)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

class ReadOnlyProbeTests(unittest.TestCase):
    def test_http_200_is_not_feature_readiness(self):
        self.assertEqual(probe.classify_http(200, 'https://ngoctien20.github.io/demo-git/'), 'REACHABLE')
    def test_auth_is_not_falsely_marked_healthy(self):
        self.assertEqual(probe.classify_http(401, probe.HUB_URL), 'AUTH_REQUIRED')
        self.assertEqual(probe.classify_http(403, probe.HUB_URL), 'AUTH_REQUIRED')
        self.assertEqual(probe.classify_http(200, probe.HUB_URL+'login'), 'AUTH_REQUIRED')
    def test_network_failure_stays_unknown(self):
        self.assertEqual(probe.classify_http(None, probe.HUB_URL), 'CONNECTION_ERROR')
    def test_no_gh_actions_invents_none(self):
        values = probe.latest_action_runs({'workflow_runs': []})
        self.assertEqual(len(values), 3)
        self.assertTrue(all(v['status'] == 'UNKNOWN' for v in values.values()))
    def test_gha_only_matches_correct_branch(self):
        values = probe.latest_action_runs({'workflow_runs': [
            {'name':'pages build and deployment', 'head_branch':'main','conclusion':'failure'},
            {'name':'pages build and deployment', 'head_branch':'gh-pages','conclusion':'success', 'status':'completed','head_sha':'abc'}
        ]})
        self.assertEqual(values['pages_deploy']['conclusion'],'success')
        self.assertEqual(values['browser_qa']['status'],'UNKNOWN')
    def test_invalid_url_rejected(self):
        with self.assertRaises(ValueError): probe.request('http://api.github.com/')
        with self.assertRaises(ValueError): probe.request('https://example.net/')

if __name__ == '__main__':
    unittest.main()
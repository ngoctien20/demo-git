import datetime as dt
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch
import urllib.error

SOURCE = Path(__file__).resolve().parents[1] / 'tools' / 'probe_public.py'
spec = importlib.util.spec_from_file_location('probe_public', SOURCE)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

class ReadOnlyProbeTests(unittest.TestCase):
    def test_200_is_connectivity_only(self):
        self.assertEqual(probe.classify_http(200, probe.WEBSITE_URL), 'REACHABLE')
    def test_401_or_403_is_auth_not_outage(self):
        for code in [401,403]:
            self.assertEqual(probe.classify_http(code, probe.HUB_URL),'AUTH_REQUIRED')
    def test_redirect_login_is_auth_even_with_relative_location(self):
        self.assertEqual(probe.classify_http(302,probe.HUB_URL,'/login?next=%2Fadmin'),'AUTH_REQUIRED')
        self.assertEqual(probe.classify_http(302,probe.HUB_URL,'https://auth.example.org/oauth/start'),'AUTH_REQUIRED')
        self.assertEqual(probe.classify_http(302,probe.HUB_URL,'/other'),'REDIRECT_UNVERIFIED')
    def test_network_and_server_errors_are_not_green(self):
        self.assertEqual(probe.classify_http(None,probe.HUB_URL),'CONNECTION_ERROR')
        self.assertEqual(probe.classify_http(429,probe.HUB_URL),'RATE_LIMITED')
        self.assertEqual(probe.classify_http(503,probe.HUB_URL),'SERVICE_ERROR')
    def test_login_path_cannot_mask_outage_or_missing_route(self):
        for code, expected in [(None, 'CONNECTION_ERROR'), (429, 'RATE_LIMITED'),
                               (503, 'SERVICE_ERROR'), (404, 'HTTP_ERROR')]:
            with self.subTest(code=code):
                self.assertEqual(probe.classify_http(code, probe.HUB_URL+'login'), expected)

    def test_github_403_reports_quota_evidence_without_exporting_headers(self):
        for headers, expected in [({'X-RateLimit-Remaining': '0'}, 'RATE_LIMITED'),
                                  ({'Retry-After': '60'}, 'RATE_LIMITED'),
                                  ({'X-RateLimit-Remaining': '50'}, 'AUTH_REQUIRED')]:
            with self.subTest(headers=headers):
                opener = MagicMock()
                opener.open.side_effect = urllib.error.HTTPError(
                    probe.GITHUB_ACTIONS, 403, 'Forbidden', headers, None)
                with patch.object(probe.urllib.request, 'build_opener', return_value=opener):
                    record, body = probe.request(probe.GITHUB_ACTIONS)
                self.assertEqual((record['status'], body), (expected, b''))
                self.assertNotIn('headers', record)
        self.assertEqual(probe.classify_http(403, probe.HUB_URL, headers={'Retry-After':'60'}), 'AUTH_REQUIRED')

    def test_only_expected_origins_are_allowed(self):
        for url in ['http://api.github.com/', 'https://example.net/',
                    'https://api.github.com:8443/repos/ngoctien20/demo-git/',
                    'https://bad@api.github.com/repos/ngoctien20/demo-git/']:
            with self.subTest(url=url), self.assertRaises(ValueError): probe.request(url)
    def test_repo_scoped_token_cannot_be_sent_to_site_or_other_repo(self):
        for url in [probe.HUB_URL, probe.WEBSITE_URL, 'https://api.github.com/repos/other/repo/actions/runs']:
            with self.subTest(url=url), self.assertRaises(ValueError): probe.request(url,authorization='SENSITIVE')
    def test_missing_workflows_are_unknown(self):
        v=probe.latest_action_runs({'workflow_runs':[]})
        self.assertEqual(len(v),3)
        self.assertTrue(all(x['status']=='UNKNOWN' for x in v.values()))
    def test_bad_github_schema_is_detectable(self):
        with self.assertRaises(ValueError):probe.latest_action_runs({'message':'rate limited'})
    def test_branch_filter_and_sorting_is_deterministic(self):
        data={'workflow_runs':[
          {'name':'pages build and deployment','head_branch':'gh-pages','conclusion':'failure','status':'completed','created_at':'2026-11-10T08:00:00Z','updated_at':'2026-11-10T08:01:00Z'},
          {'name':'pages build and deployment','head_branch':'main','conclusion':'failure','status':'completed','created_at':'2026-11-10T10:00:00Z'},
          {'name':'pages build and deployment','head_branch':'gh-pages','conclusion':'success','status':'completed','created_at':'2026-11-10T09:00:00Z','updated_at':'2026-11-10T09:01:00Z'},
        ]}
        v=probe.latest_action_runs(data,now=dt.datetime(2026,11,10,10,tzinfo=dt.timezone.utc))
        self.assertEqual(v['pages_deploy']['conclusion'],'success')
        self.assertEqual(v['browser_qa']['status'],'UNKNOWN')
    def test_successful_deploy_and_ref_alignment_are_distinct(self):
        data={'workflow_runs':[{'name':'pages build and deployment','head_branch':'gh-pages',
            'status':'completed','conclusion':'success','head_sha':'a'*40,
            'created_at':'2026-11-10T08:00:00Z','updated_at':'2026-11-10T08:01:00Z'}]}
        deployed=probe.last_successful_deploy(data)
        self.assertEqual(probe.release_alignment(deployed,'a'*40),'SAME_COMMIT')
        self.assertEqual(probe.release_alignment(deployed,'b'*40),'DEPLOY_BEHIND_BRANCH')
        self.assertEqual(probe.release_alignment(deployed,None),'UNKNOWN')
    def test_staleness_unknown_older_and_future(self):
        now=dt.datetime(2026,11,10,10,tzinfo=dt.timezone.utc)
        self.assertEqual(probe.freshness(None,now),'UNKNOWN')
        self.assertEqual(probe.freshness('2026-11-10T09:00:00Z',now),'FRESH')
        self.assertEqual(probe.freshness('2026-11-06T10:00:00Z',now),'STALE')
        self.assertEqual(probe.freshness('2026-11-12T10:00:00Z',now),'INVALID_FUTURE_TIMESTAMP')
    def test_http_302_location_header_is_not_dropped(self):
        m=MagicMock()
        m.open.side_effect=urllib.error.HTTPError(probe.HUB_URL,302,'Found',{'Location':'/login'},None)
        with patch.object(probe.urllib.request,'build_opener',return_value=m):
            response, body=probe.request(probe.HUB_URL)
        self.assertEqual(response['status'],'AUTH_REQUIRED')
        self.assertEqual(response['http_status'],302)
        self.assertEqual(body,b'')
    def test_serialized_output_carries_no_token_or_private_data(self):
        token='SHOULD_NOT_APPEAR_SECRET_TOKEN'
        def fake_request(url,authorization=None,timeout=12):
            if url==probe.GITHUB_ACTIONS:
                self.assertEqual(authorization,token)
                return {'status':'REACHABLE','checked_at':'2026-11-10T00:00:00+00:00'},json.dumps({'workflow_runs':[]}).encode()
            if url==probe.GITHUB_HEAD:
                return {'status':'REACHABLE','checked_at':'2026-11-10T00:00:00+00:00'},json.dumps({'object':{'sha':'a'*40}}).encode()
            return {'status':'AUTH_REQUIRED','http_status':401,'url':url,'checked_at':'2026-11-10T00:00:00+00:00'},b''
        with patch.dict(probe.os.environ,{'GITHUB_TOKEN':token}),patch.object(probe,'request',side_effect=fake_request):
            report=probe.collect()
        value=json.dumps(report)
        self.assertNotIn(token,value)
        self.assertEqual(report['release_readiness'],'NOT_VERIFIED')
        self.assertEqual(report['sources']['n8n']['status'],'UNKNOWN')
        self.assertEqual(report['sources']['github_actions']['release_alignment'],'UNKNOWN')
    def test_no_secret_leak_when_git_hub_unavailable(self):
        def fake_request(url, authorization=None, timeout=12):
            if 'api.github.com' in url:return {'status':'RATE_LIMITED','checked_at':'2026-11-10T00:00:00Z'},b''
            return {'status':'CONNECTION_ERROR','http_status':None,'url':url,'checked_at':'2026-11-10T00:00:00Z'},b''
        with patch.object(probe,'request',side_effect=fake_request):
            s=probe.collect()
        self.assertEqual(s['sources']['github_actions']['release_alignment'],'UNKNOWN')
        self.assertEqual(s['sources']['github_actions']['runs'],{})
        self.assertEqual(s['sources']['control_hub']['status'],'CONNECTION_ERROR')

if __name__=='__main__':
    unittest.main()
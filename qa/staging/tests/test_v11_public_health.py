"""Pure fixture tests for read-only HTTP staging smoke; no network access."""
import json
import pathlib
import sys
import unittest

sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
import verify_v11_public_health as probe

def good_fetch(url, headers=None):
    if url.endswith("/health"):
        payload={"mode":"staging","status":"CONFIGURED_NOT_VERIFIED",
                 "production_readiness":"NOT_APPROVED","database_connected":False}
        return 200,{},json.dumps(payload).encode()
    if url.endswith("/api/v1/tenants"):
        return 401,{},b'{"detail":"AUTH_REQUIRED"}'
    return 200,{"Content-Type":"text/html"},b"<!doctype html>"

class PublicHealthSmokeTests(unittest.TestCase):
    def test_expected_urls_and_auth_denial(self):
        observed=probe.run_suite(good_fetch)
        self.assertEqual(len(observed),6)
        self.assertEqual([status for name,status in observed],[200,200,200,200,401,401])
    def test_wrong_anon_status_fails(self):
        def wrong(url,headers=None):
            if url.endswith("/api/v1/tenants"):return 200,{},b"[]"
            return good_fetch(url,headers=headers)
        with self.assertRaisesRegex(probe.SmokeFailure,"anonymous_tenant_denial"):
            probe.run_suite(wrong)
    def test_wrong_staging_status_fails(self):
        def wrong(url,headers=None):
            if url.endswith("/health"):
                return 200,{},json.dumps({"mode":"production","database_connected":True,
                    "production_readiness":"READY","status":"LIVE"}).encode()
            return good_fetch(url,headers=headers)
        with self.assertRaisesRegex(probe.SmokeFailure,"UNSAFE_OR_UNEXPECTED_HEALTH_CONTRACT"):
            probe.run_suite(wrong)
    def test_bad_health_json_fails(self):
        def wrong(url,headers=None):
            if url.endswith("/health"):return 200,{},b"<html>error</html>"
            return good_fetch(url,headers=headers)
        with self.assertRaisesRegex(probe.SmokeFailure,"BAD_HEALTH_JSON"):
            probe.run_suite(wrong)
    def test_wrong_forged_bearer_status_fails(self):
        def wrong(url,headers=None):
            if url.endswith("/api/v1/tenants") and headers:return 403,{},b""
            return good_fetch(url,headers=headers)
        with self.assertRaisesRegex(probe.SmokeFailure,"forged_bearer_denial"):
            probe.run_suite(wrong)

    def test_transient_503_cold_start_is_recorded_and_recovered(self):
        from unittest.mock import patch
        responses=iter([(503,{},b""),(503,{},b""),(200,{},b"ok")])
        with patch.object(probe,"request_once",side_effect=lambda url,headers=None:next(responses)) as req, patch.object(probe.time,"sleep") as sleeper:
            self.assertEqual(probe.request_with_retry(probe.RENDER_DATA+"/health")[0],200)
            self.assertEqual(req.call_count,3)
            self.assertEqual(sleeper.call_count,2)
    def test_persistent_503_never_becomes_pass(self):
        from unittest.mock import patch
        with patch.object(probe,"request_once",return_value=(503,{},b"")) as req, patch.object(probe.time,"sleep"):
            status,_,_=probe.request_with_retry(probe.RENDER_DATA+"/health")
            self.assertEqual(status,503)
            self.assertEqual(req.call_count,12)
if __name__=="__main__":
    unittest.main()

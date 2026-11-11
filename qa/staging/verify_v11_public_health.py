"""Read-only V11 hosted HTTP smoke. Never uses credentials or customer endpoints.

This proves HTTPS/anonymous boundaries only. It does NOT prove a deployment SHA,
Supabase authenticated sessions, tenant isolation, business readiness or billing.
"""
from __future__ import annotations

import json
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

CLOUDFLARE = "https://tien404-ai-git-staging.pages.dev/"
GITHUB_PAGES = "https://ngoctien20.github.io/demo-git/"
RENDER_AUTH = "https://tien404-auth-staging.onrender.com/login.html"
RENDER_DATA = "https://tien404-data-staging.onrender.com"

class SmokeFailure(Exception):
    pass

def request_once(url: str, headers: dict[str, str] | None = None) -> tuple[int, dict[str, str], bytes]:
    req=Request(url, headers={
        "Accept": "application/json, text/html",
        "User-Agent": "TIEN404-V11-readonly-qa/1.0",
        **(headers or {})
    }, method="GET")
    try:
        with urlopen(req, timeout=20) as res:
            return res.status, dict(res.headers.items()), res.read(8192)
    except HTTPError as err:
        with err:
            return err.code, dict(err.headers.items()), err.read(4096)

def request_with_retry(url: str, headers: dict[str, str] | None = None):
    for attempt in range(3):
        try:
            status,hdr,data=request_once(url,headers=headers)
            if status not in (502,503,504) or attempt==2:
                return status,hdr,data
        except (TimeoutError,URLError):
            if attempt==2:
                raise SmokeFailure("CONNECTIVITY_UNAVAILABLE")
        time.sleep(4)
    raise SmokeFailure("HTTP_UNAVAILABLE")

def assert_status(label: str, observed: int, wanted: int):
    if observed != wanted:
        raise SmokeFailure(f"{label}: expected HTTP {wanted}, observed HTTP {observed}")

def run_suite(fetcher=request_with_retry):
    observations=[]
    for label,url in (
        ("cloudflare_canonical",CLOUDFLARE),
        ("github_pages",GITHUB_PAGES),
        ("render_auth_login",RENDER_AUTH)
    ):
        status,headers,body=fetcher(url)
        assert_status(label,status,200)
        observations.append((label,status))
    status,headers,body=fetcher(RENDER_DATA+"/health")
    assert_status("render_data_health",status,200)
    try:
        data=json.loads(body)
    except (ValueError,UnicodeDecodeError) as error:
        raise SmokeFailure("BAD_HEALTH_JSON") from error
    if not isinstance(data,dict) or data.get("mode")!="staging" or data.get("production_readiness")!="NOT_APPROVED" or data.get("database_connected") is not False:
        raise SmokeFailure("UNSAFE_OR_UNEXPECTED_HEALTH_CONTRACT")
    if data.get("status") not in ("CONFIGURED_NOT_VERIFIED","UNKNOWN"):
        raise SmokeFailure("UNREVIEWED_HEALTH_STATUS")
    observations.append(("render_data_health",status))
    status,headers,body=fetcher(RENDER_DATA+"/api/v1/tenants")
    assert_status("anonymous_tenant_denial",status,401)
    observations.append(("anonymous_tenant_denial",status))
    status,headers,body=fetcher(RENDER_DATA+"/api/v1/tenants",headers={"Authorization":"Bearer "+("x"*48)})
    assert_status("forged_bearer_denial",status,401)
    observations.append(("forged_bearer_denial",status))
    return observations

if __name__=="__main__":
    try:
        for name,status in run_suite():
            print(f"PASS {name} HTTP {status}")
        print("STAGING_PUBLIC_SMOKE_PASS: public URLs and denial boundaries only. Auth E2E remains BLOCKED.")
    except (SmokeFailure,URLError,TimeoutError) as error:
        # Do not print body, tokens, customer data or full request URLs.
        print("STAGING_PUBLIC_SMOKE_FAIL: "+(str(error) if isinstance(error,SmokeFailure) else type(error).__name__),file=sys.stderr)
        raise SystemExit(1)

"""Live, credential-injected Supabase Auth + tenant isolation acceptance suite.

No implicit sign-up, no test-account creation, no writes, no token/password
logging and no production endpoints. Supply TWO separately created staging
QA accounts through secure environment variables, never through a commit.
"""
from __future__ import annotations
import os
import sys
from urllib.parse import urlparse
import httpx

SUPABASE = "https://ifxlvrhyjhbzbrkdsida.supabase.co"
GATEWAY = "https://tien404-data-staging.onrender.com"
REQUIRED = (
    "TIEN404_QA_PUBLISHABLE_KEY",
    "TIEN404_QA_A_EMAIL", "TIEN404_QA_A_PASSWORD", "TIEN404_QA_A_TENANT",
    "TIEN404_QA_B_EMAIL", "TIEN404_QA_B_PASSWORD", "TIEN404_QA_B_TENANT",
)

class TestFailure(Exception):
    pass

def demand(ok: bool, reason: str) -> None:
    if not ok:
        raise TestFailure(reason)

def acquire(client: httpx.Client, key: str, email: str, password: str) -> dict:
    res = client.post(
        SUPABASE + "/auth/v1/token?grant_type=password",
        headers={"apikey": key, "Content-Type": "application/json"},
        json={"email": email, "password": password},
    )
    demand(res.status_code == 200, "LOGIN_FAIL HTTP " + str(res.status_code))
    body = res.json()
    demand(bool(body.get("access_token")) and bool(body.get("refresh_token")), "LOGIN_NO_TOKENS")
    return body

def refresh(client: httpx.Client, key: str, refresh_token: str) -> dict:
    res = client.post(
        SUPABASE + "/auth/v1/token?grant_type=refresh_token",
        headers={"apikey": key, "Content-Type": "application/json"},
        json={"refresh_token": refresh_token},
    )
    demand(res.status_code == 200, "REFRESH_FAIL HTTP " + str(res.status_code))
    body = res.json()
    demand(bool(body.get("access_token")), "REFRESH_NO_ACCESS_TOKEN")
    return body

def check_tenant(client: httpx.Client, token: str, own: str, other: str) -> tuple[tuple, tuple]:
    headers = {"Authorization": "Bearer " + token}
    me = client.get(GATEWAY + "/api/v1/tenants", headers=headers)
    demand(me.status_code == 200, "TENANT_LIST_FAIL HTTP " + str(me.status_code))
    items = me.json().get("items", [])
    demand(any(row.get("tenant_id") == own for row in items), "OWN_MEMBERSHIP_MISSING")
    demand(not any(row.get("tenant_id") == other for row in items), "FOREIGN_MEMBERSHIP_EXPOSED")
    fingerprints = []
    for kind in ("products", "orders"):
        own_res = client.get(GATEWAY + "/api/v1/tenants/" + own + "/" + kind, headers=headers)
        demand(own_res.status_code == 200, "OWN_" + kind.upper() + "_HTTP_" + str(own_res.status_code))
        payload = own_res.json()
        rows = payload.get("items", [])
        demand(isinstance(rows, list), "INVALID_" + kind.upper() + "_PAYLOAD")
        demand(all(row.get("tenant_id") == own for row in rows), "CROSS_TENANT_ROW_LEAK")
        foreign = client.get(GATEWAY + "/api/v1/tenants/" + other + "/" + kind, headers=headers)
        demand(foreign.status_code == 404, "FOREIGN_" + kind.upper() + "_HTTP_" + str(foreign.status_code))
        # Compare stable IDs and counts only, never print customer data.
        fingerprints.append(tuple(sorted(str(row["id"]) for row in rows)))
    return tuple(fingerprints)

def run() -> int:
    missing = [key for key in REQUIRED if not os.getenv(key)]
    if missing:
        print("NOT_RUN: credentials or test tenant IDs missing: " + ", ".join(missing))
        return 2
    a, b = os.environ["TIEN404_QA_A_TENANT"], os.environ["TIEN404_QA_B_TENANT"]
    demand(a != b, "QA_TENANTS_MUST_BE_DISTINCT")
    key = os.environ["TIEN404_QA_PUBLISHABLE_KEY"]
    with httpx.Client(timeout=25, follow_redirects=False) as client:
        anonymous = client.get(GATEWAY + "/api/v1/tenants")
        demand(anonymous.status_code == 401, "ANONYMOUS_AUTH_BYPASS")
        for suffix, own, other in (("A", a, b), ("B", b, a)):
            tokens = acquire(client, key, os.environ["TIEN404_QA_" + suffix + "_EMAIL"],
                             os.environ["TIEN404_QA_" + suffix + "_PASSWORD"])
            original = check_tenant(client, tokens["access_token"], own, other)
            renewed = refresh(client, key, tokens["refresh_token"])
            reread = check_tenant(client, renewed["access_token"], own, other)
            demand(original == reread, "DATA_CHANGED_ACROSS_TOKEN_REFRESH_" + suffix)
            print("QA_" + suffix + ": LOGIN_PASS, TENANT_ISOLATION_PASS, TOKEN_REFRESH_PASS, DATA_REREAD_PASS")
    print("PASS: Live Auth + both tenant scopes + refreshed tokens; no customer writes performed.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(run())
    except (httpx.HTTPError, ValueError, KeyError, TestFailure) as exc:
        # Never include HTTP bodies, tokens, passwords or user emails in logs.
        label = str(exc) if isinstance(exc, TestFailure) else type(exc).__name__
        print("FAIL: " + label, file=sys.stderr)
        raise SystemExit(1)

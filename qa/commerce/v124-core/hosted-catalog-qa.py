"""Read-only acceptance with the project's two existing merchant QA accounts.
Only summarize status/visibility. Never emit a row, bearer token or login identifier.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "notification"))
from staging_conflict import SHOPS, request


def require(condition, label):
    if not condition:
        raise RuntimeError(label)
    print("PASS", label, flush=True)


def lookup(tenant):
    return "/rest/v1/products?select=tenant_id&tenant_id=eq." + tenant + "&limit=1"


def verify():
    status, rows = request("GET", lookup(SHOPS["A"]))
    require((status == 200 and rows == []) or status in (401, 403), "anonymous has no private product row")
    for shop, tenant in SHOPS.items():
        status, auth = request("POST", "/auth/v1/token?grant_type=password", body={
            "email": os.environ["TIEN404_QA_" + shop + "_EMAIL"],
            "password": os.environ["TIEN404_QA_" + shop + "_PASSWORD"]})
        require(status == 200 and isinstance(auth.get("access_token"), str), "Shop " + shop + " signs in")
        token = auth["access_token"]
        try:
            own_status, own_rows = request("GET", lookup(tenant), token)
            require(own_status == 200 and own_rows == [{"tenant_id": tenant}], "Shop " + shop + " sees its own fixture")
            other = next(value for value in SHOPS.values() if value != tenant)
            other_status, other_rows = request("GET", lookup(other), token)
            require(other_status == 200 and other_rows == [], "Shop " + shop + " sees zero other-shop rows")
        finally:
            require(request("POST", "/auth/v1/logout?scope=local", token)[0] in (200, 204), "Shop " + shop + " QA session closed")


if __name__ == "__main__":
    try:
        verify()
    except Exception as error:
        print("FAIL hosted QA:", str(error) if isinstance(error, RuntimeError) else type(error).__name__)
        sys.exit(1)

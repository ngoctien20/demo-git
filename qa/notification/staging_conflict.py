"""Private read/negative-write proof. Only the two dedicated staging QA shops."""
import json
import os
import sys
import urllib.error
import urllib.request
from uuid import uuid4

BASE = "https://ifxlvrhyjhbzbrkdsida.supabase.co"
SHOPS = {"A":"9c8c524c-88db-4771-8ab0-a4316298494c","B":"4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5"}


def request(method, path, token=None, body=None):
    headers = {"apikey": os.environ["QA_PUBLIC_KEY"], "Content-Type":"application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, method=method, headers=headers,
                                 data=None if body is None else json.dumps(body).encode())
    try:
        response = urllib.request.urlopen(req, timeout=25)
    except urllib.error.HTTPError as exc:
        response = exc
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if raw else None


def verify(label, tenant):
    status, data = request("POST", "/auth/v1/token?grant_type=password", body={
        "email": os.environ["TIEN404_QA_" + label + "_EMAIL"],
        "password": os.environ["TIEN404_QA_" + label + "_PASSWORD"]})
    assert status == 200, "login"
    token = data["access_token"]
    try:
        sku = "QA-CONFLICT-" + uuid4().hex
        lookup = f"/rest/v1/products?select=sku&tenant_id=eq.{tenant}&sku=eq.{sku}"
        assert request("GET", lookup, token) == (200, []), "absent SKU required"
        payload = dict(p_tenant=tenant,p_sku=sku,p_name="QA",p_price=1,p_active=False,
                       p_initial_stock=None,p_expected_updated_at="1970-01-01T00:00:00Z")
        status, result = request("POST","/rest/v1/rpc/save_merchant_product",token,payload)
        assert status == 409 and result.get("code") == "PT409", "terminal conflict"
        assert request("GET", lookup, token) == (200, []), "negative write readback"
    finally:
        assert request("POST","/auth/v1/logout?scope=local",token)[0] in (200,204), "logout"
    print(f"PASS Shop {label}: one RPC request, HTTP 409/PT409, absent before/after, local logout")


if __name__ == "__main__":
    try:
        for label, tenant in SHOPS.items():
            verify(label, tenant)
    except Exception as exc:
        print("FAIL:", label, str(exc) if isinstance(exc, AssertionError) else type(exc).__name__)
        sys.exit(1)

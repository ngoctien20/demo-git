"""Replay the exact Render-deployed main.py against synthetic HTTP transports only.

No network, real JWT, Supabase credentials, customer data, writes or provider sends.
"""
import asyncio
import socket
from urllib.parse import parse_qs

import httpx
import pytest

from deployed_fixture.app.main import Settings, create_app

TENANT = "11111111-1111-4111-8111-111111111111"
STORE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
STORE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
OTHER_TENANT = "22222222-2222-4222-8222-222222222222"
ACTOR_A = "10000000-0000-4000-8000-000000000001"
ACTOR_B = "10000000-0000-4000-8000-000000000002"
TOKEN = "synthetic-access-token-012345678901234567890123456789"
BASE = f"/api/v1/tenants/{TENANT}/orders"

ORDERS = [
    {"id": "aaaaaaaa-0000-4000-8000-000000000001", "tenant_id": TENANT,
     "store_id": STORE_A, "status": "pending", "total_vnd": 159000,
     "created_at": "2026-11-18T00:00:00Z"},
    {"id": "bbbbbbbb-0000-4000-8000-000000000002", "tenant_id": TENANT,
     "store_id": STORE_B, "status": "pending", "total_vnd": 199000,
     "created_at": "2026-11-18T00:01:00Z"},
]


def build_app(*, actor=ACTOR_A, role="owner", membership_payload=None,
              orders_payload=None, auth_status=200, membership_status=200,
              orders_status=200, configured=True):
    requests = []
    if membership_payload is None:
        membership_payload = [{"tenant_id": TENANT, "role": role}]
    if orders_payload is None:
        orders_payload = ORDERS

    def handler(request: httpx.Request):
        requests.append(request)
        if request.url.path == "/auth/v1/user":
            if auth_status != 200:
                return httpx.Response(auth_status, json={"message": "synthetic auth failure"})
            return httpx.Response(200, json={"id": actor})
        if request.url.path == "/rest/v1/tenant_memberships":
            if membership_status != 200:
                return httpx.Response(membership_status, json={"message": "synthetic membership failure"})
            return httpx.Response(200, json=membership_payload)
        if request.url.path == "/rest/v1/orders":
            if orders_status != 200:
                return httpx.Response(orders_status, json={"message": "synthetic order failure"})
            return httpx.Response(200, json=orders_payload)
        if request.url.path == "/rest/v1/products":
            return httpx.Response(200, json=[{
                "id": "cccccccc-0000-4000-8000-000000000003",
                "tenant_id": TENANT, "sku": "QA-ONLY", "name": "Synthetic product",
                "price_vnd": 159000, "stock_on_hand": 3, "is_active": True,
                "updated_at": "2026-11-18T00:00:00Z", "store_id": STORE_A
            }])
        return httpx.Response(404, json={"message": "synthetic not found"})

    transport = httpx.MockTransport(handler)
    settings = Settings(
        supabase_url="https://supabase.synthetic.invalid" if configured else None,
        publishable_key="synthetic-publishable-key" if configured else None,
        allowed_origin="https://widget.synthetic.invalid",
        mode="staging",
    )
    return create_app(settings, transport=transport), requests


async def _request(app, method="GET", path=BASE, headers=None):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://gateway.synthetic.invalid",
    ) as client:
        return await client.request(method, path, headers=headers or {})


def request(app, method="GET", path=BASE, headers=None):
    return asyncio.run(_request(app, method, path, headers))



@pytest.fixture(autouse=True)
def deny_all_real_network(monkeypatch):
    def blocked(*args, **kwargs):
        raise AssertionError("REAL_NETWORK_DISABLED_IN_V1725P_TESTS")
    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket, "create_connection", blocked)

def auth_headers():
    return {"Authorization": f"Bearer {TOKEN}"}


@pytest.mark.parametrize("actor", [ACTOR_A, ACTOR_B])
def test_exact_deployed_legacy_owner_route_is_tenant_wide_for_both_actors(actor):
    app, outbound = build_app(actor=actor, role="owner")
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 200
    assert len(response.json()["items"]) == 2
    assert {row["id"] for row in response.json()["items"]} == {ORDERS[0]["id"], ORDERS[1]["id"]}
    order_request = next(x for x in outbound if x.url.path == "/rest/v1/orders")
    params = order_request.url.params
    assert params["tenant_id"] == f"eq.{TENANT}"
    assert "store_id" not in params
    assert "store_id" not in params["select"]
    assert order_request.method == "GET"
    assert order_request.headers["authorization"] == f"Bearer {TOKEN}"


def test_client_supplied_store_query_parameter_does_not_scope_legacy_route():
    app, outbound = build_app()
    response = request(app, path=f"{BASE}?store_id={STORE_A}", headers=auth_headers())
    assert response.status_code == 200
    assert len(response.json()["items"]) == 2
    order_request = next(x for x in outbound if x.url.path == "/rest/v1/orders")
    assert "store_id" not in order_request.url.params


def test_legacy_order_response_does_not_leak_unselected_store_id_field():
    app, _ = build_app()
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 200
    assert all("store_id" not in item for item in response.json()["items"])
    assert response.headers["Cache-Control"] == "no-store"


@pytest.mark.parametrize("role", ["owner", "manager"])
def test_owner_and_manager_are_the_only_roles_allowed_to_list_orders(role):
    app, outbound = build_app(role=role)
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 200
    assert any(x.url.path == "/rest/v1/orders" for x in outbound)


def test_staff_membership_is_denied_before_orders_query():
    app, outbound = build_app(role="staff")
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 403
    assert response.json()["detail"] == "ROLE_DENIED"
    assert not any(x.url.path == "/rest/v1/orders" for x in outbound)


def test_missing_membership_is_hidden_as_tenant_not_found():
    app, outbound = build_app(membership_payload=[])
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 404
    assert response.json()["detail"] == "TENANT_NOT_FOUND"
    assert not any(x.url.path == "/rest/v1/orders" for x in outbound)


def test_cross_tenant_membership_response_fails_closed():
    app, outbound = build_app(membership_payload=[{"tenant_id": OTHER_TENANT, "role": "owner"}])
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 502
    assert response.json()["detail"] == "PROVIDER_TENANT_SCOPE_VIOLATION"
    assert not any(x.url.path == "/rest/v1/orders" for x in outbound)


def test_cross_tenant_order_response_fails_closed():
    fake = [dict(ORDERS[0], tenant_id=OTHER_TENANT)]
    app, _ = build_app(orders_payload=fake)
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 502
    assert response.json()["detail"] == "PROVIDER_TENANT_SCOPE_VIOLATION"


def test_missing_auth_is_rejected_without_provider_request():
    app, outbound = build_app()
    response = request(app, path=BASE)
    assert response.status_code == 401
    assert response.json()["detail"] == "AUTH_REQUIRED"
    assert outbound == []


@pytest.mark.parametrize("authorization", [
    "Bearer short", "Basic synthetic-user", "Bearer " + ("x" * 4001),
])
def test_invalid_auth_format_is_rejected_without_provider_request(authorization):
    app, outbound = build_app()
    response = request(app, path=BASE, headers={"Authorization": authorization})
    assert response.status_code == 401
    assert response.json()["detail"] in {"AUTH_REQUIRED", "INVALID_TOKEN_FORMAT"}
    assert outbound == []


def test_invalid_supabase_session_is_rejected():
    app, _ = build_app(auth_status=401)
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 401
    assert response.json()["detail"] == "INVALID_SESSION"


def test_provider_rate_limit_fails_closed():
    app, _ = build_app(orders_status=429)
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 503
    assert response.json()["detail"] == "PROVIDER_RATE_LIMITED"


def test_provider_service_error_fails_closed():
    app, _ = build_app(orders_status=500)
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 503
    assert response.json()["detail"] == "PROVIDER_SERVICE_ERROR"


def test_provider_non_json_fails_closed():
    def handler(request):
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": ACTOR_A})
        if request.url.path == "/rest/v1/tenant_memberships":
            return httpx.Response(200, json=[{"tenant_id": TENANT, "role": "owner"}])
        if request.url.path == "/rest/v1/orders":
            return httpx.Response(200, content=b"not-json", headers={"Content-Type": "application/json"})
        return httpx.Response(404)
    app = create_app(Settings("https://supabase.synthetic.invalid", "synthetic-publishable-key"),
                     transport=httpx.MockTransport(handler))
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 502
    assert response.json()["detail"] == "PROVIDER_BAD_RESPONSE"


@pytest.mark.parametrize("limit", [0, 101, -1])
def test_order_limit_out_of_range_is_rejected(limit):
    app, _ = build_app()
    response = request(app, path=f"{BASE}?limit={limit}", headers=auth_headers())
    assert response.status_code == 422


def test_order_limit_is_bounded_and_passed_to_provider():
    app, outbound = build_app()
    response = request(app, path=f"{BASE}?limit=25", headers=auth_headers())
    assert response.status_code == 200
    order_request = next(x for x in outbound if x.url.path == "/rest/v1/orders")
    assert order_request.url.params["limit"] == "25"


def test_product_route_remains_tenant_scoped_and_sanitizes_store_field():
    app, outbound = build_app()
    path = f"/api/v1/tenants/{TENANT}/products"
    response = request(app, path=path, headers=auth_headers())
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert "store_id" not in response.json()["items"][0]
    product_request = next(x for x in outbound if x.url.path == "/rest/v1/products")
    assert product_request.url.params["tenant_id"] == f"eq.{TENANT}"
    assert "store_id" not in product_request.url.params


def test_health_does_not_claim_database_connectivity_or_production_readiness():
    app, outbound = build_app()
    response = request(app, path="/health")
    assert response.status_code == 200
    assert response.json()["database_connected"] is False
    assert response.json()["production_readiness"] == "NOT_APPROVED"
    assert outbound == []


def test_security_headers_are_preserved_on_exact_source_route():
    app, _ = build_app()
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"


def test_legacy_order_route_has_no_mutating_method():
    app, outbound = build_app()
    response = request(app, method="POST", path=BASE, headers=auth_headers())
    assert response.status_code == 405
    assert not any(x.url.path == "/rest/v1/orders" for x in outbound)


def test_production_mode_is_rejected_by_deployed_settings_contract():
    with pytest.raises(ValueError, match="production release gate"):
        Settings(mode="production")


def test_unconfigured_app_fails_closed_before_provider_access():
    app, outbound = build_app(configured=False)
    response = request(app, path=BASE, headers=auth_headers())
    assert response.status_code == 503
    assert response.json()["detail"] == "NOT_CONFIGURED"
    assert outbound == []

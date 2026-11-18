"""Negative Store isolation tests. All identities and records are synthetic."""
import asyncio
import socket

import httpx
import pytest

from store_api_contract import (
    Registry, Store, StoreMembership, TenantMembership,
    create_app, idempotency_scope, resolve_store_scope,
    validate_idempotency_key, validate_order_create_body,
)

T1 = "11111111-1111-4111-8111-111111111111"
T2 = "22222222-2222-4222-8222-222222222222"
A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
PAUSED = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
ARCHIVED = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

OWNER_A = "10000000-0000-4000-8000-000000000001"
OWNER_B = "10000000-0000-4000-8000-000000000002"
OWNER_AB = "10000000-0000-4000-8000-000000000003"
MANAGER_A = "10000000-0000-4000-8000-000000000004"
STAFF_A = "10000000-0000-4000-8000-000000000005"
TENANT_ONLY = "10000000-0000-4000-8000-000000000006"
INACTIVE_TENANT = "10000000-0000-4000-8000-000000000007"
INACTIVE_STORE = "10000000-0000-4000-8000-000000000008"
CROSS_TENANT = "20000000-0000-4000-8000-000000000001"
TENANT_STAFF_STORE_OWNER = "10000000-0000-4000-8000-000000000009"
TENANT_OWNER_STORE_STAFF = "10000000-0000-4000-8000-000000000010"

OA = "a1000000-0000-4000-8000-000000000001"
OB = "b1000000-0000-4000-8000-000000000002"
OC = "c1000000-0000-4000-8000-000000000003"
OP = "d1000000-0000-4000-8000-000000000004"

TOKENS = {
    "qa-owner-a-token": OWNER_A,
    "qa-owner-b-token": OWNER_B,
    "qa-owner-ab-token": OWNER_AB,
    "qa-manager-a-token": MANAGER_A,
    "qa-staff-a-token": STAFF_A,
    "qa-tenant-only-token": TENANT_ONLY,
    "qa-inactive-tenant-token": INACTIVE_TENANT,
    "qa-inactive-store-token": INACTIVE_STORE,
    "qa-cross-tenant-token": CROSS_TENANT,
    "qa-tenant-staff-store-owner-token": TENANT_STAFF_STORE_OWNER,
    "qa-tenant-owner-store-staff-token": TENANT_OWNER_STORE_STAFF,
}
IDEM = "qa-idempotency-key-0001"


def make_registry():
    tenant_memberships = [
        TenantMembership(T1, OWNER_A, "owner"),
        TenantMembership(T1, OWNER_B, "owner"),
        TenantMembership(T1, OWNER_AB, "owner"),
        TenantMembership(T1, MANAGER_A, "manager"),
        TenantMembership(T1, STAFF_A, "staff"),
        TenantMembership(T1, TENANT_ONLY, "owner"),
        TenantMembership(T1, INACTIVE_TENANT, "owner", False),
        TenantMembership(T1, INACTIVE_STORE, "owner"),
        TenantMembership(T2, CROSS_TENANT, "owner"),
        TenantMembership(T1, TENANT_STAFF_STORE_OWNER, "staff"),
        TenantMembership(T1, TENANT_OWNER_STORE_STAFF, "owner"),
    ]
    stores = [
        Store(T1, A, "Store A"),
        Store(T1, B, "Store B"),
        Store(T2, C, "Store C"),
        Store(T1, PAUSED, "Paused Store", "paused"),
        Store(T1, ARCHIVED, "Archived Store", "archived"),
    ]
    memberships = [
        StoreMembership(T1, A, OWNER_A, "owner"),
        StoreMembership(T1, B, OWNER_B, "owner"),
        StoreMembership(T1, A, OWNER_AB, "owner"),
        StoreMembership(T1, B, OWNER_AB, "owner"),
        StoreMembership(T1, A, MANAGER_A, "manager"),
        StoreMembership(T1, A, STAFF_A, "staff"),
        StoreMembership(T1, A, INACTIVE_TENANT, "owner"),
        StoreMembership(T1, A, INACTIVE_STORE, "owner", False),
        StoreMembership(T2, C, CROSS_TENANT, "owner"),
        StoreMembership(T1, A, TENANT_STAFF_STORE_OWNER, "owner"),
        StoreMembership(T1, A, TENANT_OWNER_STORE_STAFF, "staff"),
        StoreMembership(T1, PAUSED, OWNER_A, "owner"),
        StoreMembership(T1, ARCHIVED, OWNER_A, "owner"),
    ]
    products = [
        {"id": "pa-00000000-0000-4000-8000-000000000001", "tenant_id": T1, "store_id": A, "sku": "A-1"},
        {"id": "pb-00000000-0000-4000-8000-000000000002", "tenant_id": T1, "store_id": B, "sku": "B-1"},
        {"id": "pc-00000000-0000-4000-8000-000000000003", "tenant_id": T2, "store_id": C, "sku": "C-1"},
    ]
    orders = [
        {"id": OA, "tenant_id": T1, "store_id": A, "created_by_user_id": OWNER_A, "total_vnd": 159000},
        {"id": OB, "tenant_id": T1, "store_id": B, "created_by_user_id": OWNER_B, "total_vnd": 199000},
        {"id": OC, "tenant_id": T2, "store_id": C, "created_by_user_id": CROSS_TENANT, "total_vnd": 259000},
        {"id": OP, "tenant_id": T1, "store_id": PAUSED, "created_by_user_id": OWNER_A, "total_vnd": 99000},
    ]
    order_items = [
        {"id": "ia-00000000-0000-4000-8000-000000000001", "tenant_id": T1, "store_id": A, "order_id": OA, "product_id": products[0]["id"]},
        {"id": "ib-00000000-0000-4000-8000-000000000002", "tenant_id": T1, "store_id": B, "order_id": OB, "product_id": products[1]["id"]},
    ]
    customers = [
        {"id": "ca-00000000-0000-4000-8000-000000000001", "tenant_id": T1, "store_id": A, "display_name": "Synthetic A"},
        {"id": "cb-00000000-0000-4000-8000-000000000002", "tenant_id": T1, "store_id": B, "display_name": "Synthetic B"},
    ]
    conversations = [
        {"id": "d1000000-0000-4000-8000-000000000001", "tenant_id": T1, "store_id": A, "channel": "messenger"},
        {"id": "d2000000-0000-4000-8000-000000000002", "tenant_id": T1, "store_id": B, "channel": "zalo"},
    ]
    messages = [
        {"id": "ma-00000000-0000-4000-8000-000000000001", "tenant_id": T1, "store_id": A,
         "conversation_id": conversations[0]["id"], "body": "Synthetic A"},
        {"id": "mb-00000000-0000-4000-8000-000000000002", "tenant_id": T1, "store_id": B,
         "conversation_id": conversations[1]["id"], "body": "Synthetic B"},
    ]
    return Registry(tenant_memberships, stores, memberships, products, orders,
                    order_items, customers, conversations, messages)


def make_app(legacy_state="BLOCKED_PRE_CUTOVER"):
    return create_app(make_registry(), tokens=TOKENS, legacy_state=legacy_state)


async def _request(app, method, path, token="qa-owner-a-token", headers=None, json=None):
    h = dict(headers or {})
    if token is not None:
        h.setdefault("Authorization", f"Bearer {token}")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://v1725q.synthetic.invalid",
    ) as client:
        return await client.request(method, path, headers=h, json=json)


def request(app, method, path, token="qa-owner-a-token", headers=None, json=None):
    return asyncio.run(_request(app, method, path, token, headers, json))


@pytest.fixture(autouse=True)
def deny_real_network(monkeypatch):
    def blocked(*args, **kwargs):
        raise AssertionError("V1725Q_REAL_NETWORK_DISABLED")
    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket, "create_connection", blocked)


def orders_path(tenant=T1, store=A):
    return f"/api/v2/tenants/{tenant}/stores/{store}/orders"


def test_owner_a_reads_only_store_a_orders():
    response = request(make_app(), "GET", orders_path(), "qa-owner-a-token")
    assert response.status_code == 200
    assert [x["id"] for x in response.json()["items"]] == [OA]
    assert response.json()["scope"] == {"tenant_id": T1, "store_id": A}


def test_owner_a_cannot_read_store_b_even_when_same_tenant_owner():
    response = request(make_app(), "GET", orders_path(store=B), "qa-owner-a-token")
    assert response.status_code == 404
    assert response.json()["detail"] == "STORE_NOT_FOUND_OR_NOT_AUTHORIZED"


def test_owner_b_reads_only_store_b_orders():
    response = request(make_app(), "GET", orders_path(store=B), "qa-owner-b-token")
    assert response.status_code == 200
    assert [x["id"] for x in response.json()["items"]] == [OB]


def test_owner_b_cannot_read_store_a():
    response = request(make_app(), "GET", orders_path(), "qa-owner-b-token")
    assert response.status_code == 404


def test_dual_owner_can_read_both_only_when_each_store_is_explicit():
    app = make_app()
    a = request(app, "GET", orders_path(store=A), "qa-owner-ab-token")
    b = request(app, "GET", orders_path(store=B), "qa-owner-ab-token")
    assert a.status_code == b.status_code == 200
    assert [x["id"] for x in a.json()["items"]] == [OA]
    assert [x["id"] for x in b.json()["items"]] == [OB]
    assert a.json()["scope"]["store_id"] != b.json()["scope"]["store_id"]


def test_tenant_owner_without_explicit_store_membership_is_denied():
    response = request(make_app(), "GET", orders_path(), "qa-tenant-only-token")
    assert response.status_code == 404


def test_cross_tenant_actor_cannot_read_tenant_one():
    response = request(make_app(), "GET", orders_path(), "qa-cross-tenant-token")
    assert response.status_code == 404


def test_cross_tenant_store_and_path_tenant_mismatch_is_denied():
    response = request(make_app(), "GET", orders_path(tenant=T1, store=C), "qa-cross-tenant-token")
    assert response.status_code == 404


def test_inactive_tenant_membership_denies_even_if_store_row_is_active():
    response = request(make_app(), "GET", orders_path(), "qa-inactive-tenant-token")
    assert response.status_code == 404


def test_inactive_store_membership_denies():
    response = request(make_app(), "GET", orders_path(), "qa-inactive-store-token")
    assert response.status_code == 404


def test_unknown_store_denied():
    unknown = "ffffffff-ffff-4fff-8fff-ffffffffffff"
    response = request(make_app(), "GET", orders_path(store=unknown), "qa-owner-a-token")
    assert response.status_code == 404


def test_archived_store_denied():
    response = request(make_app(), "GET", orders_path(store=ARCHIVED), "qa-owner-a-token")
    assert response.status_code == 404


def test_paused_store_is_read_only_for_existing_member():
    app = make_app()
    path = orders_path(store=PAUSED)
    response = request(app, "GET", path, "qa-owner-a-token")
    assert response.status_code == 200
    scope = resolve_store_scope(make_registry(), user_id=OWNER_A, tenant_id=T1,
                                store_id=PAUSED, operation="read")
    assert scope.store_status == "paused"
    with pytest.raises(Exception) as exc:
        resolve_store_scope(make_registry(), user_id=OWNER_A, tenant_id=T1,
                            store_id=PAUSED, operation="write")
    assert getattr(exc.value, "code", None) == "STORE_NOT_ACTIVE"


def test_store_list_returns_only_explicit_memberships():
    response = request(make_app(), "GET", f"/api/v2/tenants/{T1}/stores", "qa-owner-a-token")
    assert response.status_code == 200
    ids = {x["store_id"] for x in response.json()["items"]}
    assert ids == {A, PAUSED}


def test_store_list_for_dual_owner_contains_both_stores():
    response = request(make_app(), "GET", f"/api/v2/tenants/{T1}/stores", "qa-owner-ab-token")
    assert response.status_code == 200
    assert {x["store_id"] for x in response.json()["items"]} == {A, B}


def test_store_list_does_not_trust_client_scope_headers_or_query():
    app = make_app()
    for kwargs in (
        {"headers": {"X-Store-ID": B}},
        {"headers": {"X-Tenant-ID": T2}},
        {"headers": {"X-Store-ID": B, "X-Tenant-ID": T2}},
    ):
        response = request(app, "GET", f"/api/v2/tenants/{T1}/stores", **kwargs)
        assert response.status_code == 400
    response = request(app, "GET", f"/api/v2/tenants/{T1}/stores?store_id={B}")
    assert response.status_code == 400


@pytest.mark.parametrize("header", ["X-Store-ID", "X-Tenant-ID"])
def test_scope_headers_cannot_override_path(header):
    response = request(make_app(), "GET", orders_path(),
                       headers={header: B if header == "X-Store-ID" else T2})
    assert response.status_code == 400
    assert response.json()["detail"] == "SCOPE_HEADERS_NOT_SUPPORTED"


@pytest.mark.parametrize("query", [f"store_id={B}", f"tenant_id={T2}"])
def test_duplicate_scope_query_is_rejected(query):
    response = request(make_app(), "GET", orders_path() + "?" + query)
    assert response.status_code == 400
    assert response.json()["detail"] == "DUPLICATE_STORE_CONTEXT"


def test_client_supplied_user_id_header_cannot_change_bearer_identity():
    response = request(make_app(), "GET", orders_path(), "qa-owner-a-token",
                       headers={"X-User-ID": OWNER_B})
    assert response.status_code == 200
    assert [x["id"] for x in response.json()["items"]] == [OA]


def test_missing_bearer_is_rejected():
    response = request(make_app(), "GET", orders_path(), token=None)
    assert response.status_code == 401


def test_unknown_bearer_is_rejected():
    response = request(make_app(), "GET", orders_path(), token="not-a-qa-token")
    assert response.status_code == 401


def test_invalid_path_uuid_is_rejected_by_route_validation():
    response = request(make_app(), "GET", f"/api/v2/tenants/not-a-uuid/stores/{A}/orders")
    assert response.status_code == 422


def test_staff_can_read_store_catalog():
    response = request(make_app(), "GET",
                       f"/api/v2/tenants/{T1}/stores/{A}/products",
                       "qa-staff-a-token")
    assert response.status_code == 200
    assert all(x["store_id"] == A for x in response.json()["items"])


def test_staff_cannot_list_all_store_orders():
    response = request(make_app(), "GET", orders_path(), "qa-staff-a-token")
    assert response.status_code == 403
    assert response.json()["detail"] == "ROLE_DENIED"


def test_manager_can_read_store_orders():
    response = request(make_app(), "GET", orders_path(), "qa-manager-a-token")
    assert response.status_code == 200
    assert [x["id"] for x in response.json()["items"]] == [OA]


def test_store_owner_cannot_escalate_tenant_staff_role():
    scope = resolve_store_scope(make_registry(), user_id=TENANT_STAFF_STORE_OWNER,
                                tenant_id=T1, store_id=A)
    assert scope.effective_role == "staff"
    response = request(make_app(), "GET", orders_path(), "qa-tenant-staff-store-owner-token")
    assert response.status_code == 403


def test_store_staff_role_caps_tenant_owner_role():
    scope = resolve_store_scope(make_registry(), user_id=TENANT_OWNER_STORE_STAFF,
                                tenant_id=T1, store_id=A)
    assert scope.effective_role == "staff"
    response = request(make_app(), "GET", orders_path(), "qa-tenant-owner-store-staff-token")
    assert response.status_code == 403


def test_owner_cannot_fetch_order_object_from_other_store():
    response = request(make_app(), "GET", orders_path() + f"/{OB}")
    assert response.status_code == 404
    assert response.json()["detail"] == "ORDER_NOT_FOUND"


def test_order_items_require_parent_order_in_selected_store():
    response = request(make_app(), "GET", orders_path() + f"/{OB}/items")
    assert response.status_code == 404
    assert response.json()["detail"] == "ORDER_NOT_FOUND"


def test_order_items_return_only_selected_store():
    response = request(make_app(), "GET", orders_path() + f"/{OA}/items")
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert all(x["store_id"] == A for x in response.json()["items"])


def test_customer_collection_is_store_scoped():
    response = request(make_app(), "GET",
                       f"/api/v2/tenants/{T1}/stores/{A}/customers")
    assert response.status_code == 200
    assert [x["display_name"] for x in response.json()["items"]] == ["Synthetic A"]


def test_conversation_collection_is_store_scoped():
    response = request(make_app(), "GET",
                       f"/api/v2/tenants/{T1}/stores/{A}/conversations")
    assert response.status_code == 200
    assert all(x["store_id"] == A for x in response.json()["items"])


def test_messages_require_parent_conversation_in_selected_store():
    conversation_b = "d2000000-0000-4000-8000-000000000002"
    response = request(make_app(), "GET",
                       f"/api/v2/tenants/{T1}/stores/{A}/conversations/{conversation_b}/messages")
    assert response.status_code == 404
    assert response.json()["detail"] == "CONVERSATION_NOT_FOUND"


def test_messages_return_only_selected_store_conversation():
    conversation_a = "d1000000-0000-4000-8000-000000000001"
    response = request(make_app(), "GET",
                       f"/api/v2/tenants/{T1}/stores/{A}/conversations/{conversation_a}/messages")
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert all(x["store_id"] == A for x in response.json()["items"])


@pytest.mark.parametrize("legacy_state,expected,code", [
    ("BLOCKED_PRE_CUTOVER", 503, "LEGACY_STORE_SCOPE_NOT_ADMITTED"),
    ("SUNSET", 410, "LEGACY_ENDPOINT_DEPRECATED"),
])
@pytest.mark.parametrize("resource", ["products", "orders"])
def test_legacy_tenant_wide_routes_never_return_business_data(legacy_state, expected, code, resource):
    response = request(make_app(legacy_state), "GET",
                       f"/api/v1/tenants/{T1}/{resource}")
    assert response.status_code == expected
    assert response.json()["detail"] == code
    assert response.headers["Cache-Control"] == "no-store"


def test_legacy_route_write_method_is_rejected():
    response = request(make_app(), "POST", f"/api/v1/tenants/{T1}/orders",
                       json={"total_vnd": 1})
    assert response.status_code == 405


def test_health_discloses_simulator_only_and_no_live_capability():
    response = request(make_app(), "GET", "/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "CONTRACT_SIMULATOR_ONLY", "live_store_authority": False,
        "database_connected": False, "writes_enabled": False, "production_approved": False,
    }


def test_order_create_body_accepts_only_client_intent_not_authoritative_price_or_scope():
    body = {"items": [{"sku": "SKU-1", "quantity": 2}],
            "customer": {"display_name": "Synthetic customer"}}
    assert validate_order_create_body(body) == body


@pytest.mark.parametrize("field,value", [
    ("tenant_id", T1), ("store_id", A), ("total_vnd", 100),
    ("status", "paid"), ("price_vnd", 1), ("stock_on_hand", 999),
    ("unit_price_vnd", 1), ("order_source", "messenger"),
])
def test_order_create_body_rejects_client_authoritative_fields(field, value):
    body = {"items": [{"sku": "SKU-1", "quantity": 1}], field: value}
    with pytest.raises(Exception) as exc:
        validate_order_create_body(body)
    assert getattr(exc.value, "status_code", None) == 422


@pytest.mark.parametrize("item", [
    {"sku": "SKU-1", "quantity": 1, "unit_price_vnd": 1},
    {"sku": "SKU-1", "quantity": 1, "store_id": B},
    {"sku": "SKU-1", "quantity": True},
    {"sku": "SKU-1", "quantity": 0},
])
def test_order_line_rejects_price_scope_or_invalid_quantity(item):
    with pytest.raises(Exception):
        validate_order_create_body({"items": [item]})


def test_idempotency_key_required_and_strictly_validated():
    with pytest.raises(Exception):
        validate_idempotency_key(None)
    with pytest.raises(Exception):
        validate_idempotency_key("short")
    assert validate_idempotency_key(IDEM) == IDEM


def test_idempotency_key_is_namespaced_by_tenant_and_store():
    key_a = idempotency_scope(T1, A, IDEM)
    key_b = idempotency_scope(T1, B, IDEM)
    key_other_tenant = idempotency_scope(T2, C, IDEM)
    assert key_a != key_b
    assert key_a != key_other_tenant
    assert key_a == (T1, A, IDEM)


def test_duplicate_store_membership_is_fail_closed():
    registry = make_registry()
    registry.store_memberships.append(StoreMembership(T1, A, OWNER_A, "owner"))
    with pytest.raises(Exception):
        resolve_store_scope(registry, user_id=OWNER_A, tenant_id=T1, store_id=A)

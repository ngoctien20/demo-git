"""Only synthetic source-level denial tests. No provider or database network."""
import asyncio

import httpx
import pytest
from fastapi import FastAPI

from trusted_store_selection import (
    SelectedStoreCandidate, StoreSelectionDenied, install_inactive_store_guard,
    resolve_store_candidate,
)

TENANT = "11111111-1111-4111-8111-111111111111"
STORE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
STORE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
OTHER_TENANT = "22222222-2222-4222-8222-222222222222"
EVENT = "synthetic_event_001"
BINDING = "synthetic_binding_001"
NOW = 1800000000


class SyntheticPorts:
    def __init__(self, proof=None, installation=None):
        self.proof = {
            "signature_or_session_verified": True, "replay_unseen": True,
            "source": "server_adapter", "channel": "messenger", "binding_handle": BINDING,
            "expires_at": NOW + 90,
        } if proof is None else proof
        self.installation = {
            "binding_handle": BINDING, "channel": "messenger", "tenant_id": TENANT,
            "store_id": STORE_A, "active": True, "owner_provenance_verified": True,
            "store_status": "approved", "registry_source": "trusted_server",
        } if installation is None else installation
        self.calls = []

    async def verify_ingress(self, channel, internal_event_ref):
        self.calls.append(("ingress", channel, internal_event_ref))
        return self.proof

    async def lookup_installation(self, verified_binding_handle):
        self.calls.append(("installation", verified_binding_handle))
        return self.installation


def resolve(ports=None, **overrides):
    args = dict(ports=ports or SyntheticPorts(), channel="messenger",
                internal_event_ref=EVENT, path_tenant=TENANT,
                path_store=STORE_A, now=NOW)
    args.update(overrides)
    return asyncio.run(resolve_store_candidate(**args))


def test_synthetic_matching_candidate_never_grants_access():
    p = SyntheticPorts()
    result = resolve(p)
    assert isinstance(result, SelectedStoreCandidate)
    assert result.synthetic_contract_consistent
    assert all(getattr(result, x) is False for x in (
        "customer_identity_link_verified", "owner_jwt_verified", "store_read_authorized",
        "order_read_authorized", "order_write_authorized", "provider_send_authorized",
        "production_approved"))
    assert p.calls == [("ingress", "messenger", EVENT), ("installation", BINDING)]


@pytest.mark.parametrize("changed", [
    {"signature_or_session_verified": False}, {"signature_or_session_verified": "true"},
    {"replay_unseen": False}, {"replay_unseen": "true"},
    {"source": "client"}, {"source": None}, {"channel": "zalo"},
    {"binding_handle": "untrusted"}, {"binding_handle": None},
    {"expires_at": NOW}, {"expires_at": NOW - 1},
    {"expires_at": "1800000090"}, {"expires_at": True},
])
def test_bad_ingress_denied(changed):
    p = SyntheticPorts()
    p.proof.update(changed)
    with pytest.raises(StoreSelectionDenied):
        resolve(p)
    assert not any(x[0] == "installation" for x in p.calls)


@pytest.mark.parametrize("changed", [
    {"binding_handle": "another_binding_002"}, {"channel": "zalo"},
    {"tenant_id": OTHER_TENANT}, {"store_id": STORE_B},
    {"active": False}, {"active": "true"},
    {"owner_provenance_verified": False}, {"owner_provenance_verified": "yes"},
    {"store_status": "paused"}, {"store_status": "candidate"},
    {"registry_source": "client"}, {"registry_source": None},
])
def test_bad_store_registry_denied(changed):
    p = SyntheticPorts()
    p.installation.update(changed)
    with pytest.raises(StoreSelectionDenied):
        resolve(p)


@pytest.mark.parametrize("changed", [
    {"path_tenant": OTHER_TENANT}, {"path_store": STORE_B},
    {"channel": "telegram"}, {"channel": "web"},
    {"channel": None}, {"internal_event_ref": "../secrets"},
    {"internal_event_ref": "Authorization:Bearer real-token"},
    {"internal_event_ref": ""}, {"now": 0}, {"now": True},
    {"now": "1800000000"}, {"path_tenant": "not-uuid"},
    {"path_store": "not-uuid"},
])
def test_caller_scope_or_shape_changes_cannot_grant(changed):
    with pytest.raises(StoreSelectionDenied):
        resolve(**changed)


@pytest.mark.parametrize("channel", ["messenger", "zalo", "web"])
def test_different_channel_maps_only_to_matching_server_installation(channel):
    p = SyntheticPorts()
    p.proof["channel"] = channel
    p.installation["channel"] = channel
    result = resolve(p, channel=channel)
    assert result.channel == channel and not result.order_read_authorized
    assert not result.customer_identity_link_verified


@pytest.mark.parametrize("channel", ["messenger", "zalo", "web"])
def test_cross_channel_cannot_reuse_other_channel_installation(channel):
    p = SyntheticPorts()
    p.proof["channel"] = channel
    p.installation["channel"] = "zalo" if channel != "zalo" else "messenger"
    with pytest.raises(StoreSelectionDenied):
        resolve(p, channel=channel)


def make_app():
    app = FastAPI(docs_url=None, openapi_url=None, redoc_url=None)
    calls = {"orders": 0}

    @app.get("/api/v1/tenants/{tenant_id}/orders")
    def synthetic_legacy(tenant_id: str):
        calls["orders"] += 1
        return {"fake_legacy_items": ["A", "B"]}

    @app.get("/health")
    def health():
        return {"status": "synthetic_ok"}

    install_inactive_store_guard(app)
    return app, calls


async def request(app, method, path, headers=None):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                                 base_url="http://synthetic-qa.invalid") as client:
        return await client.request(method, path, headers=headers)


@pytest.mark.parametrize("method", ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer synthetic-token"},
                                      {"Cf-Access-Jwt-Assertion": "synthetic-jwt"},
                                      {"x-store-id": STORE_B, "x-tenant-id": OTHER_TENANT},
                                      {"x-owner-approved": "true", "x-bypass": "true"}])
def test_inactive_legacy_route_has_no_read_escape(method, headers):
    app, calls = make_app()
    response = asyncio.run(request(app, method,
        f"/api/v1/tenants/{TENANT}/orders?store_id={STORE_B}", headers=headers))
    assert response.status_code == (503 if method in {"GET", "HEAD"} else 405)
    assert response.headers["Cache-Control"] == "no-store"
    assert calls["orders"] == 0


def test_isolated_new_store_route_always_503():
    app, calls = make_app()
    response = asyncio.run(request(app, "GET",
        f"/api/v1/tenants/{TENANT}/stores/{STORE_A}/orders"))
    assert response.status_code == 503
    assert response.json()["detail"] == "STORE_ORDERS_NOT_ADMITTED"
    assert calls["orders"] == 0


def test_health_unaffected_in_isolated_app():
    app, calls = make_app()
    response = asyncio.run(request(app, "GET", "/health"))
    assert response.status_code == 200 and response.json() == {"status": "synthetic_ok"}
    assert calls["orders"] == 0


def test_guard_rejects_duplicate_registration():
    app, _ = make_app()
    with pytest.raises(RuntimeError, match="ALREADY_INSTALLED"):
        install_inactive_store_guard(app)

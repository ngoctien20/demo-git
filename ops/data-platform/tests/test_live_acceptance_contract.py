"""Regression for false positives in the read-only hosted acceptance runner."""
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.live_auth_acceptance import TestFailure as AcceptanceFailure, check_tenant


@pytest.mark.parametrize("payload", [{}, {"items": []}, {"items": [{"tenant_id": "a"}]}])
def test_empty_or_unidentified_fixture_cannot_prove_a_scoped_read(payload):
    def provide(request):
        if request.url.path == "/api/v1/tenants":
            return httpx.Response(200, json={"items": [{"tenant_id": "a"}]})
        return httpx.Response(200, json=payload)

    with httpx.Client(transport=httpx.MockTransport(provide)) as client:
        with pytest.raises(AcceptanceFailure):
            check_tenant(client, "fixture-only", "a", "b")


@pytest.mark.parametrize("foreign,expected", [([], True), ([{"tenant_id": "b"}], False), ({}, False)])
def test_direct_postgrest_requires_populated_own_and_empty_foreign_reads(foreign, expected):
    from scripts.live_auth_acceptance import check_postgrest
    paths = []
    def provide(request):
        assert request.url.params["select"] == "tenant_id"
        assert request.headers["apikey"] == "public-fixture"
        assert request.headers["Authorization"] == "Bearer test"
        paths.append(request.url.path)
        rows = [{"tenant_id":"a"}] if request.url.params["tenant_id"] == "eq.a" else foreign
        return httpx.Response(200, json=rows)
    with httpx.Client(transport=httpx.MockTransport(provide)) as client:
        if expected:
            check_postgrest(client, "public-fixture", "test", "a", "b")
            assert paths == ["/rest/v1/products"] * 2 + ["/rest/v1/orders"] * 2
        else:
            with pytest.raises(AcceptanceFailure):
                check_postgrest(client, "public-fixture", "test", "a", "b")


@pytest.mark.parametrize("code,expected", [("refresh_token_not_found", True), ("bad_jwt", False)])
def test_logout_is_local_and_accepts_only_session_revocation_evidence(code, expected):
    from scripts.live_auth_acceptance import check_refresh_revoked, logout_session
    def provide(request):
        if request.url.path.endswith("/logout"):
            assert request.url.params["scope"] == "local"
            assert request.headers["Authorization"] == "Bearer test"
            return httpx.Response(204)
        assert request.url.params["grant_type"] == "refresh_token"
        return httpx.Response(400, json={"error_code": code})
    with httpx.Client(transport=httpx.MockTransport(provide)) as client:
        logout_session(client, "public-fixture", {"access_token": "test"})
        if expected:
            check_refresh_revoked(client, "public-fixture", "test-refresh")
        else:
            with pytest.raises(AcceptanceFailure):
                check_refresh_revoked(client, "public-fixture", "test-refresh")


@pytest.mark.parametrize("foreign_status,foreign_code,should_pass", [
    (403, "42501", True), (400, "22023", False), (403, "unexpected_code", False), (200, "", False),
])
def test_rpc_requires_authorization_denial_before_input_validation(foreign_status, foreign_code, should_pass):
    import json
    from scripts.live_auth_acceptance import check_product_permissions
    def provide(request):
        data = json.loads(request.content)
        assert data["p_sku"] is None and data["p_price"] < 0
        assert request.headers["Authorization"] == "Bearer fixture"
        if data["p_tenant"] == "a":
            return httpx.Response(400, json={"code": "22023"})
        return httpx.Response(foreign_status, json={"code": foreign_code})
    with httpx.Client(transport=httpx.MockTransport(provide)) as client:
        if should_pass:
            check_product_permissions(client, "public", "fixture", "a", "b")
        else:
            with pytest.raises(AcceptanceFailure):
                check_product_permissions(client, "public", "fixture", "a", "b")

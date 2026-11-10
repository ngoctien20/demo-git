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

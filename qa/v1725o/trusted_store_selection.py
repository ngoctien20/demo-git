"""V17.25O — isolated trusted Store selection contract and FastAPI no-host adapter.

NEVER import or mount into deployed Render. No real JWT, provider verification,
customer identity link, Store registry, authorization, database or network calls.
The server-injected port below is a *synthetic test double*, not an authentic
provider. Source-only contract, all live capabilities remain false.
"""
from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

SUPPORTED = frozenset({"messenger", "zalo", "web"})
_LEGACY = re.compile(r"^/api/v1/tenants/[0-9a-fA-F-]{36}/orders/?$")
_STORE_ROUTE = "/api/v1/tenants/{tenant_id}/stores/{store_id}/orders"
_EVENT_REF = re.compile(r"^[A-Za-z0-9_-]{12,128}$")


class StoreSelectionDenied(Exception):
    def __init__(self, code: str = "TRUSTED_STORE_SELECTION_DENIED"):
        self.code = code
        super().__init__(code)


def _uuid(value: object) -> str:
    if not isinstance(value, str):
        raise StoreSelectionDenied()
    try:
        parsed = UUID(value)
    except (TypeError, ValueError, AttributeError):
        raise StoreSelectionDenied() from None
    if parsed.version is None or str(parsed) != value.lower():
        raise StoreSelectionDenied()
    return str(parsed)


class ServerPorts(Protocol):
    """Real adapter must be independently audited, server-created and injected."""

    async def verify_ingress(self, channel: str, internal_event_ref: str) -> Mapping: ...

    async def lookup_installation(self, verified_binding_handle: str) -> Mapping: ...


@dataclass(frozen=True)
class SelectedStoreCandidate:
    tenant_id: str
    store_id: str
    channel: str
    synthetic_contract_consistent: bool = True
    customer_identity_link_verified: bool = False
    owner_jwt_verified: bool = False
    store_read_authorized: bool = False
    order_read_authorized: bool = False
    order_write_authorized: bool = False
    provider_send_authorized: bool = False
    production_approved: bool = False


async def resolve_store_candidate(
    *, ports: ServerPorts, channel: str, internal_event_ref: str,
    path_tenant: str, path_store: str, now: int,
) -> SelectedStoreCandidate:
    """Compare *server-returned* installation identity to path; never trust headers.

    The port implementation is a required security boundary. This function
    cannot authenticate a webhook or customer and does not grant reads even if
    the synthetic server port returns well-formed evidence.
    """
    tenant, store = _uuid(path_tenant), _uuid(path_store)
    if (channel not in SUPPORTED or not isinstance(internal_event_ref, str)
            or not _EVENT_REF.fullmatch(internal_event_ref)
            or type(now) is not int or now <= 0
            or not callable(getattr(ports, "verify_ingress", None))
            or not callable(getattr(ports, "lookup_installation", None))):
        raise StoreSelectionDenied()
    try:
        verification = await ports.verify_ingress(channel, internal_event_ref)
    except Exception:
        raise StoreSelectionDenied("INGRESS_VERIFICATION_UNAVAILABLE") from None
    if not isinstance(verification, Mapping):
        raise StoreSelectionDenied()
    binding = verification.get("binding_handle")
    if (verification.get("signature_or_session_verified") is not True
            or verification.get("replay_unseen") is not True
            or verification.get("source") != "server_adapter"
            or verification.get("channel") != channel
            or not isinstance(binding, str) or not _EVENT_REF.fullmatch(binding)
            or type(verification.get("expires_at")) is not int
            or verification["expires_at"] <= now):
        raise StoreSelectionDenied("INGRESS_NOT_TRUSTED")
    try:
        installation = await ports.lookup_installation(binding)
    except Exception:
        raise StoreSelectionDenied("INSTALLATION_REGISTRY_UNAVAILABLE") from None
    if not isinstance(installation, Mapping):
        raise StoreSelectionDenied()
    if (installation.get("binding_handle") != binding
            or installation.get("channel") != channel
            or installation.get("tenant_id") != tenant
            or installation.get("store_id") != store
            or installation.get("active") is not True
            or installation.get("owner_provenance_verified") is not True
            or installation.get("store_status") != "approved"
            or installation.get("registry_source") != "trusted_server"):
        raise StoreSelectionDenied("STORE_BINDING_MISMATCH")
    return SelectedStoreCandidate(tenant_id=tenant, store_id=store, channel=channel)


def install_inactive_store_guard(app: FastAPI) -> None:
    """NO-HOST ONLY: intercept legacy Orders regardless of client approvals.

    Must be called before ASGI startup. Not a production-ready hotfix; the
    deployed app and legacy route remain unchanged. Requests for all other
    routes are passed through to the supplied isolated app.
    """
    if getattr(app.state, "v1725o_guard_installed", False):
        raise RuntimeError("V1725O_GUARD_ALREADY_INSTALLED")
    app.state.v1725o_guard_installed = True

    @app.middleware("http")
    async def deny_legacy_orders(request: Request, call_next):
        if _LEGACY.fullmatch(request.url.path):
            status = 503 if request.method in {"GET", "HEAD"} else 405
            return JSONResponse(
                {"detail": "LEGACY_ORDERS_STORE_SCOPE_REQUIRED"},
                status_code=status,
                headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
            )
        return await call_next(request)

    @app.get(_STORE_ROUTE, include_in_schema=False)
    async def nohost_store_orders(tenant_id: str, store_id: str):
        # Deliberately no calls to resolve_store_candidate, JWT or Orders DB.
        # No selected Store could authorize real data at this stage.
        return JSONResponse({"detail": "STORE_ORDERS_NOT_ADMITTED"},
                            status_code=503, headers={"Cache-Control": "no-store"})

"""V17.25N SOURCE-ONLY: forbid tenant-wide Legacy Orders in multi-Store rollout.

Never mounted on Render, no JWT, Store registry or real DB connection.
Inputs are untrusted and deliberately cannot grant any Orders access.
"""
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class LegacyDenial:
    code: str = "LEGACY_ORDERS_STORE_SCOPE_REQUIRED"
    http_status: int = 503
    read_allowed: bool = False
    write_allowed: bool = False
    provider_send_allowed: bool = False
    production_allowed: bool = False


def decide_legacy_orders(*, tenant_store_count: Any = None,
                         owner_id: Any = None,
                         requested_store: Any = None,
                         client_approved: Any = False) -> LegacyDenial:
    """Never trust client/tenant claims: route stays locked until hosted review."""
    return LegacyDenial()

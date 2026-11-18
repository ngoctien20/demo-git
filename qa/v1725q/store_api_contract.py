"""V17.25Q source-only Store-aware API contract simulator.

Synthetic actors, memberships and commerce records only. No Supabase, JWT,
provider, customer, database, network, write or production integration.
This is a contract test harness, not deployable application code.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse

ROLE_RANK = {"staff": 1, "manager": 2, "owner": 3}
LEGACY_PATH = re.compile(
    r"^/api/v1/tenants/[0-9a-fA-F-]{36}/(?:products|orders)/?$"
)
SCOPE_HEADERS = {"x-tenant-id", "x-store-id"}


@dataclass(frozen=True)
class TenantMembership:
    tenant_id: str
    user_id: str
    role: str
    active: bool = True


@dataclass(frozen=True)
class Store:
    tenant_id: str
    store_id: str
    name: str
    status: str = "active"


@dataclass(frozen=True)
class StoreMembership:
    tenant_id: str
    store_id: str
    user_id: str
    role: str
    active: bool = True


@dataclass(frozen=True)
class StoreScope:
    tenant_id: str
    store_id: str
    user_id: str
    tenant_role: str
    store_role: str
    effective_role: str
    store_status: str


@dataclass
class Registry:
    tenant_memberships: list[TenantMembership]
    stores: list[Store]
    store_memberships: list[StoreMembership]
    products: list[dict[str, Any]]
    orders: list[dict[str, Any]]
    order_items: list[dict[str, Any]]
    customers: list[dict[str, Any]]
    conversations: list[dict[str, Any]]
    messages: list[dict[str, Any]]


class ScopeDenied(Exception):
    def __init__(self, status_code: int = 404, code: str = "STORE_NOT_FOUND_OR_NOT_AUTHORIZED"):
        self.status_code = status_code
        self.code = code
        super().__init__(code)


def _canonical_uuid(value: object) -> str:
    if not isinstance(value, str):
        raise ScopeDenied()
    try:
        parsed = UUID(value)
    except (ValueError, TypeError, AttributeError):
        raise ScopeDenied() from None
    if str(parsed) != value.lower():
        raise ScopeDenied()
    return str(parsed)


def resolve_store_scope(
    registry: Registry, *, user_id: str, tenant_id: str, store_id: str,
    operation: str = "read",
) -> StoreScope:
    """Resolve authorization from server-owned memberships, never request headers."""
    tenant = _canonical_uuid(tenant_id)
    store_key = _canonical_uuid(store_id)
    actor = _canonical_uuid(user_id)

    tenant_members = [
        x for x in registry.tenant_memberships
        if x.tenant_id == tenant and x.user_id == actor and x.active
    ]
    if len(tenant_members) != 1 or tenant_members[0].role not in ROLE_RANK:
        raise ScopeDenied()

    stores = [x for x in registry.stores if x.tenant_id == tenant and x.store_id == store_key]
    if len(stores) != 1 or stores[0].status == "archived":
        raise ScopeDenied()

    store_members = [
        x for x in registry.store_memberships
        if x.tenant_id == tenant and x.store_id == store_key
        and x.user_id == actor and x.active
    ]
    if len(store_members) != 1 or store_members[0].role not in ROLE_RANK:
        raise ScopeDenied()

    tenant_role = tenant_members[0].role
    store_role = store_members[0].role
    # Least privilege: a Store grant cannot elevate the tenant-level role,
    # and a tenant Owner does not inherit every Store without an explicit row.
    effective_role = min((tenant_role, store_role), key=lambda role: ROLE_RANK[role])
    status = stores[0].status
    if status not in {"active", "paused"}:
        raise ScopeDenied()
    if operation == "write" and status != "active":
        raise ScopeDenied(409, "STORE_NOT_ACTIVE")
    if operation not in {"read", "write"}:
        raise ScopeDenied(400, "INVALID_OPERATION")
    return StoreScope(tenant, store_key, actor, tenant_role, store_role, effective_role, status)


def require_permission(scope: StoreScope, resource: str, action: str) -> None:
    permissions = {
        "owner": {
            ("products", "read"), ("orders", "read"), ("orders", "create"),
            ("orders", "update"), ("customers", "read"),
            ("conversations", "read"), ("messages", "read"),
            ("store_memberships", "read"), ("store_memberships", "manage"),
            ("settings", "manage"), ("reports", "read"),
        },
        "manager": {
            ("products", "read"), ("products", "create"), ("products", "update"),
            ("orders", "read"), ("orders", "create"), ("orders", "update"),
            ("customers", "read"), ("conversations", "read"),
            ("messages", "read"), ("reports", "read"),
        },
        "staff": {
            ("products", "read"), ("orders", "create"),
        },
    }
    if (resource, action) not in permissions[scope.effective_role]:
        raise HTTPException(403, detail="ROLE_DENIED")


def reject_duplicate_scope(request: Request) -> None:
    if any(k.lower() in SCOPE_HEADERS for k in request.headers.keys()):
        raise HTTPException(400, detail="SCOPE_HEADERS_NOT_SUPPORTED")
    if "tenant_id" in request.query_params or "store_id" in request.query_params:
        raise HTTPException(400, detail="DUPLICATE_STORE_CONTEXT")


def validate_order_create_body(body: object) -> dict:
    """Design-only validator: price, stock and Store scope are server-derived."""
    if not isinstance(body, dict):
        raise HTTPException(422, detail="INVALID_ORDER_BODY")
    allowed = {"customer", "items", "note"}
    if set(body) - allowed:
        raise HTTPException(422, detail="CLIENT_CONTROLLED_FIELD_NOT_ALLOWED")
    items = body.get("items")
    if not isinstance(items, list) or not items or len(items) > 100:
        raise HTTPException(422, detail="INVALID_ORDER_ITEMS")
    for item in items:
        if not isinstance(item, dict) or set(item) != {"sku", "quantity"}:
            raise HTTPException(422, detail="CLIENT_PRICE_OR_SCOPE_NOT_ALLOWED")
        sku, quantity = item.get("sku"), item.get("quantity")
        if not isinstance(sku, str) or not 1 <= len(sku.strip()) <= 80:
            raise HTTPException(422, detail="INVALID_SKU")
        if type(quantity) is not int or not 1 <= quantity <= 10000:
            raise HTTPException(422, detail="INVALID_QUANTITY")
    customer = body.get("customer")
    if customer is not None:
        if not isinstance(customer, dict) or set(customer) - {"display_name", "phone", "email"}:
            raise HTTPException(422, detail="INVALID_CUSTOMER_SNAPSHOT")
    note = body.get("note")
    if note is not None and (not isinstance(note, str) or len(note) > 1000):
        raise HTTPException(422, detail="INVALID_NOTE")
    return body


def validate_idempotency_key(value: str | None) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9._~-]{16,128}", value):
        raise HTTPException(400, detail="IDEMPOTENCY_KEY_REQUIRED")
    return value


def idempotency_scope(tenant_id: str, store_id: str, key: str) -> tuple[str, str, str]:
    return (_canonical_uuid(tenant_id), _canonical_uuid(store_id), validate_idempotency_key(key))


def create_app(registry: Registry, *, tokens: dict[str, str], legacy_state: str = "BLOCKED_PRE_CUTOVER") -> FastAPI:
    if legacy_state not in {"BLOCKED_PRE_CUTOVER", "SUNSET"}:
        raise ValueError("INVALID_LEGACY_STATE")
    app = FastAPI(title="TIEN404 V17.25Q Contract Simulator", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.registry = registry
    app.state.tokens = dict(tokens)
    app.state.legacy_state = legacy_state

    @app.middleware("http")
    async def legacy_fail_closed(request: Request, call_next):
        if LEGACY_PATH.fullmatch(request.url.path):
            if request.method in {"GET", "HEAD"}:
                if app.state.legacy_state == "SUNSET":
                    code, status = "LEGACY_ENDPOINT_DEPRECATED", 410
                else:
                    code, status = "LEGACY_STORE_SCOPE_NOT_ADMITTED", 503
            else:
                code, status = "LEGACY_ROUTE_READ_ONLY", 405
            return JSONResponse(
                {"detail": code}, status_code=status,
                headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
            )
        return await call_next(request)

    async def actor(request: Request) -> str:
        authorization = request.headers.get("authorization", "")
        if not authorization.startswith("Bearer "):
            raise HTTPException(401, detail="AUTH_REQUIRED")
        user_id = app.state.tokens.get(authorization[7:])
        if not user_id:
            raise HTTPException(401, detail="INVALID_SESSION")
        return user_id

    def scoped(request: Request, user_id: str, tenant_id: UUID, store_id: UUID, operation="read") -> StoreScope:
        reject_duplicate_scope(request)
        try:
            return resolve_store_scope(
                app.state.registry, user_id=user_id,
                tenant_id=str(tenant_id), store_id=str(store_id), operation=operation,
            )
        except ScopeDenied as exc:
            raise HTTPException(exc.status_code, detail=exc.code) from None

    @app.get("/api/v2/tenants/{tenant_id}/stores")
    async def list_stores(tenant_id: UUID, request: Request):
        reject_duplicate_scope(request)
        actor_id = await actor(request)
        tenant = str(tenant_id)
        tenant_rows = [x for x in registry.tenant_memberships if x.tenant_id == tenant and x.user_id == actor_id and x.active]
        if len(tenant_rows) != 1 or tenant_rows[0].role not in ROLE_RANK:
            raise HTTPException(404, detail="TENANT_NOT_FOUND_OR_NOT_AUTHORIZED")
        memberships = [
            x for x in registry.store_memberships
            if x.tenant_id == tenant and x.user_id == actor_id and x.active
        ]
        items = []
        for membership in memberships:
            store = next((s for s in registry.stores if s.tenant_id == tenant and s.store_id == membership.store_id), None)
            if store and store.status != "archived" and membership.role in ROLE_RANK:
                items.append({"store_id": store.store_id, "name": store.name,
                              "status": store.status,
                              "effective_role": min((tenant_rows[0].role, membership.role),
                                                     key=lambda role: ROLE_RANK.get(role, 0))})
        return {"tenant_id": tenant, "items": sorted(items, key=lambda x: x["store_id"])}

    @app.get("/api/v2/tenants/{tenant_id}/stores/{store_id}/products")
    async def list_products(tenant_id: UUID, store_id: UUID, request: Request, limit: int = Query(50, ge=1, le=100)):
        user_id = await actor(request)
        scope = scoped(request, user_id, tenant_id, store_id)
        require_permission(scope, "products", "read")
        items = [x for x in registry.products
                 if x["tenant_id"] == scope.tenant_id and x["store_id"] == scope.store_id]
        return {"scope": {"tenant_id": scope.tenant_id, "store_id": scope.store_id},
                "items": items[:limit]}

    @app.get("/api/v2/tenants/{tenant_id}/stores/{store_id}/orders")
    async def list_orders(tenant_id: UUID, store_id: UUID, request: Request, limit: int = Query(50, ge=1, le=100)):
        user_id = await actor(request)
        scope = scoped(request, user_id, tenant_id, store_id)
        require_permission(scope, "orders", "read")
        items = [x for x in registry.orders
                 if x["tenant_id"] == scope.tenant_id and x["store_id"] == scope.store_id]
        return {"scope": {"tenant_id": scope.tenant_id, "store_id": scope.store_id},
                "items": items[:limit]}

    @app.get("/api/v2/tenants/{tenant_id}/stores/{store_id}/orders/{order_id}")
    async def get_order(tenant_id: UUID, store_id: UUID, order_id: UUID, request: Request):
        user_id = await actor(request)
        scope = scoped(request, user_id, tenant_id, store_id)
        require_permission(scope, "orders", "read")
        item = next((x for x in registry.orders if x["id"] == str(order_id)
                     and x["tenant_id"] == scope.tenant_id and x["store_id"] == scope.store_id), None)
        if item is None:
            raise HTTPException(404, detail="ORDER_NOT_FOUND")
        return {"scope": {"tenant_id": scope.tenant_id, "store_id": scope.store_id}, "item": item}

    @app.get("/api/v2/tenants/{tenant_id}/stores/{store_id}/orders/{order_id}/items")
    async def list_order_items(tenant_id: UUID, store_id: UUID, order_id: UUID, request: Request):
        user_id = await actor(request)
        scope = scoped(request, user_id, tenant_id, store_id)
        require_permission(scope, "orders", "read")
        parent = next((x for x in registry.orders if x["id"] == str(order_id)
                       and x["tenant_id"] == scope.tenant_id and x["store_id"] == scope.store_id), None)
        if parent is None:
            raise HTTPException(404, detail="ORDER_NOT_FOUND")
        items = [x for x in registry.order_items
                 if x["tenant_id"] == scope.tenant_id and x["store_id"] == scope.store_id
                 and x["order_id"] == str(order_id)]
        return {"scope": {"tenant_id": scope.tenant_id, "store_id": scope.store_id}, "items": items}

    @app.get("/api/v2/tenants/{tenant_id}/stores/{store_id}/customers")
    async def list_customers(tenant_id: UUID, store_id: UUID, request: Request):
        user_id = await actor(request)
        scope = scoped(request, user_id, tenant_id, store_id)
        require_permission(scope, "customers", "read")
        items = [x for x in registry.customers
                 if x["tenant_id"] == scope.tenant_id and x["store_id"] == scope.store_id]
        return {"scope": {"tenant_id": scope.tenant_id, "store_id": scope.store_id}, "items": items}

    @app.get("/api/v2/tenants/{tenant_id}/stores/{store_id}/conversations")
    async def list_conversations(tenant_id: UUID, store_id: UUID, request: Request):
        user_id = await actor(request)
        scope = scoped(request, user_id, tenant_id, store_id)
        require_permission(scope, "conversations", "read")
        items = [x for x in registry.conversations
                 if x["tenant_id"] == scope.tenant_id and x["store_id"] == scope.store_id]
        return {"scope": {"tenant_id": scope.tenant_id, "store_id": scope.store_id}, "items": items}

    @app.get("/api/v2/tenants/{tenant_id}/stores/{store_id}/conversations/{conversation_id}/messages")
    async def list_messages(tenant_id: UUID, store_id: UUID, conversation_id: UUID, request: Request):
        user_id = await actor(request)
        scope = scoped(request, user_id, tenant_id, store_id)
        require_permission(scope, "messages", "read")
        parent = next((x for x in registry.conversations if x["id"] == str(conversation_id)
                       and x["tenant_id"] == scope.tenant_id and x["store_id"] == scope.store_id), None)
        if parent is None:
            raise HTTPException(404, detail="CONVERSATION_NOT_FOUND")
        items = [x for x in registry.messages
                 if x["tenant_id"] == scope.tenant_id and x["store_id"] == scope.store_id
                 and x["conversation_id"] == str(conversation_id)]
        return {"scope": {"tenant_id": scope.tenant_id, "store_id": scope.store_id}, "items": items}

    @app.get("/health")
    async def health():
        return {"status": "CONTRACT_SIMULATOR_ONLY", "live_store_authority": False,
                "database_connected": False, "writes_enabled": False,
                "production_approved": False}

    return app

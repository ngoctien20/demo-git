"""Read-only TIEN404 SaaS gateway for Supabase Auth + PostgREST with RLS.

Staging-only. This is not the Sites Control Hub application. Only trusted
user JWTs are forwarded to the Supabase API with a publishable key; never a
service-role secret. No mutations, payment, bot activation, or production data.
"""
from __future__ import annotations

from dataclasses import dataclass
from .signed_n8n import MAX_BODY, ReplayCache, verify_request
from datetime import datetime, timezone
import os
import re
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


@dataclass(frozen=True)
class Settings:
    supabase_url: str | None = None
    publishable_key: str | None = None
    allowed_origin: str | None = None
    mode: str = 'staging'

    @classmethod
    def from_env(cls) -> 'Settings':
        return cls(
            supabase_url=os.getenv('TIEN404_SUPABASE_URL'),
            publishable_key=os.getenv('TIEN404_SUPABASE_PUBLISHABLE_KEY'),
            allowed_origin=os.getenv('TIEN404_APP_ORIGIN'),
            mode=os.getenv('TIEN404_DATA_MODE', 'staging'),
        )

    def __post_init__(self):
        if self.mode != 'staging':
            raise ValueError('Staging-only backend: production release gate not passed')
        if self.supabase_url:
            u = urlsplit(self.supabase_url)
            if u.scheme != 'https' or not u.netloc or u.username or u.password or u.query or u.fragment or u.path not in ('', '/'):
                raise ValueError('SUPABASE_URL must be an HTTPS origin without credentials or path')
        if self.allowed_origin:
            u = urlsplit(self.allowed_origin)
            if u.scheme != 'https' or not u.netloc or u.path not in ('', '/') or u.query or u.fragment:
                raise ValueError('Allowed origin must be one exact HTTPS origin')

    @property
    def configured(self) -> bool:
        return bool(self.supabase_url and self.publishable_key)


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def sanitize_rows(value: Any, columns: tuple[str, ...], tenant_id: UUID | None = None) -> list[dict]:
    if not isinstance(value, list) or len(value) > 100:
        raise HTTPException(status_code=502, detail='PROVIDER_BAD_RESPONSE')
    result = []
    for item in value:
        if not isinstance(item, dict):
            raise HTTPException(status_code=502, detail='PROVIDER_BAD_RESPONSE')
        if tenant_id is not None and str(item.get('tenant_id')) != str(tenant_id):
            # RLS should also block it; fail closed in the gateway if it does not.
            raise HTTPException(status_code=502, detail='PROVIDER_TENANT_SCOPE_VIOLATION')
        result.append({k: item.get(k) for k in columns})
    return result


def create_app(settings: Settings | None = None, *, transport: httpx.AsyncBaseTransport | None = None, commerce_connect=None) -> FastAPI:
    cfg = settings or Settings.from_env()
    n8n_replay = ReplayCache()
    app = FastAPI(title='TIEN404 SaaS Data Gateway STAGING', version='0.1.0',
                  docs_url=None, redoc_url=None, openapi_url=None)
    if cfg.allowed_origin:
        app.add_middleware(CORSMiddleware, allow_origins=[cfg.allowed_origin],
                           allow_credentials=False, allow_methods=['GET'],
                           allow_headers=['Authorization', 'Content-Type'])

    @app.middleware('http')
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none'"
        return response

    @app.exception_handler(httpx.RequestError)
    async def on_transport_error(request: Request, exc: httpx.RequestError):
        return JSONResponse(status_code=503, content={'detail': 'PROVIDER_CONNECTION_ERROR'})

    async def get_remote(path: str, token: str, params: dict | None = None) -> Any:
        # URL path and query are authored by this server, never forwarded from users.
        if not cfg.configured:
            raise HTTPException(status_code=503, detail='NOT_CONFIGURED')
        headers = {'apikey': cfg.publishable_key, 'Authorization': 'Bearer ' + token,
                   'Accept': 'application/json'}
        url = cfg.supabase_url.rstrip('/') + path
        if transport:
            async with httpx.AsyncClient(transport=transport, timeout=8, follow_redirects=False) as client:
                response = await client.get(url, headers=headers, params=params)
        else:
            async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
                response = await client.get(url, headers=headers, params=params)
        if response.status_code in (401, 403):
            raise HTTPException(status_code=401, detail='INVALID_SESSION')
        if response.status_code == 429:
            raise HTTPException(status_code=503, detail='PROVIDER_RATE_LIMITED')
        if not 200 <= response.status_code < 300:
            raise HTTPException(status_code=503, detail='PROVIDER_SERVICE_ERROR')
        try:
            return response.json()
        except ValueError:
            raise HTTPException(status_code=502, detail='PROVIDER_BAD_RESPONSE')

    async def identity(request: Request) -> tuple[str, UUID]:
        raw = request.headers.get('authorization', '')
        if not raw.startswith('Bearer ') or len(raw) > 4096:
            raise HTTPException(status_code=401, detail='AUTH_REQUIRED')
        token = raw[7:]
        if not re.fullmatch(r'[A-Za-z0-9_+./=-]{30,4000}', token):
            raise HTTPException(status_code=401, detail='INVALID_TOKEN_FORMAT')
        user = await get_remote('/auth/v1/user', token)
        try:
            user_id = UUID(str(user['id']))
        except (TypeError, KeyError, ValueError):
            raise HTTPException(status_code=502, detail='PROVIDER_BAD_IDENTITY')
        return token, user_id

    async def membership(token: str, user_id: UUID, tenant_id: UUID) -> str:
        data = await get_remote('/rest/v1/tenant_memberships', token, {
            'select': 'tenant_id,role', 'tenant_id': 'eq.' + str(tenant_id),
            'user_id': 'eq.' + str(user_id), 'active': 'eq.true', 'limit': '1'
        })
        rows = sanitize_rows(data, ('tenant_id', 'role'), tenant_id)
        if len(rows) != 1:
            # Avoid revealing the existence of another tenant.
            raise HTTPException(status_code=404, detail='TENANT_NOT_FOUND')
        role = rows[0].get('role')
        if role not in {'owner', 'manager', 'staff'}:
            raise HTTPException(status_code=403, detail='ROLE_DENIED')
        return role

    @app.get('/health')
    async def health():
        return {
            'status': 'CONFIGURED_NOT_VERIFIED' if cfg.configured else 'UNKNOWN',
            'mode': cfg.mode, 'database_connected': False,
            'source': 'supabase_connection_configuration', 'observed_at': timestamp(),
            'reason': 'External connectivity and actual database schema not verified',
            'production_readiness': 'NOT_APPROVED',
        }

    @app.post('/api/v1/internal/n8n/handshake')
    async def n8n_handshake(request: Request):
        # No tenant resolver and no business writes: a staging connectivity proof.
        if request.headers.get('content-type', '').split(';', 1)[0].lower() != 'application/json':
            raise HTTPException(status_code=415, detail='JSON_REQUIRED')
        raw = bytearray()
        async for chunk in request.stream():
            if len(raw) + len(chunk) > MAX_BODY:
                raise HTTPException(status_code=413, detail='INVALID_BODY_SIZE')
            raw.extend(chunk)
        verified = verify_request(
            secret=os.getenv('TIEN404_N8N_STAGING_SECRET', ''),
            raw=bytes(raw),
            timestamp=request.headers.get('X-TIEN404-Timestamp'),
            nonce=request.headers.get('X-TIEN404-Nonce'),
            signature=request.headers.get('X-TIEN404-Signature'),
            cache=n8n_replay,
        )
        return {
            'status': 'STAGING_N8N_VERIFIED',
            'action': verified['action'],
            'request_id': verified['request_id'],
            'tenant_access': False, 'orders_access': False,
            'writes_enabled': False, 'production_readiness': 'NOT_APPROVED',
            'observed_at': timestamp(),
        }

    @app.get('/api/v1/tenants')
    async def list_my_tenants(auth=Depends(identity)):
        token, uid = auth
        data = await get_remote('/rest/v1/tenant_memberships', token, {
            'select': 'tenant_id,role', 'user_id': 'eq.' + str(uid),
            'active': 'eq.true', 'limit': '100'
        })
        rows = sanitize_rows(data, ('tenant_id', 'role'))
        return {'items': rows, 'source': 'supabase_rls', 'observed_at': timestamp()}

    @app.get('/api/v1/tenants/{tenant_id}/products')
    async def list_products(tenant_id: UUID = Path(), limit: int = Query(50, ge=1, le=100), auth=Depends(identity)):
        token, uid = auth
        await membership(token, uid, tenant_id)
        fields = ('id', 'tenant_id', 'sku', 'name', 'price_vnd', 'stock_on_hand', 'is_active', 'updated_at')
        data = await get_remote('/rest/v1/products', token, {
            'select': ','.join(fields), 'tenant_id': 'eq.' + str(tenant_id),
            'order': 'name.asc', 'limit': str(limit),
        })
        return {'items': sanitize_rows(data, fields, tenant_id), 'source': 'supabase_rls',
                'observed_at': timestamp()}

    @app.get('/api/v1/tenants/{tenant_id}/orders')
    async def list_orders(tenant_id: UUID = Path(), limit: int = Query(50, ge=1, le=100), auth=Depends(identity)):
        token, uid = auth
        role = await membership(token, uid, tenant_id)
        if role not in ('owner', 'manager'):
            raise HTTPException(status_code=403, detail='ROLE_DENIED')
        fields = ('id', 'tenant_id', 'status', 'total_vnd', 'created_at')
        data = await get_remote('/rest/v1/orders', token, {
            'select': ','.join(fields), 'tenant_id': 'eq.' + str(tenant_id),
            'order': 'created_at.desc', 'limit': str(limit),
        })
        return {'items': sanitize_rows(data, fields, tenant_id), 'source': 'supabase_rls',
                'observed_at': timestamp()}

    if commerce_connect is not None:
        from .merchant_orders import add_merchant_orders
        add_merchant_orders(app, identity, commerce_connect)

    return app


app = create_app()
"""Read-only Super Admin -> Render data-platform staging status adapter.

Identity systems remain separate: local MFA/SQLite is not a Supabase JWT.
"""
from __future__ import annotations
from urllib.parse import urlsplit
import httpx

async def fetch_data_platform_status(url: str | None, *, transport=None) -> dict:
    base = (url or '').strip()
    if not base:
        return {'status': 'UNKNOWN', 'source': 'data_platform_staging',
                'reason': 'NO_STAGING_URL', 'production_readiness': 'NOT_APPROVED'}
    parsed = urlsplit(base)
    if (parsed.scheme != 'https' or parsed.netloc != 'tien404-data-staging.onrender.com'
            or parsed.username or parsed.password or parsed.path not in ('', '/')
            or parsed.query or parsed.fragment):
        return {'status': 'CONFIGURATION_REJECTED', 'source': 'data_platform_staging',
                'reason': 'INVALID_STAGING_ORIGIN', 'production_readiness': 'NOT_APPROVED'}
    try:
        async with httpx.AsyncClient(timeout=6, transport=transport, follow_redirects=False) as client:
            r = await client.get(base.rstrip('/') + '/health',
                                 headers={'Accept': 'application/json'})
        if r.status_code != 200:
            return {'status': 'CONNECTION_ERROR', 'source': 'data_platform_staging',
                    'http_status': r.status_code, 'production_readiness': 'NOT_APPROVED'}
        body = r.json()
        if (not isinstance(body, dict) or body.get('mode') != 'staging'
                or body.get('production_readiness') != 'NOT_APPROVED'
                or body.get('database_connected') is not False
                or body.get('status') not in ('CONFIGURED_NOT_VERIFIED', 'UNKNOWN')):
            return {'status': 'UNTRUSTED_UPSTREAM_RESPONSE',
                    'source': 'data_platform_staging',
                    'production_readiness': 'NOT_APPROVED'}
        return {'status': 'API_REACHABLE_DB_NOT_VERIFIED',
                'source': 'data_platform_staging',
                'upstream_status': body['status'],
                'upstream_observed_at': body.get('observed_at'),
                'production_readiness': 'NOT_APPROVED',
                'tenant_data_connected': False, 'can_write': False}
    except (httpx.RequestError, ValueError):
        return {'status': 'CONNECTION_ERROR', 'source': 'data_platform_staging',
                'production_readiness': 'NOT_APPROVED'}

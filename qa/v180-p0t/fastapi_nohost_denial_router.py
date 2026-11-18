"""P0T quarantined FastAPI route shape: intentionally never accepts owner JWTs.

ONLY for an offline isolated ASGI application to assert fail-closed responses.
Do not import this file into ops/data-platform/app/main.py or deploy its router.
The future real private route requires independent scoped approvals and a
cryptographic Cloudflare Access + Supabase Auth backend at the origin.
"""
from fastapi import APIRouter, HTTPException

PRIVATE_CANDIDATE_PATH = "/api/v1/internal/private-auth/owner-pair"


def build_nohost_denial_router() -> APIRouter:
    router = APIRouter(include_in_schema=False)

    @router.post(PRIVATE_CANDIDATE_PATH)
    async def deny_all():
        # No Authorization header/body parsing, no calls, no token or PII logs.
        raise HTTPException(status_code=404, detail="NOT_FOUND")

    return router

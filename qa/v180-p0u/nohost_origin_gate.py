"""P0U isolated FastAPI origin probe — NOT imported by deployed application.

It validates a signed Access assertion with a pinned offline JWKS (injected
for tests) at the ORIGIN regardless of Host/Origin headers, then always returns
503. It does not consume a Supabase Bearer or issue an Owner access decision.
Never mount as a real Owner JWT intake endpoint without separate approval.
"""
from __future__ import annotations
from collections.abc import Mapping
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from pinned_jwks_verifier import SignatureDenied, verify_cloudflare_access_jwt

PATH = "/api/v1/internal/private-auth/owner-pair"


def build_isolated_nohost_app(*, pinned_access_keys: Mapping,
                              access_issuer: str, access_audience: str, clock):
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @app.post(PATH, include_in_schema=False)
    async def verify_origin_then_deny(request: Request):
        # Do not trust Host, X-Forwarded-Host, Origin, Referer or caller booleans.
        assertion = request.headers.get("cf-access-jwt-assertion", "")
        try:
            verify_cloudflare_access_jwt(
                assertion, pinned_keys=pinned_access_keys,
                team_issuer=access_issuer, app_audience=access_audience,
                now=clock(),
            )
        except (SignatureDenied, ValueError, TypeError):
            return JSONResponse(
                {"detail": "ACCESS_DENIED"}, status_code=403,
                headers={"Cache-Control": "no-store"},
            )
        # Explicitly no real Supabase/Auth/session/consent backend exists.
        return JSONResponse(
            {"detail": "PRIVATE_VERIFIER_NOT_DEPLOYED"},
            status_code=503, headers={"Cache-Control": "no-store"},
        )

    return app

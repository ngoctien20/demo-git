"""V18.0-P0W — server-owned JWKS fetch with pinned HTTPS endpoints (source-only).

This module uses only official public *signing keys*, never credentials or
access tokens. Production use requires independent review/config/deployment
approval. No network operation occurs at import or constructor time.
"""
from __future__ import annotations

import json
import re
import time
from collections.abc import Mapping
from typing import Callable, Literal

import httpx


_CF_ISSUER = re.compile(r"^https://[a-z0-9][a-z0-9-]*\.cloudflareaccess\.com$")
_SB_ISSUER = re.compile(r"^https://[a-z0-9-]+\.supabase\.co/auth/v1$")
_CF_PATH = "/cdn-cgi/access/certs"
_SB_PATH = "/.well-known/jwks.json"


class TrustedKeySourceDenied(Exception):
    def __init__(self, code: str = "TRUSTED_JWKS_UNAVAILABLE"):
        self.code = code
        super().__init__(code)


def _deny(code: str = "TRUSTED_JWKS_UNAVAILABLE"):
    raise TrustedKeySourceDenied(code)


class PinnedJwksSource:
    """Strict issuer/path pinning and bounded, fail-closed 60s public-key cache.

    Never accept an issuer, JWKS URL, host, certificate or JWKS directly from
    the HTTP request or client payload. Only trust reviewed SERVER config.
    Cloudflare Access and Supabase are fixed providers, not arbitrary domains.
    """

    def __init__(
        self, *, provider: Literal["cloudflare_access", "supabase"],
        issuer: str, transport: httpx.AsyncBaseTransport | None = None,
        clock: Callable[[], float] = time.time,
        ttl_seconds: int = 60,
    ) -> None:
        if not isinstance(provider, str) or provider not in {"cloudflare_access", "supabase"}:
            _deny("JWKS_CONFIG_INVALID")
        regexp = _CF_ISSUER if provider == "cloudflare_access" else _SB_ISSUER
        if not isinstance(issuer, str) or not regexp.fullmatch(issuer):
            _deny("JWKS_CONFIG_INVALID")
        if type(ttl_seconds) is not int or not 5 <= ttl_seconds <= 120 or not callable(clock):
            _deny("JWKS_CONFIG_INVALID")
        self._provider = provider
        self._url = issuer + (_CF_PATH if provider == "cloudflare_access" else _SB_PATH)
        self._transport = transport
        self._clock = clock
        self._ttl = ttl_seconds
        self._cached: dict | None = None
        self._expires_at = 0.0

    @property
    def pinned_url(self) -> str:
        """For private configuration review; never takes a user token or URL."""
        return self._url

    async def get_keys(self) -> dict:
        """Fail closed when cached JWKS expired and provider can't be reached."""
        try:
            now = float(self._clock())
            if not 0 < now < 1e12:
                _deny()
        except TrustedKeySourceDenied:
            raise
        except Exception:
            _deny()
        if self._cached is not None and now < self._expires_at:
            # defensive copy so a caller cannot poison the cached trust set
            return json.loads(json.dumps(self._cached))
        try:
            async with httpx.AsyncClient(
                transport=self._transport,
                timeout=httpx.Timeout(3.0),
                follow_redirects=False,
                trust_env=False,
                verify=True,
            ) as client:
                response = await client.get(
                    self._url, headers={"Accept": "application/json"}
                )
            if response.status_code != 200:
                _deny()
            ct = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
            if ct not in {"application/json", "application/jwk-set+json"}:
                _deny()
            if len(response.content) > 32_768:
                _deny()
            body = response.json()
            if not isinstance(body, Mapping) or not isinstance(body.get("keys"), list):
                _deny()
            keys = body["keys"]
            if not 1 <= len(keys) <= 16:
                _deny()
            valid = []
            kids = set()
            for key in keys:
                if not isinstance(key, dict):
                    _deny()
                kid = key.get("kid")
                if not isinstance(kid, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", kid):
                    _deny()
                if kid in kids:
                    _deny()
                kids.add(kid)
                alg = key.get("alg")
                kty = key.get("kty")
                if self._provider == "cloudflare_access":
                    if kty != "RSA" or (alg is not None and alg != "RS256"):
                        _deny()
                elif not (
                    (kty == "RSA" and (alg is None or alg == "RS256"))
                    or (kty == "EC" and key.get("crv") == "P-256"
                        and (alg is None or alg == "ES256"))
                ):
                    _deny()
                if key.get("use", "sig") != "sig" or "d" in key or "k" in key:
                    _deny()
                valid.append(dict(key))
            result = {"keys": valid}
            self._cached = result
            self._expires_at = now + self._ttl
            return json.loads(json.dumps(result))
        except TrustedKeySourceDenied:
            raise
        except (httpx.HTTPError, ValueError, TypeError, KeyError, json.JSONDecodeError):
            _deny()

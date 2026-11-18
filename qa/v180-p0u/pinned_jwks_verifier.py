"""V18.0-P0U - offline signed JWT verification contract, never mounted to Render.

Real cryptographic operations on synthetic JWTs are exercised in isolated CI.
JWKS dictionaries MUST be retrieved by an independently audited, pinned-origin
backend adapter and must NEVER be accepted from client payloads. Supports only
asymmetric RSA/EC signatures. Legacy Supabase HS256 requires a separate design
and approval; there is intentionally NO fallback to unsigned/decode-only JWTs.
"""
from __future__ import annotations

import math
import re
from collections.abc import Mapping
from typing import Any

import jwt
from jwt import PyJWK
from jwt.exceptions import PyJWTError


class SignatureDenied(Exception):
    def __init__(self, code="SIGNED_JWT_DENIED"):
        self.code = code
        super().__init__(code)


def _deny(code="SIGNED_JWT_DENIED"):
    raise SignatureDenied(code)


def _uuid(v):
    from uuid import UUID
    if not isinstance(v, str):
        return False
    try:
        parsed = UUID(v)
        return str(parsed) == v.lower() and parsed.version is not None
    except (ValueError, TypeError, AttributeError):
        return False


def _time(v):
    return type(v) in (int, float) and math.isfinite(v)


def _key_from_pinned_set(token: str, keyset: Mapping, allowed_algs: tuple[str, ...]):
    if not isinstance(token, str) or not (30 <= len(token) <= 4096) or token.count(".") != 2:
        _deny()
    if not isinstance(keyset, Mapping) or not isinstance(keyset.get("keys"), list):
        _deny("PINNED_KEYSET_UNAVAILABLE")
    keys = keyset["keys"]
    if not (1 <= len(keys) <= 16):
        _deny("PINNED_KEYSET_UNAVAILABLE")
    try:
        header = jwt.get_unverified_header(token)
    except PyJWTError:
        _deny()
    kid, alg = header.get("kid"), header.get("alg")
    if not isinstance(kid, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", kid):
        _deny()
    if alg not in allowed_algs or header.get("crit") is not None:
        _deny()
    matches = [key for key in keys if isinstance(key, Mapping) and key.get("kid") == kid]
    if len(matches) != 1:
        _deny("PINNED_KEY_NOT_FOUND")
    jwk = matches[0]
    if jwk.get("use", "sig") != "sig" or jwk.get("alg", alg) != alg:
        _deny()
    if (alg == "RS256" and jwk.get("kty") != "RSA") or (
        alg == "ES256" and (jwk.get("kty") != "EC" or jwk.get("crv") != "P-256")
    ):
        _deny()
    try:
        return PyJWK.from_dict(dict(jwk), algorithm=alg)
    except (PyJWTError, ValueError, TypeError, KeyError):
        _deny()


def _decode(token: str, *, pinned_keys: Mapping, issuer: str, audience: str,
            algorithms: tuple[str, ...], required: tuple[str, ...], now: int,
            max_lifetime_seconds: int):
    if not isinstance(issuer, str) or not re.fullmatch(r"https://[^/?#]+(?:/auth/v1)?", issuer):
        _deny("VERIFIER_NOT_CONFIGURED")
    if not isinstance(audience, str) or not (3 <= len(audience) <= 128):
        _deny("VERIFIER_NOT_CONFIGURED")
    if not _time(now) or not isinstance(max_lifetime_seconds, int) or max_lifetime_seconds <= 0:
        _deny("VERIFIER_NOT_CONFIGURED")
    key = _key_from_pinned_set(token, pinned_keys, algorithms)
    try:
        # The key is chosen from a PINNED trusted JWKS (not an unverified token URL).
        # Current time is checked independently below, preventing test environment
        # wall-clock dependence and avoiding private JWT payload leakage.
        payload = jwt.decode(
            token, key=key.key, algorithms=list(algorithms), audience=audience,
            issuer=issuer, options={"require": list(required),
                                    "verify_exp": False, "verify_iat": False,
                                    "verify_nbf": False},
        )
    except PyJWTError:
        _deny()
    exp, iat, nbf = payload.get("exp"), payload.get("iat"), payload.get("nbf")
    if not (_time(exp) and _time(iat) and _time(nbf)):
        _deny()
    if (iat > now + 30 or nbf > now + 30 or exp <= now
            or exp <= iat or exp - iat > max_lifetime_seconds):
        _deny()
    return payload


def verify_cloudflare_access_jwt(
    assertion: str, *, pinned_keys: Mapping, team_issuer: str,
    app_audience: str, now: int,
) -> dict:
    if not re.fullmatch(r"https://[a-z0-9.-]+\.cloudflareaccess\.com", team_issuer or ""):
        _deny("VERIFIER_NOT_CONFIGURED")
    data = _decode(
        assertion, pinned_keys=pinned_keys, issuer=team_issuer,
        audience=app_audience, algorithms=("RS256",),
        required=("iss", "aud", "sub", "exp", "iat", "nbf"),
        now=now, max_lifetime_seconds=3600,
    )
    if not isinstance(data.get("sub"), str) or not (8 <= len(data["sub"]) <= 256):
        _deny()
    # Output designed for the previously-reviewed Python protected candidate.
    return {"signature_verified": True, "issuer": team_issuer,
            "audience": app_audience, "principal_id": data["sub"],
            "expires_at": data["exp"]}


def verify_supabase_owner_jwt(
    bearer: str, *, pinned_keys: Mapping, supabase_issuer: str, now: int,
) -> dict:
    if not re.fullmatch(r"https://[a-z0-9-]+\.supabase\.co/auth/v1", supabase_issuer or ""):
        _deny("VERIFIER_NOT_CONFIGURED")
    data = _decode(
        bearer, pinned_keys=pinned_keys, issuer=supabase_issuer,
        audience="authenticated", algorithms=("RS256", "ES256"),
        required=("iss", "aud", "sub", "exp", "iat", "nbf", "session_id", "role"),
        now=now, max_lifetime_seconds=3600,
    )
    if (not _uuid(data.get("sub")) or not _uuid(data.get("session_id"))
            or data.get("role") != "authenticated" or data.get("is_anonymous") is not False):
        _deny()
    return {"signature_verified": True, "iss": supabase_issuer,
            "aud": "authenticated", "role": "authenticated",
            "sub": data["sub"], "session_id": data["session_id"],
            "iat": data["iat"], "exp": data["exp"], "is_anonymous": False}

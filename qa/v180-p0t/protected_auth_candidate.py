"""TIEN404 P0T — source-only, fail-closed Python port of the P0R admission contract.

Never imported or mounted by deployed FastAPI. All ports are REQUIRED trusted
server-side implementations. No cryptographic verifier, secret, database
connection, network call, JWT decoder, signed receipt, or Store grant lives here.
Synthetic tests cannot establish a real authorized Owner A/B UAT result.
"""
from __future__ import annotations

import asyncio
import math
import re
import time
import weakref
from collections.abc import Mapping
from typing import Any, Protocol
from uuid import UUID

_HANDLE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")


class AdmissionDenied(Exception):
    """Only a fixed, non-PII reason code; never include source credentials."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _deny(code: str) -> None:
    raise AdmissionDenied(code)


def _uuid(v: Any) -> bool:
    try:
        if not isinstance(v, str):
            return False
        parsed = UUID(v)
        return parsed.version in (1, 2, 3, 4, 5, 6, 7, 8) and str(parsed) == v.lower()
    except (ValueError, AttributeError, TypeError):
        return False


def _seconds(value: Any) -> bool:
    return type(value) in (float, int) and math.isfinite(value)


def _future(value: Any, now: float) -> bool:
    return _seconds(value) and value > now


def _record(value: Any) -> Mapping:
    return value if isinstance(value, Mapping) else {}


class TrustedPorts(Protocol):
    """Ports must do the real signed verification, never return client assertions."""

    async def verify_protected_access(self, assertion: str) -> Mapping: ...
    async def lookup_access_subject_binding(self, principal: str) -> Mapping: ...
    async def verify_signed_auth_claims(self, bearer: str) -> Mapping: ...
    async def fetch_live_auth_user(self, bearer: str) -> Mapping: ...
    async def lookup_current_auth_session(self, session_id: str, verified_subject_id: str) -> Mapping: ...
    async def lookup_current_owner_membership(self, tenant_id: str, user_id: str) -> Mapping: ...
    async def lookup_independent_owner_consent(
        self, consent_handle: str, user_id: str, pairing_handle: str
    ) -> Mapping: ...


_REQUIRED = (
    "verify_protected_access",
    "lookup_access_subject_binding",
    "verify_signed_auth_claims",
    "fetch_live_auth_user",
    "lookup_current_auth_session",
    "lookup_current_owner_membership",
    "lookup_independent_owner_consent",
)


class _OpaqueHandle:
    __slots__ = ("__weakref__",)


class ProtectedAuthCandidate:
    """Cannot authorize anything. In-process comparison is only a QA candidate."""

    def __init__(
        self, ports: TrustedPorts, *, auth_issuer: str, access_issuer: str,
        access_audience: str, tenant_scope: str, clock=time.time,
    ):
        if (
            ports is None
            or not all(callable(getattr(ports, name, None)) for name in _REQUIRED)
            or not isinstance(auth_issuer, str)
            or not re.fullmatch(r"https://[^/?#]+/auth/v1", auth_issuer)
            or not isinstance(access_issuer, str)
            or not re.fullmatch(r"https://[^/?#]+", access_issuer)
            or not isinstance(access_audience, str)
            or len(access_audience) < 3
            or not _uuid(tenant_scope)
            or not callable(clock)
        ):
            _deny("VERIFIER_NOT_CONFIGURED")
        self._ports = ports
        self._clock = clock
        self._issuer = auth_issuer
        self._access_issuer = access_issuer
        self._audience = access_audience
        self._tenant = tenant_scope
        self._evidence: weakref.WeakKeyDictionary[_OpaqueHandle, dict] = weakref.WeakKeyDictionary()
        self._used: weakref.WeakSet[_OpaqueHandle] = weakref.WeakSet()
        self._pair_lock = asyncio.Lock()

    async def _call(self, name: str, *args) -> Mapping:
        try:
            answer = await getattr(self._ports, name)(*args)
        except Exception:
            _deny("TRUSTED_PORT_UNAVAILABLE")
        return _record(answer)

    def _now(self) -> float:
        try:
            now = self._clock()
        except Exception:
            _deny("TRUSTED_CLOCK_UNAVAILABLE")
        if not _seconds(now):
            _deny("TRUSTED_CLOCK_UNAVAILABLE")
        return float(now)

    async def admit_actor(
        self, *, bearer: str, access_assertion: str,
        consent_handle: str, pairing_handle: str,
    ) -> _OpaqueHandle:
        now = self._now()
        if (
            not isinstance(bearer, str) or not (24 <= len(bearer) <= 4096)
            or not isinstance(access_assertion, str)
            or not (24 <= len(access_assertion) <= 4096)
            or not isinstance(consent_handle, str) or not _HANDLE.fullmatch(consent_handle)
            or not isinstance(pairing_handle, str) or not _HANDLE.fullmatch(pairing_handle)
        ):
            _deny("INPUT_NOT_ADMISSIBLE")
        access = await self._call("verify_protected_access", access_assertion)
        principal = access.get("principal_id")
        if (
            access.get("signature_verified") is not True
            or access.get("issuer") != self._access_issuer
            or access.get("audience") != self._audience
            or not _future(access.get("expires_at"), now)
            or not isinstance(principal, str) or len(principal) < 8
        ):
            _deny("PRIVATE_ACCESS_DENIED")

        binding = await self._call("lookup_access_subject_binding", principal)
        if binding.get("active") is not True or not _uuid(binding.get("auth_user_id")):
            _deny("ACCESS_OWNER_BINDING_DENIED")

        claims = await self._call("verify_signed_auth_claims", bearer)
        sub, sid = claims.get("sub"), claims.get("session_id")
        if (
            claims.get("signature_verified") is not True
            or claims.get("iss") != self._issuer
            or claims.get("aud") != "authenticated"
            or claims.get("role") != "authenticated"
            or not _uuid(sub) or not _uuid(sid)
            or not _seconds(claims.get("iat"))
            or claims["iat"] > now + 60
            or not _future(claims.get("exp"), now)
            or claims.get("is_anonymous") is not False
            or sub != binding.get("auth_user_id")
        ):
            _deny("SIGNED_CLAIMS_DENIED")

        live = await self._call("fetch_live_auth_user", bearer)
        if live.get("verified") is not True or live.get("disabled") is not False or live.get("id") != sub:
            _deny("LIVE_AUTH_USER_DENIED")

        await self._session_is_current(sid, sub, now, "SESSION_REVOKED_OR_MISMATCHED")
        await self._owner_is_current(sub, "TENANT_OWNER_DENIED")
        consent = await self._consent_is_current(
            consent_handle, sub, pairing_handle, now, "OWNER_CONSENT_DENIED"
        )
        handle = _OpaqueHandle()
        self._evidence[handle] = {
            "sub": sub, "session_id": sid, "principal": principal,
            "tenant": self._tenant, "pairing": pairing_handle,
            "consent": consent_handle,
            "expires_at": min(access["expires_at"], claims["exp"], consent["expires_at"]),
        }
        return handle

    async def _session_is_current(self, sid, sub, now, error):
        session = await self._call("lookup_current_auth_session", sid, sub)
        if (
            session.get("exists") is not True or session.get("revoked") is not False
            or session.get("id") != sid or session.get("user_id") != sub
            or (session.get("expires_at") is not None and
                not _future(session["expires_at"], now))
        ):
            _deny(error)

    async def _owner_is_current(self, sub, error):
        member = await self._call("lookup_current_owner_membership", self._tenant, sub)
        if (
            member.get("active") is not True or member.get("role") != "owner"
            or member.get("user_id") != sub or member.get("tenant_id") != self._tenant
        ):
            _deny(error)

    async def _consent_is_current(self, handle, sub, pairing, now, error):
        consent = await self._call("lookup_independent_owner_consent", handle, sub, pairing)
        if (
            consent.get("verified") is not True
            or consent.get("approved_by_owner") is not True
            or consent.get("used") is not False
            or consent.get("scope") != "read_only_identity"
            or consent.get("user_id") != sub
            or consent.get("pairing_handle") != pairing
            or not _future(consent.get("expires_at"), now)
        ):
            _deny(error)
        return consent

    async def correlate_pair(self, a: object, b: object) -> dict:
        now = self._now()
        async with self._pair_lock:
            if not isinstance(a, _OpaqueHandle) or not isinstance(b, _OpaqueHandle):
                _deny("PAIR_EVIDENCE_UNTRUSTED")
            x, y = self._evidence.get(a), self._evidence.get(b)
            if x is None or y is None or a is b or a in self._used or b in self._used:
                _deny("PAIR_EVIDENCE_UNTRUSTED")
            if not _future(x["expires_at"], now) or not _future(y["expires_at"], now):
                _deny("PAIR_EVIDENCE_EXPIRED")
            if (
                x["sub"] == y["sub"] or x["session_id"] == y["session_id"]
                or x["principal"] == y["principal"] or x["consent"] == y["consent"]
            ):
                _deny("PAIR_NOT_INDEPENDENT")
            if x["tenant"] != y["tenant"] or x["pairing"] != y["pairing"]:
                _deny("PAIR_SCOPE_MISMATCH")
            for item in (x, y):
                await self._session_is_current(
                    item["session_id"], item["sub"], now, "PAIR_SESSION_REVOKED"
                )
                await self._owner_is_current(item["sub"], "PAIR_OWNER_REVOKED")
                await self._consent_is_current(
                    item["consent"], item["sub"], item["pairing"], now, "PAIR_CONSENT_REVOKED"
                )
            # This only prevents replay inside this single process. There is NO
            # atomic durable consume, signed receipt or authorization here.
            self._used.add(a)
            self._used.add(b)
            return {
                "status": "IN_MEMORY_PAIR_CORRELATION_CANDIDATE",
                "synthetic_or_unverified_ports": True,
                "trusted_live_auth_confirmed": False,
                "signed_receipt_issued": False,
                "canonical_store_authority": False,
                "store_read_authorized": False,
                "orders_read_authorized": False,
                "provider_send_authorized": False,
                "production_approved": False,
            }

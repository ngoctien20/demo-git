"""V18.0-P0W — reviewable server-owned Supabase getUser read-only port.

SOURCE-ONLY; not deployed, no real JWTs. Host is pinned at construction from
server configuration, never from headers, body, token claim or arbitrary URL.
The getUser result is *not* proof that auth.sessions still exists; the P0V
current session adapter must be called independently at admission and replay.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Callable

import httpx


_SUPABASE_ORIGIN = re.compile(r"^https://[a-z0-9-]+\.supabase\.co$")


class LiveAuthUserDenied(Exception):
    def __init__(self, code="LIVE_AUTH_USER_DENIED"):
        self.code = code
        super().__init__(code)


def _deny(code="LIVE_AUTH_USER_DENIED"):
    raise LiveAuthUserDenied(code)


class PinnedSupabaseAuthUserSource:
    def __init__(self, *, project_origin: str, publishable_key: str,
                 transport: httpx.AsyncBaseTransport | None = None,
                 clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)):
        if not isinstance(project_origin, str) or not _SUPABASE_ORIGIN.fullmatch(project_origin):
            _deny("LIVE_AUTH_SOURCE_NOT_CONFIGURED")
        if (not isinstance(publishable_key, str)
                or not re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]{8,256}", publishable_key)):
            # Intentional: do not allow service-role or sb_secret_ keys in the
            # Auth-user proof path. Legacy anon JWT key requires explicit review.
            _deny("LIVE_AUTH_SOURCE_NOT_CONFIGURED")
        if not callable(clock):
            _deny("LIVE_AUTH_SOURCE_NOT_CONFIGURED")
        self._endpoint = project_origin + "/auth/v1/user"
        self._apikey = publishable_key
        self._transport = transport
        self._clock = clock

    async def get_live_user(self, bearer: str) -> dict:
        if (not isinstance(bearer, str) or not (40 <= len(bearer) <= 4096)
                or any(ord(ch) < 33 or ord(ch) > 126 for ch in bearer)):
            _deny()
        try:
            now = self._clock()
            if not isinstance(now, datetime) or now.tzinfo is None:
                _deny()
            async with httpx.AsyncClient(
                transport=self._transport,
                timeout=httpx.Timeout(3.0),
                follow_redirects=False,
                trust_env=False,
                verify=True,
            ) as client:
                response = await client.get(
                    self._endpoint,
                    headers={
                        "Accept": "application/json",
                        "apikey": self._apikey,
                        "Authorization": "Bearer " + bearer,
                    },
                )
            if response.status_code != 200:
                _deny()
            if len(response.content) > 16_384:
                _deny()
            if response.headers.get("content-type", "").split(";", 1)[0].lower().strip() != "application/json":
                _deny()
            user = response.json()
            if not isinstance(user, dict):
                _deny()
            from uuid import UUID
            uid = user.get("id")
            if not isinstance(uid, str) or str(UUID(uid)) != uid.lower():
                _deny()
            if (user.get("role") != "authenticated"
                    or user.get("is_anonymous") is not False
                    or user.get("deleted_at") is not None
                    or user.get("banned_until") is not None):
                _deny()
            # Never pass through email, phone, app/user metadata or JWT.
            return {
                "verified": True, "disabled": False,
                "id": uid,
                "live_session_and_store_authorized": False,
            }
        except LiveAuthUserDenied:
            raise
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            _deny()

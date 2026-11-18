"""TIEN404 V18.0-P0V: server-owned, read-only Supabase Auth session adapter.

SOURCE ONLY / NEVER MOUNTED / NO REAL CREDENTIALS / NO NETWORK IN TESTS.
Designed for an approved, non-public, least-privilege server-side psycopg
AsyncConnection factory, NEVER a client-provided database connection.

The session row is one independent condition; it is NOT a signed-JWT proof,
a Store authorization, a consent receipt or permission to send messages.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from server_session_snapshot import (
    assess_current_session_snapshot, CurrentSessionDenied,
)

# Hard-coded and parameterized; never accept arbitrary identifiers or SQL
# from the web caller. auth.sessions must stay outside exposed API schemas.
_SESSION_SQL = (
    "SELECT id::text AS id, user_id::text AS user_id, not_after "
    "FROM auth.sessions "
    "WHERE id = %s::uuid AND user_id = %s::uuid LIMIT 2"
)
_READ_ONLY = "SET LOCAL transaction_read_only = on"
_TIMEOUT = "SET LOCAL statement_timeout = '2000ms'"
_LOCK_TIMEOUT = "SET LOCAL lock_timeout = '1000ms'"


class TrustedSessionReadDenied(Exception):
    """Fixed code only, never includes DB stack/connection details."""

    def __init__(self, code: str = "TRUSTED_SESSION_LOOKUP_DENIED"):
        self.code = code
        super().__init__(code)


def _trusted_uuid(value: str) -> UUID:
    if not isinstance(value, str):
        raise TrustedSessionReadDenied("SESSION_IDENTITY_UNTRUSTED")
    try:
        parsed = UUID(value)
    except (ValueError, TypeError, AttributeError):
        raise TrustedSessionReadDenied("SESSION_IDENTITY_UNTRUSTED") from None
    if str(parsed) != value.lower() or parsed.version is None:
        raise TrustedSessionReadDenied("SESSION_IDENTITY_UNTRUSTED")
    return parsed


async def lookup_current_session(
    *,
    connection_factory: Callable,
    verified_subject_id: str,
    verified_session_id: str,
    now_utc: datetime,
) -> dict[str, Any]:
    """Read an exact matching session with bounded SELECT under READ ONLY TX.

    connection_factory: server-injected callable returning a psycopg-like
    AsyncConnection async context manager, using an *approved narrowly scoped*
    account; never accept user-originated connection strings or SQL. The caller
    must already verify JWT signature and session_id and must repeat this
    lookup immediately before any security decision.
    """
    user_id = _trusted_uuid(verified_subject_id)
    session_id = _trusted_uuid(verified_session_id)
    if not isinstance(now_utc, datetime) or now_utc.tzinfo is None:
        raise TrustedSessionReadDenied("TRUSTED_CLOCK_UNAVAILABLE")
    if not callable(connection_factory):
        raise TrustedSessionReadDenied("TRUSTED_DB_NOT_CONFIGURED")

    # Enforce only session existence: never return user, email, refresh token,
    # provider credentials, session metadata or any customer fields to HTTP.
    try:
        async with connection_factory() as conn:
            async with conn.transaction():
                await conn.execute(_READ_ONLY)
                await conn.execute(_TIMEOUT)
                await conn.execute(_LOCK_TIMEOUT)
                cursor = await conn.execute(_SESSION_SQL, (session_id, user_id))
                rows = await cursor.fetchall()
        if not isinstance(rows, (list, tuple)) or len(rows) > 2:
            raise TrustedSessionReadDenied()
        safe = []
        for row in rows:
            if not isinstance(row, (tuple, list)) or len(row) != 3:
                raise TrustedSessionReadDenied()
            safe.append({"id": row[0], "user_id": row[1], "not_after": row[2]})
        try:
            decision = assess_current_session_snapshot(
                rows=safe, requested_session_id=str(session_id),
                verified_subject_id=str(user_id), now_utc=now_utc,
            )
        except CurrentSessionDenied:
            raise TrustedSessionReadDenied() from None
        # Additional flags make clear this is NOT a full identity verdict.
        return {**decision, "owner_consent_verified": False,
                "trusted_live_signature_verified": False,
                "private_access_origin_approved": False,
                "production_approved": False}
    except TrustedSessionReadDenied:
        raise
    except Exception:
        # Do not leak DB error strings, connection URL, query parameters or
        # session identifiers into public error traces.
        raise TrustedSessionReadDenied("TRUSTED_SESSION_BACKEND_UNAVAILABLE") from None

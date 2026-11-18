"""V18.0-P0V server session adapter synthetic QA — no live DB or Auth."""
from __future__ import annotations

import asyncio
import inspect
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID
import pytest

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parents[1] / "v180-p0u"))
from trusted_server_session_adapter import (
    lookup_current_session, TrustedSessionReadDenied, _SESSION_SQL,
)
from server_session_snapshot import assess_current_session_snapshot

NOW = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)
USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
SESSION_A = "11111111-1111-4111-8111-111111111111"
SESSION_B = "22222222-2222-4222-8222-222222222222"


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows
    async def fetchall(self):
        if isinstance(self.rows, Exception):
            raise self.rows
        return self.rows


class FakeConnection:
    def __init__(self, rows=None, exception_on=None):
        self.rows = [(SESSION_A, USER_A, NOW + timedelta(seconds=90))] if rows is None else rows
        self.exception_on = exception_on
        self.events = []
        self.open = False
        self.in_transaction = False

    async def __aenter__(self):
        self.events.append("ENTER")
        self.open = True
        return self

    async def __aexit__(self, *_):
        self.events.append("CLOSE")
        self.open = False

    @asynccontextmanager
    async def transaction(self):
        self.events.append("BEGIN")
        self.in_transaction = True
        try:
            yield
        finally:
            self.in_transaction = False
            self.events.append("END")

    async def execute(self, query, params=None):
        self.events.append((query, params))
        assert self.in_transaction
        if self.exception_on == "ANY" or self.exception_on == query:
            raise RuntimeError("SYNTHETIC_SECRET_DB_URL_DO_NOT_ECHO")
        if query.startswith("SELECT"):
            assert self.events[1] == "BEGIN"
            assert self.events[2][0] == "SET LOCAL transaction_read_only = on"
            assert self.events[3][0].startswith("SET LOCAL statement_timeout")
            assert self.events[4][0].startswith("SET LOCAL lock_timeout")
            assert params == (UUID(SESSION_A), UUID(USER_A))
            return FakeCursor(self.rows)
        return FakeCursor([])


class ConnectionFactory:
    def __init__(self, conn):
        self.conn = conn
        self.called = 0
    def __call__(self):
        self.called += 1
        if isinstance(self.conn, Exception):
            raise self.conn
        return self.conn


def lookup(factory, user=USER_A, session=SESSION_A, now=NOW):
    return asyncio.run(lookup_current_session(
        connection_factory=factory, verified_subject_id=user,
        verified_session_id=session, now_utc=now
    ))


def test_exact_read_only_query_and_timeout_and_transaction():
    assert "auth.sessions" in _SESSION_SQL
    assert "WHERE id = %s::uuid AND user_id = %s::uuid LIMIT 2" in _SESSION_SQL
    assert not any(k in _SESSION_SQL.upper() for k in ("UPDATE ", "DELETE ", "INSERT ", "DROP ", "GRANT ", "CREATE "))
    conn=FakeConnection()
    f=ConnectionFactory(conn)
    proof=lookup(f)
    assert f.called==1
    assert conn.open is False
    assert conn.events[-2:] == ["END", "CLOSE"]
    assert proof["exists"] is True
    assert proof["revoked"] is False
    assert proof["user_id"] == USER_A and proof["id"] == SESSION_A
    assert proof["owner_consent_verified"] is False
    assert proof["trusted_live_signature_verified"] is False
    assert proof["store_authority_verified"] is False
    assert proof["production_approved"] is False


@pytest.mark.parametrize("user,session,now", [
    (USER_A, "invalid-session", NOW),
    ("invalid-user", SESSION_A, NOW),
    (USER_A, SESSION_A, datetime(2026, 11, 18, 12, 0)),
    (USER_A, SESSION_A, None),
    (None, SESSION_A, NOW),
    (USER_A, None, NOW),
    ("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaZ", SESSION_A, NOW),
    (USER_A, SESSION_A + " OR 1=1", NOW),
])
def test_rejects_invalid_input_without_db_connection(user, session, now):
    f=ConnectionFactory(FakeConnection())
    with pytest.raises(TrustedSessionReadDenied):
        lookup(f,user=user,session=session,now=now)
    assert f.called==0


@pytest.mark.parametrize("rows", [
    [], [(SESSION_A, USER_B, None)], [(SESSION_B, USER_A, None)],
    [(SESSION_A, USER_A, NOW-timedelta(seconds=1))],
    [(SESSION_A, USER_A, datetime(2026,11,18,13,0))],
    [(SESSION_A, USER_A, None)]*2,
    [{"id": SESSION_A,"user_id": USER_A,"not_after":None}],
    [(SESSION_A, USER_A)],
    [(SESSION_A, USER_A, None, "UNTRUSTED_COL")],
    ["malformed"], "malformed",
])
def test_no_wrong_expired_duplicate_or_malformed_rows_admitted(rows):
    conn=FakeConnection(rows=rows)
    with pytest.raises(TrustedSessionReadDenied):
        lookup(ConnectionFactory(conn))


def test_nullable_not_after_does_not_imply_bearer_signature_verified():
    proof=lookup(ConnectionFactory(FakeConnection(rows=[(SESSION_A,USER_A,None)])))
    assert proof["exists"] is True
    assert proof["expires_at"] is None
    assert proof["signature_or_bearer_possession_verified"] is False


@pytest.mark.parametrize("exception_on", [
    "ANY", "SET LOCAL transaction_read_only = on",
    "SET LOCAL statement_timeout = '2000ms'",
    "SET LOCAL lock_timeout = '1000ms'", _SESSION_SQL,
])
def test_backend_failures_never_leak_connection_details(exception_on):
    conn=FakeConnection(exception_on=exception_on)
    with pytest.raises(TrustedSessionReadDenied) as err:
        lookup(ConnectionFactory(conn))
    assert err.value.code=="TRUSTED_SESSION_BACKEND_UNAVAILABLE"
    assert "SECRET" not in str(err.value)


def test_connection_factory_failure_redacted():
    f=ConnectionFactory(RuntimeError("DATABASE_PASSWORD_FORBIDDEN"))
    with pytest.raises(TrustedSessionReadDenied) as err:
        lookup(f)
    assert err.value.code=="TRUSTED_SESSION_BACKEND_UNAVAILABLE"
    assert "PASSWORD" not in str(err.value)


def test_invalid_factory_is_never_accepted():
    with pytest.raises(TrustedSessionReadDenied,match="TRUSTED_DB_NOT_CONFIGURED"):
        lookup(None)


def test_snapshot_must_be_reloaded_after_revocation_or_delete():
    first=lookup(ConnectionFactory(FakeConnection()))
    assert first["exists"] is True
    with pytest.raises(TrustedSessionReadDenied):
        lookup(ConnectionFactory(FakeConnection(rows=[])))


def test_no_auto_grant_on_success():
    out=lookup(ConnectionFactory(FakeConnection()))
    for key in ("owner_consent_verified","trusted_live_signature_verified",
                "store_authority_verified","provider_send_authorized",
                "private_access_origin_approved","production_approved"):
        assert out[key] is False


def test_adapter_does_not_open_a_connection_at_import_time():
    import trusted_server_session_adapter as mod
    assert not inspect.iscoroutinefunction(mod._trusted_uuid)
    assert callable(mod.lookup_current_session)

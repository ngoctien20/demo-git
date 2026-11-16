"""TIEN404 Canary-03B — SQLite disposable *reference model* for PostgreSQL
atomic one-shot send-attempt semantics. SYNTHETIC ONLY. Never connects n8n,
Supabase, Meta, Store, customer data or a real Page.

A SQLite concurrency pass IS NOT a hosted PostgreSQL acceptance. The actual
PostgreSQL DDL/claim files are REVIEW-ONLY and require operator migration,
RLS/GRANT review, restore evidence and independent live QA.
"""
from __future__ import annotations
import hashlib
import hmac
import os
import sqlite3
from contextlib import closing
from pathlib import Path

FIXTURE_SECRET = b"TIEN404-ONLY-SYNTHETIC-FIXTURE-NOT-FOR-PRODUCTION"


def digest(value: str) -> str:
    """Synthetic HMAC stub to avoid ever entering real PSIDs/Page IDs."""
    return hmac.new(FIXTURE_SECRET, value.encode(), hashlib.sha256).hexdigest()


SCHEMA = """
CREATE TABLE IF NOT EXISTS approvals (
    campaign TEXT PRIMARY KEY,
    page_hmac TEXT NOT NULL,
    sender_hmac TEXT NOT NULL,
    profile_hash TEXT NOT NULL,
    marker TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('APPROVED','REVOKED','EXPIRED')),
    valid_from_ms INTEGER NOT NULL,
    expires_at_ms INTEGER NOT NULL,
    CHECK(expires_at_ms>valid_from_ms),
    CHECK(expires_at_ms<=valid_from_ms+600000)
);
CREATE TABLE IF NOT EXISTS claims (
    campaign TEXT PRIMARY KEY REFERENCES approvals(campaign),
    event_hmac TEXT NOT NULL UNIQUE,
    page_hmac TEXT NOT NULL,
    sender_hmac TEXT NOT NULL
);
"""


def setup(db_path: str) -> None:
    with closing(sqlite3.connect(db_path, timeout=15)) as conn:
        conn.executescript(SCHEMA)
        conn.commit()


def authorize(
    db_path: str, *, campaign: str, page: str, recipient: str,
    profile: str, now_ms: int, state: str = "APPROVED"
) -> None:
    # Synthetic only. Real authorizations MUST require independent evidence.
    with closing(sqlite3.connect(db_path, timeout=15)) as conn:
        conn.execute(
            "INSERT INTO approvals VALUES(?,?,?,?,?,?,?,?)",
            (campaign, digest(page), digest(recipient), digest(profile),
             "TIEN404-CANARY-LIVE02", state, now_ms - 1000, now_ms + 599000)
        )
        conn.commit()


def claim_once(
    db_path: str, *, campaign: str, page: str, recipient: str,
    profile: str, event: str, marker: str, now_ms: int
) -> str:
    """One connection/transaction per contender. Never sends a message.

    CLAIM_WON: eligible unique insert committed, caller may *theoretically*
    attempt at most one provider call only after all external gates pass.
    BLOCKED: duplicate, invalid recipient, revoked, expired, wrong marker.
    ERROR_BLOCKED: ambiguous DB error; never call provider/retry automatically.
    """
    try:
        conn = sqlite3.connect(db_path, timeout=15, isolation_level=None)
    except sqlite3.Error:
        # Fail closed even when the database cannot be opened.
        return "ERROR_BLOCKED"
    try:
        conn.execute("PRAGMA busy_timeout=15000")
        conn.execute("BEGIN IMMEDIATE")
        cur = conn.execute(
            """
            INSERT OR IGNORE INTO claims(campaign,event_hmac,page_hmac,sender_hmac)
            SELECT a.campaign, ?, a.page_hmac, a.sender_hmac
              FROM approvals a
             WHERE a.campaign=?
               AND a.page_hmac=?
               AND a.sender_hmac=?
               AND a.profile_hash=?
               AND a.marker=?
               AND a.state='APPROVED'
               AND a.valid_from_ms<=?
               AND a.expires_at_ms>?
            """,
            (digest(event), campaign, digest(page), digest(recipient),
             digest(profile), marker, now_ms, now_ms)
        )
        inserted = cur.rowcount
        conn.execute("COMMIT")
        return "CLAIM_WON" if inserted == 1 else "BLOCKED"
    except sqlite3.Error:
        try:
            conn.execute("ROLLBACK")
        except sqlite3.Error:
            pass
        return "ERROR_BLOCKED"
    finally:
        conn.close()


def count_claims(db_path: str) -> int:
    with closing(sqlite3.connect(db_path, timeout=15)) as conn:
        return conn.execute("SELECT COUNT(*) FROM claims").fetchone()[0]


def attest_no_real_external_dependency() -> dict:
    # This public QA module imports no Meta, n8n, Supabase or HTTP client.
    return {
        "fixture_only": True, "postgres_implementation_hosted_tested": False,
        "provider_messages_sent": 0, "orders_written": 0,
        "can_publish": False, "can_send": False
    }

"""V17.23U DIAG2: independent in-memory SQLite migration contract QA.

Offline: no Cloudflare D1 calls, no Zalo tokens, no customer records.
Python standard-library sqlite3 is enough; test exactly the committed SQL.
"""
from pathlib import Path
import re
import sqlite3
import unittest

SQL_FILE = Path(__file__).resolve().parent / "sql" / "qa_auth_rejection_once_preview.sql"
REASONS = (
    "CONTENT_TYPE", "BODY_SIZE", "BODY_PARSE", "ENVELOPE",
    "EVENT_KIND", "MESSAGE_SHAPE", "CHALLENGE", "EVENT_TIME",
)
INSERT = "INSERT OR IGNORE INTO qa_auth_rejection_once(reason) VALUES (?)"


class IsolatedDiagnosticSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript(SQL_FILE.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def count(self):
        return self.db.execute("SELECT COUNT(*) FROM qa_auth_rejection_once").fetchone()[0]

    def test_migration_is_create_only(self):
        sql = SQL_FILE.read_text(encoding="utf-8")
        statement = re.sub(r"(?m)^--.*$", "", sql).strip().upper()
        self.assertTrue(statement.startswith("CREATE TABLE IF NOT EXISTS QA_AUTH_REJECTION_ONCE"))
        for forbidden in ("DROP ", "ALTER ", "DELETE ", "TRIGGER ", "ATTACH ",
                          "PRAGMA ", "CREATE INDEX ", "VACUUM "):
            self.assertNotIn(forbidden, statement)

    def test_no_sensitive_columns_and_only_one_reason_field(self):
        columns = self.db.execute("PRAGMA table_info(qa_auth_rejection_once)").fetchall()
        self.assertEqual([c[1] for c in columns], ["reason"])
        self.assertEqual(columns[0][2], "TEXT")
        self.assertEqual(columns[0][3], 1)  # NOT NULL
        self.assertEqual(columns[0][5], 1)  # PRIMARY KEY

    def test_idempotent_migration_preserves_existing_diagnostic(self):
        self.db.execute(INSERT, ("CHALLENGE",))
        self.db.executescript(SQL_FILE.read_text(encoding="utf-8"))
        self.assertEqual(self.count(), 1)
        self.assertEqual(self.db.execute(
            "SELECT reason FROM qa_auth_rejection_once").fetchone(), ("CHALLENGE",))

    def test_only_eight_distinct_categories_are_storable(self):
        for reason in REASONS * 5:
            self.db.execute(INSERT, (reason,))
        self.assertEqual(self.count(), 8)
        self.assertEqual([r[0] for r in self.db.execute(
            "SELECT reason FROM qa_auth_rejection_once ORDER BY reason")], sorted(REASONS))

    def test_invalid_category_rejected_without_record(self):
        for payload in ("", "OTHER", "CHAT_ID_123456", "SECRET_TOKEN", "CHALLENGE extra"):
            with self.subTest(reason=payload):
                # OR IGNORE deliberately drops invalid rows, never persists PII.
                self.db.execute(INSERT, (payload,))
                self.assertEqual(self.count(), 0)
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute(
                        "INSERT INTO qa_auth_rejection_once(reason) VALUES (?)", (payload,)
                    )

    def test_null_reason_rejected(self):
        self.db.execute(INSERT, (None,))
        self.assertEqual(self.count(), 0)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO qa_auth_rejection_once(reason) VALUES (?)", (None,))

    def test_sql_injection_remains_data_and_cannot_change_schema(self):
        malicious = "CHALLENGE'); DROP TABLE qa_auth_rejection_once; --"
        self.db.execute(INSERT, (malicious,))
        self.assertEqual(self.count(), 0)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO qa_auth_rejection_once(reason) VALUES (?)", (malicious,))
        self.assertEqual(self.db.execute(
            "SELECT name FROM sqlite_master WHERE name='qa_auth_rejection_once'"
        ).fetchone()[0], "qa_auth_rejection_once")

    def test_transactions_can_roll_back_diagnostic_without_schema_loss(self):
        self.db.execute("BEGIN")
        self.db.execute(INSERT, ("EVENT_TIME",))
        self.db.rollback()
        self.assertEqual(self.count(), 0)
        self.db.execute(INSERT, ("EVENT_KIND",))
        self.db.commit()
        self.assertEqual(self.count(), 1)

    def test_only_disposable_table_ever_created(self):
        names = [x[0] for x in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")]
        self.assertEqual(names, ["qa_auth_rejection_once"])
        self.assertNotIn("Orders", names)
        self.assertNotIn("Customers", names)

    def test_accepted_one_slot_table_is_unchanged_and_independent(self):
        self.db.execute(
            """CREATE TABLE qa_canary_once (
                 slot TEXT PRIMARY KEY CHECK(slot='ONE'),
                 event_hmac TEXT NOT NULL,
                 accepted_at_ms INTEGER NOT NULL
            )"""
        )
        self.db.execute(
            "INSERT INTO qa_canary_once(slot,event_hmac,accepted_at_ms) VALUES (?,?,?)",
            ("ONE", "0" * 64, 1794958500000)
        )
        self.db.execute(INSERT, ("EVENT_TIME",))
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM qa_canary_once").fetchone()[0], 1)
        self.assertEqual(self.count(), 1)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO qa_canary_once(slot,event_hmac,accepted_at_ms) VALUES (?,?,?)",
                ("TWO", "1" * 64, 1794958500000)
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)

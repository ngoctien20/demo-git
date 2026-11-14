"""TIEN404 V12 R1 — isolated synthetic two-phase Owner pairing fixture.

This is NOT a Zalo webhook and NOT a signed-JWT verifier. Ingress secrets,
login sessions and recipients are QA fixtures; no production DB/HTTP access.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
from contextlib import contextmanager


class PairingDenied(ValueError):
    """Fail-closed synthetic identity or pairing check."""


def digest(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


class TwoPhasePairingQA:
    def __init__(self, database: sqlite3.Connection, clock):
        self.db = database
        self.clock = clock
        self.db.execute('PRAGMA foreign_keys=ON')

    def init(self):
        self.db.executescript('''
        CREATE TABLE shops(bot TEXT PRIMARY KEY, tenant TEXT NOT NULL,
          route_proof_hash TEXT NOT NULL, enabled INTEGER NOT NULL);
        CREATE TABLE memberships(bot TEXT NOT NULL REFERENCES shops(bot),
          subject TEXT NOT NULL, active INTEGER NOT NULL,
          PRIMARY KEY(bot,subject));
        CREATE TABLE sessions(session_hash TEXT PRIMARY KEY,
          subject TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE challenges(bot TEXT PRIMARY KEY REFERENCES shops(bot),
          subject TEXT NOT NULL, code_hash TEXT NOT NULL,
          expires REAL NOT NULL, failed INTEGER NOT NULL DEFAULT 0,
          consumed INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE claims(bot TEXT PRIMARY KEY REFERENCES shops(bot),
          challenge_hash TEXT NOT NULL, recipient_ref TEXT NOT NULL,
          inbound_ref TEXT NOT NULL, received_at REAL NOT NULL,
          state TEXT NOT NULL CHECK(state IN ('PENDING','CONFIRMED')));
        CREATE TABLE bindings(bot TEXT PRIMARY KEY REFERENCES shops(bot),
          subject TEXT NOT NULL, recipient_ref TEXT NOT NULL);
        ''')

    @contextmanager
    def tx(self):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            yield
        except BaseException:
            self.db.rollback()
            raise
        else:
            self.db.commit()

    def owner(self, session: str, bot: str) -> str:
        if not isinstance(session,str) or not isinstance(bot,str):
            raise PairingDenied('OWNER_SESSION_REQUIRED')
        row=self.db.execute('''
          SELECT m.subject FROM sessions s JOIN memberships m ON m.subject=s.subject
          JOIN shops b ON b.bot=m.bot
          WHERE s.session_hash=? AND s.expires>? AND m.bot=?
            AND m.active=1 AND b.enabled=1''',
            (digest(session), self.clock(), bot)).fetchone()
        if not row:
            raise PairingDenied('OWNER_SESSION_REQUIRED')
        return row[0]

    def issue(self, session: str, bot: str) -> str:
        """Dashboard step: request a short-lived code for this authenticated Owner."""
        with self.tx():
            subject=self.owner(session,bot)
            code=secrets.token_urlsafe(24)
            self.db.execute('DELETE FROM claims WHERE bot=?',(bot,))
            self.db.execute('''INSERT INTO challenges(bot,subject,code_hash,expires,failed,consumed)
              VALUES(?,?,?,?,0,0)
              ON CONFLICT(bot) DO UPDATE SET subject=excluded.subject,
              code_hash=excluded.code_hash,expires=excluded.expires,
              failed=0,consumed=0''',(bot,subject,digest(code),self.clock()+300))
            return code

    def claim(self, bot: str, route_proof: str, code: str,
              recipient: str, inbound_event: str) -> str:
        """Bot webhook step: create PENDING claim only, NEVER bind Owner."""
        if not all(isinstance(v,str) and 0<len(v)<=128
                   for v in (bot,route_proof,code,recipient,inbound_event)):
            raise PairingDenied('INVALID_INGRESS')
        if not recipient.startswith('qa-recipient-') or not inbound_event.startswith('qa-event-'):
            raise PairingDenied('NON_SYNTHETIC_INGRESS')
        with self.tx():
            shop=self.db.execute('SELECT route_proof_hash FROM shops WHERE bot=? AND enabled=1',(bot,)).fetchone()
            if not shop or not hmac.compare_digest(shop[0],digest(route_proof)):
                raise PairingDenied('BOT_INGRESS_DENIED')
            row=self.db.execute('SELECT code_hash,expires,failed,consumed FROM challenges WHERE bot=?',(bot,)).fetchone()
            if not row or row[1]<=self.clock() or row[2]>=5 or row[3]!=0:
                raise PairingDenied('CHALLENGE_UNAVAILABLE')
            if not hmac.compare_digest(row[0],digest(code)):
                self.db.execute('UPDATE challenges SET failed=MIN(5,failed+1) WHERE bot=?',(bot,))
                return 'INVALID_CODE'
            prior=self.db.execute('SELECT challenge_hash,recipient_ref,inbound_ref FROM claims WHERE bot=?',(bot,)).fetchone()
            if prior:
                if prior[0]==row[0] and prior[1]==recipient and prior[2]==inbound_event:
                    return 'DUPLICATE_PENDING'
                raise PairingDenied('CLAIM_CONFLICT')
            self.db.execute('''INSERT INTO claims(bot,challenge_hash,recipient_ref,inbound_ref,received_at,state)
              VALUES(?,?,?,?,?,'PENDING')''',(bot,row[0],recipient,inbound_event,self.clock()))
            return 'PENDING_OWNER_CONFIRMATION'

    def confirm(self, session: str, bot: str) -> str:
        """Dashboard step: only issuer may bind claimed recipient, within time limit."""
        with self.tx():
            subject=self.owner(session,bot)
            challenge=self.db.execute('SELECT subject,code_hash,expires,consumed FROM challenges WHERE bot=?',(bot,)).fetchone()
            claim=self.db.execute('SELECT challenge_hash,recipient_ref,received_at,state FROM claims WHERE bot=?',(bot,)).fetchone()
            if not challenge or not claim or subject!=challenge[0] or challenge[3]!=0:
                raise PairingDenied('ISSUER_REQUIRED')
            if challenge[2]<=self.clock() or claim[2]+600<=self.clock() or claim[3]!='PENDING':
                raise PairingDenied('EXPIRED_OR_ALREADY_CONFIRMED')
            if not hmac.compare_digest(challenge[1],claim[0]):
                raise PairingDenied('STALE_CHALLENGE')
            self.db.execute('UPDATE challenges SET consumed=1 WHERE bot=? AND consumed=0',(bot,))
            self.db.execute("UPDATE claims SET state='CONFIRMED' WHERE bot=? AND state='PENDING'",(bot,))
            self.db.execute('''INSERT INTO bindings(bot,subject,recipient_ref) VALUES(?,?,?)
              ON CONFLICT(bot) DO UPDATE SET subject=excluded.subject,
              recipient_ref=excluded.recipient_ref''',(bot,subject,claim[1]))
            return 'PAIRED'

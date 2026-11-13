"""Synthetic Owner two-phase pairing tests (NOT signed Supabase JWT or Zalo)."""
import sqlite3
import unittest
from pairing_v3 import TwoPhasePairingQA, PairingDenied, digest

class OwnerPairingV3QA(unittest.TestCase):
    def setUp(self):
        self.now=1000
        self.db=sqlite3.connect(':memory:',isolation_level=None)
        self.addCleanup(self.db.close)
        self.s=TwoPhasePairingQA(self.db,lambda:self.now)
        self.s.init()
        for bot in ('a','b'):
            self.db.execute('insert into shops values(?,?,?,1)',(bot,'tenant-'+bot,digest('route-'+bot)))
            self.db.execute('insert into memberships values(?,?,1)',(bot,'owner-'+bot))
            self.db.execute('insert into sessions values(?,?,?)',(digest('login-'+bot),'owner-'+bot,2000))
        self.db.execute("insert into memberships values('b','other-owner-b',1)")
        self.db.execute('insert into sessions values(?,?,?)',(digest('login-other-b'),'other-owner-b',2000))

    def pending(self, bot):
        code=self.s.issue('login-'+bot,bot)
        self.assertEqual(self.s.claim(bot,'route-'+bot,code,'qa-recipient-'+bot,'qa-event-'+bot),
                         'PENDING_OWNER_CONFIRMATION')
        return code

    def test_a_and_b_require_dashboard_confirmation(self):
        for bot in ('a','b'):
            self.pending(bot)
            self.assertIsNone(self.db.execute('select * from bindings where bot=?',(bot,)).fetchone())
            self.assertEqual(self.s.confirm('login-'+bot,bot),'PAIRED')
            self.assertEqual(self.db.execute('select recipient_ref from bindings where bot=?',(bot,)).fetchone()[0],
                             'qa-recipient-'+bot)

    def test_same_shop_other_owner_denied(self):
        self.pending('b')
        with self.assertRaises(PairingDenied): self.s.confirm('login-other-b','b')
        self.assertIsNone(self.db.execute("select * from bindings where bot='b'").fetchone())
        self.assertEqual(self.s.confirm('login-b','b'),'PAIRED')

    def test_cross_bot_and_cross_owner_denied(self):
        code=self.s.issue('login-a','a')
        with self.assertRaises(PairingDenied):
            self.s.claim('b','route-a',code,'qa-recipient-a','qa-event-a')
        self.assertEqual(self.s.claim('a','route-a',code,'qa-recipient-a','qa-event-a'),
                         'PENDING_OWNER_CONFIRMATION')
        with self.assertRaises(PairingDenied): self.s.confirm('login-b','a')

    def test_five_failures_lock_out_correct_code(self):
        code=self.s.issue('login-a','a')
        for i in range(5):
            self.assertEqual(self.s.claim('a','route-a','invalid-'+str(i),
                'qa-recipient-a','qa-event-invalid-'+str(i)),'INVALID_CODE')
        with self.assertRaises(PairingDenied):
            self.s.claim('a','route-a',code,'qa-recipient-a','qa-event-correct')
        self.assertIsNone(self.db.execute("select * from claims where bot='a'").fetchone())

    def test_idempotency_and_replay(self):
        code=self.pending('a')
        self.assertEqual(self.s.claim('a','route-a',code,'qa-recipient-a','qa-event-a'),
                         'DUPLICATE_PENDING')
        with self.assertRaises(PairingDenied):
            self.s.claim('a','route-a',code,'qa-recipient-other','qa-event-changed')
        self.assertEqual(self.s.confirm('login-a','a'),'PAIRED')
        with self.assertRaises(PairingDenied):self.s.confirm('login-a','a')

    def test_expired_and_unclaimed_deny(self):
        self.s.issue('login-a','a')
        with self.assertRaises(PairingDenied): self.s.confirm('login-a','a')
        code=self.s.issue('login-a','a')
        self.now=1301
        with self.assertRaises(PairingDenied):
            self.s.claim('a','route-a',code,'qa-recipient-a','qa-event-a')

    def test_reissue_invalidates_old_claim(self):
        self.pending('a')
        self.s.issue('login-a','a')
        with self.assertRaises(PairingDenied): self.s.confirm('login-a','a')

    def test_invalid_login_or_non_synthetic_ingress(self):
        code=self.s.issue('login-a','a')
        with self.assertRaises(PairingDenied):
            self.s.claim('a','route-a',code,'real-recipient','qa-event-a')
        with self.assertRaises(PairingDenied):
            self.s.claim('a','route-a',code,'qa-recipient-a','real-event')
        with self.assertRaises(PairingDenied): self.s.issue('unknown-login','a')
        with self.assertRaises(PairingDenied): self.s.confirm('unknown-login','a')

if __name__=='__main__':
    unittest.main()

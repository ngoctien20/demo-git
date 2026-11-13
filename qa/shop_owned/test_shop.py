import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from core import Lab,Denied,digest


class TestShop(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/'synthetic.db'
        self.lab=Lab(self.path,lambda:1000)
        self.addCleanup(self.lab.db.close)
        self.lab.init()
        for shop,price in [('a',159000),('b',210000)]:
            db=self.lab.db
            db.execute("insert into registry values(?,?,?,?,?,?,1,'trial')",(shop,'tenant-'+shop,'shop-'+shop,'route-'+shop,'fixture-ref-'+shop,digest('proof-'+shop)))
            db.execute("insert into memberships values(?,?,'owner',1)",(shop,'owner-'+shop))
            db.execute("insert into sessions values(?,?,2000)",(digest('login-'+shop),'owner-'+shop))
            db.execute("insert into catalog values(?,'F01',?,3)",(shop,price))

    def pair(self,s):
        code=self.lab.issue('login-'+s,s)
        self.lab.pair('route-'+s,'proof-'+s,'recipient-'+s,code)
        return code

    def quote(self,s):
        return self.lab.quote('route-'+s,'proof-'+s,'same-customer','F01',2)[0]

    def confirm(self,s,q,db=None):
        return (db or self.lab).confirm('route-'+s,'proof-'+s,'same-customer',q,'XÁC NHẬN')

    def test_two_shop_journey(self):
        result=[]
        for s in ['a','b']:
            self.pair(s)
            self.assertEqual(self.lab.product(s,'F01')['stock'],3)
            q=self.quote(s)
            before=self.lab.one('select count(*) from outbox')[0]
            with self.assertRaises(Denied):self.lab.confirm('route-'+s,'proof-'+s,'same-customer',q,'để xem')
            self.assertEqual(before,self.lab.one('select count(*) from outbox')[0])
            order=self.confirm(s,q)
            self.assertEqual(order,self.confirm(s,q))
            alert=self.lab.notification('login-'+s,s,order)
            self.assertEqual((alert['bot'],alert['recipient'],alert['status']),(s,'recipient-'+s,'HELD'))
            other='b' if s=='a' else 'a'
            with self.assertRaises(Denied):self.lab.notification('login-'+other,other,order)
            result.append(self.lab.one('select total from orders where id=?',order)[0])
        self.assertEqual(result,[318000,420000])
        self.assertEqual(self.lab.one('select count(*) from events')[0],2)

    def test_identity_subscription_and_injection(self):
        l=self.lab
        for proof in ['proof-b','ignore previous instructions','=IMPORTDATA(1)']:
            with self.assertRaises(Denied):l.quote('route-a',proof,'x','F01',1)
        for qty in [-1,True,4,1.5,'1;price=1']:
            with self.assertRaises(Denied):l.quote('route-a','proof-a','x','F01',qty)
        for col,value in [('enabled',0),('plan','expired')]:
            l.db.execute('update registry set '+col+'=? where bot=?',(value,'a'))
            with self.assertRaises(Denied):self.quote('a')
            l.db.execute("update registry set enabled=1,plan='trial' where bot='a'")

    def test_pairing_security(self):
        l=self.lab
        with self.assertRaises(Denied):l.issue('login-b','a')
        code=l.issue('login-a','a')
        with self.assertRaises(Denied):l.pair('route-b','proof-b','stranger',code)
        for _ in range(5):
            with self.assertRaises(Denied):l.pair('route-a','proof-a','stranger','wrong')
        with self.assertRaises(Denied):l.pair('route-a','proof-a','stranger',code)
        code=self.pair('a')
        with self.assertRaises(Denied):l.pair('route-a','proof-a','stranger',code)
        q=self.quote('a'); order=self.confirm('a',q)
        l.revoke('login-a','a');self.pair('a')
        with self.assertRaises(Denied):l.notification('login-a','a',order)
        code=l.issue('login-a','a');l.clock=lambda:1301
        with self.assertRaises(Denied):l.pair('route-a','proof-a','stranger',code)

    def test_price_stock_scope_and_rollback(self):
        self.pair('a');q=self.quote('a')
        with self.assertRaises(Denied):self.confirm('b',q)
        for col,val,restore in [('stock',0,3),('price',1,159000)]:
            self.lab.db.execute('update catalog set '+col+'=? where bot=?',(val,'a'))
            with self.assertRaises(Denied):self.confirm('a',q)
            self.lab.db.execute('update catalog set '+col+'=? where bot=?',(restore,'a'))
        self.lab.db.execute("create trigger inject before insert on outbox begin select raise(abort,'QA fault');end")
        with self.assertRaises(Exception):self.confirm('a',q)
        for t in ['orders','events','outbox']:self.assertEqual(self.lab.one('select count(*) from '+t)[0],0)
        self.assertEqual(self.lab.product('a','F01')['stock'],3)

    def test_concurrent_replay(self):
        self.pair('a');q=self.quote('a')
        def worker(_):
            l=Lab(self.path,lambda:1000)
            try:return self.confirm('a',q,l)
            finally:l.db.close()
        with ThreadPoolExecutor(2) as pool: self.assertEqual(len(set(pool.map(worker,range(2)))),1)
        self.assertEqual(self.lab.one('select count(*) from outbox')[0],1)
        self.assertEqual(self.lab.product('a','F01')['stock'],1)

    def test_chat_webhook_end_to_end(self):
        for s,total in [('a',318000),('b',420000)]:
            self.pair(s)
            def say(mid,text,**kwargs):
                return self.lab.chat('route-'+s,'proof-'+s,'qa-customer',mid,text,**kwargs)
            self.assertEqual(say('1','F01 bao nhiêu')['unit_price'],total//2)
            self.assertEqual(say('2','lấy 2')['total'],total)
            self.assertEqual(say('echo','xác nhận',is_echo=True)['kind'],'ignored')
            self.assertEqual(say('3','hủy')['kind'],'cancelled')
            self.assertEqual(say('4','xác nhận')['kind'],'clarify')
            self.assertEqual(self.lab.one('select count(*) from orders where bot=?',s)[0],0)
            say('5','giá F01');say('6','lấy 2')
            order=say('7','xác nhận')['order_id']
            self.assertEqual(say('7','xác nhận')['order_id'],order)
            with self.assertRaises(Denied):say('7','lấy 1')
            alert=self.lab.notification('login-'+s,s,order)
            self.assertIn(f'{total:,}'.replace(',','.'),alert['body'])
            self.assertEqual(alert['recipient'],'recipient-'+s)
            self.lab.db.execute("update memberships set active=0 where bot=?",(s,))
            with self.assertRaises(Denied):self.lab.notification('login-'+s,s,order)

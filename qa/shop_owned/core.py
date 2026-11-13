"""Shop-owned bot QA service. SQLite fixture database only. No provider transport."""
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "notification"))
from format_alert import format_order_alert


class Denied(ValueError):
    pass


def require(condition, reason):
    if not condition:
        raise Denied(reason)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class Lab:
    def __init__(self, path, clock=time.time):
        self.db = sqlite3.connect(path, isolation_level=None, timeout=5)
        self.db.row_factory = sqlite3.Row
        self.clock = clock
        self.db.execute("pragma foreign_keys=on")

    @contextmanager
    def tx(self):
        if self.db.in_transaction:
            yield
            return
        self.db.execute("begin immediate")
        try:
            yield
            self.db.commit()
        except BaseException:
            self.db.rollback()
            raise

    def one(self, query, *args):
        return self.db.execute(query,args).fetchone()

    def init(self):
        self.db.executescript(Path(__file__).with_name("schema.sql").read_text())

    def shop(self, bot):
        b=self.one("select * from registry where bot=? and enabled=1 and plan in ('trial','active')",bot)
        require(b, "inactive_bot")
        return b

    def ingress(self, route, proof):
        b=self.one("select * from registry where route=?",route)
        require(b and hmac.compare_digest(b["proof_hash"],digest(proof)), "unauthorized_bot")
        return self.shop(b["bot"])

    def owner(self, session, bot):
        # Fixture session is opaque, issued by the test login backend.
        r=self.one("""select m.subject from sessions s join memberships m on s.subject=m.subject
        where s.session_hash=? and s.expires>? and m.bot=? and m.role='owner' and m.active=1""",
                   digest(session),self.clock(),bot)
        require(r, "owner_required")
        return r[0]

    def issue(self, session, bot):
        with self.tx():
            self.shop(bot)
            subject=self.owner(session,bot)
            code=secrets.token_urlsafe(18)
            self.db.execute("insert or replace into challenges values (?,?,?,?,0)",
                            (bot,subject,digest(code),self.clock()+300))
            return code

    def pair(self, route, proof, chat, code):
        with self.tx():
            bot=self.ingress(route,proof)["bot"]
            c=self.one("select * from challenges where bot=?",bot)
            require(c and c["expires"]>self.clock() and c["attempts"]<5, "challenge_unavailable")
            matched=hmac.compare_digest(digest(code),c["code_hash"])
            if not matched:
                self.db.execute("update challenges set attempts=attempts+1 where bot=?",(bot,))
            else:
                require(self.one("select 1 from memberships where bot=? and subject=? and active=1 and role='owner'",bot,c["subject"]), "owner_required")
                self.db.execute("insert or replace into bindings values(?,?,?,?)",(bot,c["subject"],chat,secrets.token_hex(12)))
                self.db.execute("delete from challenges where bot=?",(bot,))
                self.audit(bot,'paired')
        require(matched,'invalid_code')

    def audit(self,bot,action):
        self.db.execute("insert into audit values(?,?,?)",(bot,action,self.clock()))

    def revoke(self,session,bot):
        with self.tx():
            self.owner(session,bot)
            self.db.execute("delete from bindings where bot=?",(bot,))
            self.db.execute("delete from challenges where bot=?",(bot,))
            self.audit(bot,'revoked')

    def product(self,bot,sku):
        p=self.one("select * from catalog where bot=? and sku=?",bot,sku)
        require(p,'unknown_sku')
        return p

    def quote(self,route,proof,actor,sku,qty):
        with self.tx():
            b=self.ingress(route,proof)
            p=self.product(b['bot'],sku)
            require(type(qty) is int and 1<=qty<=p['stock'],'bad_quantity')
            q=secrets.token_hex(12)
            self.db.execute("update quotes set expires=0 where bot=? and actor=?",(b['bot'],actor))
            self.db.execute("insert into quotes values(?,?,?,?,?,?,?)",
                            (q,b['bot'],actor,sku,qty,p['price'],self.clock()+1800))
            return q,p['price']*qty

    def confirm(self,route,proof,actor,q,decision):
        require(decision=='XÁC NHẬN','confirmation_required')
        with self.tx():
            b=self.ingress(route,proof)
            row=self.one("select * from quotes where id=? and actor=? and bot=?",q,actor,b['bot'])
            require(row,'invalid_preview')
            old=self.one("select id from orders where quote=?",q)
            if old: return old[0]
            require(row['expires']>self.clock(),'expired_preview')
            p=self.product(b['bot'],row['sku'])
            require(row['price']==p['price'] and row['qty']<=p['stock'],'quote_changed')
            order='QA-'+secrets.token_hex(8)
            self.db.execute("update catalog set stock=stock-? where bot=? and sku=?",(row['qty'],b['bot'],p['sku']))
            self.db.execute("insert into orders values (?,?,?,?,?,?,?,?,?,?,?,'pending','synthetic_qa')",
                            (order,q,b['tenant'],b['store'],b['bot'],actor,p['sku'],row['qty'],p['price'],row['qty']*p['price'],self.clock()))
            saved=self.one("select * from orders where id=? and bot=?",order,b['bot'])
            require(saved and saved['total']==row['qty']*p['price'],'readback_failed')
            binding=self.binding(b['bot'])
            # Missing pairing does not discard an already confirmed sandbox sale.
            self.db.execute("insert into events values(?,?,'order_sandbox_saved')",(order,b['bot']))
            if binding:
                self.db.execute("insert into outbox values(?,?,?,?,?,'HELD')",
                                (order,b['bot'],binding['generation'],binding['recipient'],b['credential_ref']))
            self.audit(b['bot'],'sandbox_saved')
            return order

    def binding(self,bot):
        return self.one("""select b.* from bindings b join memberships m on
        b.bot=m.bot and b.subject=m.subject where b.bot=? and m.active=1 and m.role='owner'""",bot)

    def notification(self,session,bot,order):
        with self.tx():
            self.owner(session,bot)
            b=self.shop(bot)
            binding=self.binding(bot)
            row=self.one("""select o.*,x.recipient,x.generation,x.credential_ref from orders o
              join outbox x on x.order_id=o.id and x.bot=o.bot where o.id=? and o.bot=? and x.state='HELD'""",order,bot)
            require(row and binding and row['generation']==binding['generation'] and
                    row['recipient']==binding['recipient'] and row['credential_ref']==b['credential_ref'],'no_delivery')
            body=format_order_alert({'order_id':order,'created_at':datetime.fromtimestamp(row['confirmed'],timezone.utc).isoformat(),
                    'status':row['status'],'total_vnd':str(row['total']),'items':[{'sku':row['sku'],'quantity':row['qty'],'unit_price_vnd':str(row['price'])}]})
            return {'status':'HELD','bot':bot,'recipient':binding['recipient'],'body':f"Đơn thử nghiệm · {b['store']}\n"+body}

    def chat(self,route,proof,actor,mid,text,*,is_echo=False):
        """Private synthetic webhook harness. Transport supplies actor and echo flag."""
        with self.tx():
            bot=self.ingress(route,proof)['bot']
            if is_echo:return {'kind':'ignored'}
            require(all(isinstance(s,str) and 0<len(s)<=128 for s in (actor,mid)), 'invalid_identity')
            require(isinstance(text,str) and 0<len(text)<=512,'invalid_text')
            signature=digest(text)
            prev=self.one('select signature,reply from turns where bot=? and actor=? and mid=?',bot,actor,mid)
            if prev:
                require(prev['signature']==signature,'replay_conflict')
                return json.loads(prev['reply'])
            old=self.one('select sku,quote from memory where bot=? and actor=? and expires>?',bot,actor,self.clock())
            sku,q=(old['sku'],old['quote']) if old else (None,None)
            phrase=text.strip().casefold()
            quantity=re.fullmatch(r'lấy ([1-9][0-9]{0,3})',phrase)
            lookup=re.fullmatch(r'(?:giá )?([a-z][a-z0-9-]{0,19})(?: bao nhiêu)?',phrase)
            if phrase=='xác nhận' and q:
                reply={'kind':'sandbox_saved','order_id':self.confirm(route,proof,actor,q,'XÁC NHẬN')}
                q=None
            elif quantity and sku:
                q,total=self.quote(route,proof,actor,sku,int(quantity[1]))
                reply={'kind':'preview','total':total,'sku':sku}
            elif phrase in ('thôi','hủy','không lấy'):
                if q:self.db.execute('update quotes set expires=0 where id=?',(q,))
                sku,q=None,None
                reply={'kind':'cancelled'}
            elif lookup:
                p=self.product(bot,lookup[1].upper())
                if q:self.db.execute('update quotes set expires=0 where id=?',(q,))
                sku,q=p['sku'],None
                reply={'kind':'catalog','sku':sku,'unit_price':p['price'],'stock':p['stock']}
            else:
                reply={'kind':'clarify'}
            self.db.execute('insert or replace into memory values(?,?,?,?,?)',(bot,actor,sku,q,self.clock()+1800))
            self.db.execute('insert into turns values(?,?,?,?,?)',(bot,actor,mid,signature,json.dumps(reply)))
            return reply

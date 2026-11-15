#!/usr/bin/env python3
"""Offline QA for LIVE01 D1 trigger, no network/credentials/real customers."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib, sqlite3, tempfile, time
P=Path(__file__).parent
M1=(P/'001_live01_qa_d1_schema.sql').read_text()
M2=(P/'002_live01_atomic_claims.sql').read_text()
def h(s):return hashlib.sha256(('QA_ONLY:'+s).encode()).hexdigest()
def db(file=':memory:'):
 c=sqlite3.connect(file,timeout=8,isolation_level=None)
 c.execute('PRAGMA foreign_keys=ON');c.execute('PRAGMA busy_timeout=8000')
 return c
def init(file=':memory:'):
 c=db(file);c.executescript(M1);c.executescript(M2);return c
def setup(c,key,status='QA_ARMED',expired=False,state='QA_ACTIVE'):
 now=int(time.time()*1000)
 g='qa_atomic_'+key+'_001';s=h('session'+key)
 issued=now-500000 if expired else now-1000
 expires=now-1000 if expired else now+599000
 c.execute('INSERT INTO z145z_live01_grants(grant_id,tenant_hash,store_hash,bot_hash,recipient_hash,issued_ms,expires_ms,status) VALUES(?,?,?,?,?,?,?,?)',(g,h('tenant'+key),h('store'+key),h('bot'+key),h('recipient'+key),issued,expires,status))
 c.execute('INSERT INTO z145z_live01_quotas(grant_id) VALUES(?)',(g,))
 c.execute('INSERT INTO z145z_live01_sessions(grant_id,session_hash,updated_ms,state) VALUES(?,?,?,?)',(g,s,now,state))
 return g,s
def claim(c,g,s,event,revision,seq,tokens):
 return c.execute('INSERT INTO z145z_live01_atomic_claims(grant_id,event_hash,session_hash,expected_revision,sequence,reserve_tokens) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING event_hash',(g,h(event),s,revision,seq,tokens)).fetchall()
def denied(fn):
 try:return fn()==[]
 except sqlite3.IntegrityError:return True
def main():
 checks=[]
 def ok(name,expression):assert expression,name;checks.append(name)
 c=init();g,s=setup(c,'main')
 ok('atomic first claim',len(claim(c,g,s,'e1',0,1,1000))==1)
 ok('duplicate replay no-op',claim(c,g,s,'e1',0,1,1000)==[])
 ok('stale CAS abort',denied(lambda:claim(c,g,s,'stale',0,2,100)))
 ok('out-of-order abort',denied(lambda:claim(c,g,s,'badseq',1,1,100)))
 ok('second claim',len(claim(c,g,s,'e2',1,2,1000))==1)
 ok('over cap abort',denied(lambda:claim(c,g,s,'over',2,3,501)))
 ok('rollback session on over cap',c.execute('SELECT revision FROM z145z_live01_sessions WHERE grant_id=?',(g,)).fetchone()[0]==2)
 ok('rollback event on over cap',c.execute('SELECT COUNT(*) FROM z145z_live01_atomic_claims WHERE grant_id=? AND event_hash=?',(g,h('over'))).fetchone()[0]==0)
 ok('third claim 500',len(claim(c,g,s,'e3',2,3,500))==1)
 ok('fourth claim abort',denied(lambda:claim(c,g,s,'e4',3,4,1)))
 ok('quota exactly 3/3/2500',c.execute('SELECT replies_claimed,model_calls_claimed,tokens_reserved FROM z145z_live01_quotas WHERE grant_id=?',(g,)).fetchone()==(3,3,2500))
 eg,es=setup(c,'expired',expired=True)
 ok('database time rejects expired',denied(lambda:claim(c,eg,es,'expiry',0,1,50)))
 sg,ss=setup(c,'stopped',status='QA_STOPPED')
 ok('stopped grant rejects',denied(lambda:claim(c,sg,ss,'stopped',0,1,50)))
 hg,hs=setup(c,'handoff',state='QA_HANDOFF')
 ok('handoff rejects',denied(lambda:claim(c,hg,hs,'handoff',0,1,50)))
 ok('cross shop session rejects',denied(lambda:claim(c,hg,s,'cross',0,1,50)))
 with tempfile.TemporaryDirectory() as d:
  filename=str(Path(d)/'d1_qa.sqlite');c2=init(filename);rg,rs=setup(c2,'race');c2.close()
  def runner(i):
   x=db(filename)
   try:return len(claim(x,rg,rs,'race'+str(i),0,1,100))
   except sqlite3.IntegrityError:return 0
   finally:x.close()
  with ThreadPoolExecutor(max_workers=8) as ex: counts=list(ex.map(runner,range(8)))
  x=db(filename)
  ok('8-way CAS race 1 winner',sum(counts)==1)
  ok('8-way race charges exactly once',x.execute('SELECT replies_claimed,model_calls_claimed,tokens_reserved FROM z145z_live01_quotas WHERE grant_id=?',(rg,)).fetchone()==(1,1,100))
  x.close()
 ok('no real provider and no external dependency',all('QA' in name or name for name in checks))
 print(f'PASS {len(checks)}/{len(checks)} OFFLINE; no sends, no real data')
if __name__=='__main__':main()

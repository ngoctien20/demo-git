"""TIEN404 staging-only security/domain core.

No production n8n connection, shared-workflow mutation, payment capture, or platform tokens.
Server handlers MUST authenticate and authorize before calling mutating methods.
"""
from __future__ import annotations
import contextlib
import datetime as dt
import hashlib
import hmac
import json
import os
import re
import base64
import secrets
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Any
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from cryptography.fernet import Fernet

UTC=dt.timezone.utc
ROLES={'SUPER_ADMIN','SUPPORT_ADMIN','TECH_ADMIN','STORE_OWNER','STORE_STAFF'}
STATUSES={'FREE_TRIAL','ACTIVE','PAYMENT_DUE','PAST_DUE','SUSPENDED','CANCELLED','EXPIRED'}
ADMIN_ROLES={'SUPER_ADMIN','SUPPORT_ADMIN','TECH_ADMIN'}
WRITE_ROLES={'SUPER_ADMIN'}
CHANNELS={'messenger','line','zalo','telegram'}

def now_utc(): return dt.datetime.now(UTC)
def iso(x:dt.datetime):
    if x.tzinfo is None: raise ValueError('timezone required')
    return x.astimezone(UTC).isoformat(timespec='seconds')
def parse(x:str): return dt.datetime.fromisoformat(x.replace('Z','+00:00')).astimezone(UTC)
def uid(prefix='id'):return prefix+'_'+uuid.uuid4().hex

def totp_at(raw_key:bytes, counter:int, digits=6):
    digest=hmac.new(raw_key,counter.to_bytes(8,'big'),hashlib.sha1).digest()
    offset=digest[-1]&0xf
    return f'{(int.from_bytes(digest[offset:offset+4],"big")&0x7fffffff)%(10**digits):0{digits}d}'
def totp_codes(key:str, when:float|None=None):
    import base64
    raw=base64.b32decode(key.upper()+'='*((-len(key))%8))
    step=int((time.time() if when is None else when)//30)
    return [(step+i,totp_at(raw,step+i)) for i in (-1,0,1)]

class AccessDenied(Exception):pass
class Conflict(Exception):pass
class NotFound(Exception):pass
class Invalid(Exception):pass

class Store:
    """SQLite reference persistence; migrations, encryption and auth live server-side.

    Staging only: do NOT use a local SQLite file for production multi-instance tenancy.
    """
    def __init__(self,path:Path|str,encrypt_key:bytes):
        if not encrypt_key:raise ValueError('encryption key required')
        self.path=str(path)
        self.fernet=Fernet(encrypt_key)
        self.hasher=PasswordHasher(time_cost=2,memory_cost=16384,parallelism=1)
        self._mu=threading.RLock()
        self.conn=sqlite3.connect(self.path,check_same_thread=False,isolation_level=None)
        self.conn.row_factory=sqlite3.Row
        self.conn.execute('PRAGMA foreign_keys=ON')
        self.conn.execute('PRAGMA busy_timeout=5000')
        self.conn.executescript('''
        CREATE TABLE IF NOT EXISTS users(
          id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,
          global_role TEXT NOT NULL CHECK(global_role IN ('SUPER_ADMIN','SUPPORT_ADMIN','TECH_ADMIN','STORE_OWNER','STORE_STAFF')),
          totp_enc BLOB NOT NULL,last_totp_counter INTEGER NOT NULL DEFAULT -1,
          disabled INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS tenants(
          id TEXT PRIMARY KEY,name TEXT NOT NULL,industry TEXT NOT NULL,
          service_enabled INTEGER NOT NULL DEFAULT 0,bot_paused INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS memberships(
          tenant_id TEXT NOT NULL REFERENCES tenants(id),user_id TEXT NOT NULL REFERENCES users(id),
          role TEXT NOT NULL CHECK(role IN ('STORE_OWNER','STORE_STAFF')),
          PRIMARY KEY(tenant_id,user_id));
        CREATE TABLE IF NOT EXISTS sessions(
          session_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),
          expires_at TEXT NOT NULL,last_reauth_at TEXT NOT NULL,
          csrf_hash TEXT NOT NULL,revoked_at TEXT);
        CREATE TABLE IF NOT EXISTS login_attempts(email_hash TEXT NOT NULL,at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS plans(
          id TEXT PRIMARY KEY,label TEXT NOT NULL,price_minor INTEGER NOT NULL CHECK(price_minor>=0),
          currency TEXT NOT NULL CHECK(currency='VND'),cycle TEXT NOT NULL CHECK(cycle IN ('MONTH','YEAR')),
          max_messages INTEGER NOT NULL CHECK(max_messages>=0),grace_days INTEGER NOT NULL CHECK(grace_days BETWEEN 0 AND 30),
          active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS subscriptions(
          id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants(id),
          plan_id TEXT NOT NULL REFERENCES plans(id),state TEXT NOT NULL,
          start_at TEXT NOT NULL,renewal_at TEXT NOT NULL,grace_until TEXT NOT NULL,
          latest_payment_id TEXT,revision INTEGER NOT NULL DEFAULT 1,
          CHECK(state IN ('FREE_TRIAL','ACTIVE','PAYMENT_DUE','PAST_DUE','SUSPENDED','CANCELLED','EXPIRED')));
        CREATE TABLE IF NOT EXISTS payment_events(
          provider TEXT NOT NULL,event_id TEXT NOT NULL,subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
          amount_minor INTEGER NOT NULL,currency TEXT NOT NULL,applied_at TEXT NOT NULL,
          PRIMARY KEY(provider,event_id));
        CREATE TABLE IF NOT EXISTS channels(
          tenant_id TEXT NOT NULL REFERENCES tenants(id),platform TEXT NOT NULL,
          external_account_ref TEXT NOT NULL,secret_ref TEXT,connection_status TEXT NOT NULL DEFAULT 'UNKNOWN',
          updated_at TEXT NOT NULL,PRIMARY KEY(tenant_id,platform),UNIQUE(platform,external_account_ref));
        CREATE TABLE IF NOT EXISTS knowledge(
          id TEXT PRIMARY KEY,kind TEXT NOT NULL,version INTEGER NOT NULL,status TEXT NOT NULL,
          content_json TEXT NOT NULL,source TEXT NOT NULL,approved_by TEXT REFERENCES users(id),
          approved_at TEXT,created_at TEXT NOT NULL,UNIQUE(kind,version));
        CREATE TABLE IF NOT EXISTS audit_events(
          seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,
          actor_id TEXT,action TEXT NOT NULL,tenant_id TEXT,reason TEXT NOT NULL,
          details_json TEXT NOT NULL,previous_sha256 TEXT NOT NULL,sha256 TEXT NOT NULL);
        CREATE TRIGGER IF NOT EXISTS no_audit_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'audit events are append-only'); END;
        CREATE TRIGGER IF NOT EXISTS no_audit_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'audit events are append-only'); END;
        ''')
    @contextlib.contextmanager
    def tx(self):
        with self._mu:
            self.conn.execute('BEGIN IMMEDIATE')
            try:
                yield
                self.conn.execute('COMMIT')
            except BaseException:
                self.conn.execute('ROLLBACK')
                raise
    def one(self,query,*args):
        return self.conn.execute(query,args).fetchone()
    def rows(self,query,*args):
        return self.conn.execute(query,args).fetchall()
    def audit(self,actor,action,tenant=None,reason='',details=None):
        if not reason.strip() or len(reason)>200:raise Invalid('audit reason 1..200 characters required')
        # Avoid letting a free-text reason become a credential/PII exfiltration log.
        if re.search(r'(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b(?:0|\+84)[\d .-]{9,14}\b|(?:bearer |token=|password=|sk-)[^ ]+)',reason,re.I):
            raise Invalid('personal or secret data must not appear in audit reasons')
        data=json.dumps(details or {},ensure_ascii=False,sort_keys=True,separators=(',',':'))
        # Never store PII, bearer tokens, credentials or raw chat content in audit metadata.
        if any(s in data.lower() for s in ('token','password','secret','credential','email','phone')):
            raise Invalid('sensitive data forbidden in audit metadata')
        prev=self.one('SELECT sha256 FROM audit_events ORDER BY seq DESC LIMIT 1')
        previous=prev['sha256'] if prev else '0'*64
        ident=uid('audit');created=iso(now_utc())
        serial='|'.join([previous,ident,created,str(actor or ''),action,str(tenant or ''),reason,data]); digest=hashlib.sha256(serial.encode()).hexdigest()
        self.conn.execute('INSERT INTO audit_events(id,created_at,actor_id,action,tenant_id,reason,details_json,previous_sha256,sha256) VALUES (?,?,?,?,?,?,?,?,?)',
                          (ident,created,actor,action,tenant,reason,data,previous,digest))
        return ident
    def verify_audit(self):
        prev='0'*64
        for e in self.rows('SELECT * FROM audit_events ORDER BY seq'):
            serial='|'.join([prev,e['id'],e['created_at'],str(e['actor_id'] or ''),e['action'],str(e['tenant_id'] or ''),e['reason'],e['details_json']]);digest=hashlib.sha256(serial.encode()).hexdigest()
            if e['previous_sha256']!=prev or e['sha256']!=digest:return False
            prev=digest
        return True
    def create_user(self,email,password,role,totp_secret):
        if role not in ROLES:raise Invalid('invalid role')
        if not email or '@' not in email or len(password)<14:raise Invalid('email and password >=14 characters required')
        try:raw=base64.b32decode(totp_secret.upper()+'='*((-len(totp_secret))%8))
        except Exception:raise Invalid('invalid MFA secret')
        if len(raw)<20:raise Invalid('MFA secret must have at least 160 bits of entropy')
        with self.tx():
            key=self.fernet.encrypt(totp_secret.encode())
            user_id=uid('user')
            self.conn.execute('INSERT INTO users(id,email,password_hash,global_role,totp_enc) VALUES (?,?,?,?,?)',
                (user_id,email.strip().lower(),self.hasher.hash(password),role,key))
            self.audit(user_id,'USER_CREATED',reason='staging bootstrap',details={'role':role})
            return user_id
    def login(self,email,password,totp,at:dt.datetime|None=None):
        at=at or now_utc();email=email.strip().lower()
        identifier=hashlib.sha256(email.encode()).hexdigest()
        with self.tx():
            fifteen=iso(at-dt.timedelta(minutes=15))
            self.conn.execute('DELETE FROM login_attempts WHERE at < ?',(fifteen,))
            if self.one('SELECT COUNT(*) AS c FROM login_attempts WHERE email_hash=?',identifier)['c']>=5:
                raise AccessDenied('authentication throttled')
            user=self.one('SELECT * FROM users WHERE email=?',email)
            verified=False
            if user and not user['disabled']:
                try:verified=self.hasher.verify(user['password_hash'],password)
                except (VerifyMismatchError,VerificationError):verified=False
            if not verified:
                self.conn.execute('INSERT INTO login_attempts(email_hash,at) VALUES (?,?)',(identifier,iso(at)))
                return None
            key=self.fernet.decrypt(user['totp_enc']).decode()
            valid=[c for c,otp in totp_codes(key,at.timestamp()) if hmac.compare_digest(otp,str(totp)) and c>user['last_totp_counter']]
            if not valid:
                self.conn.execute('INSERT INTO login_attempts(email_hash,at) VALUES (?,?)',(identifier,iso(at)))
                return None
            self.conn.execute('UPDATE users SET last_totp_counter=? WHERE id=?',(max(valid),user['id']))
            self.conn.execute('DELETE FROM login_attempts WHERE email_hash=?',(identifier,))
            raw=secrets.token_urlsafe(36);csrf=secrets.token_urlsafe(32)
            self.conn.execute('INSERT INTO sessions VALUES (?,?,?,?,?,NULL)',(
                hashlib.sha256(raw.encode()).hexdigest(),user['id'],iso(at+dt.timedelta(hours=8)),iso(at),hashlib.sha256(csrf.encode()).hexdigest()))
            self.audit(user['id'],'SESSION_LOGIN',reason='password + verified TOTP')
            return {'session':raw,'csrf':csrf,'expires_at':iso(at+dt.timedelta(hours=8))}
    def session(self,raw):
        if not raw:return None
        entry=self.one('''SELECT s.*,u.global_role,u.disabled,u.email FROM sessions s JOIN users u ON s.user_id=u.id
                           WHERE s.session_hash=?''',hashlib.sha256(raw.encode()).hexdigest())
        if not entry or entry['revoked_at'] or entry['disabled'] or parse(entry['expires_at'])<=now_utc():return None
        return entry
    def verify_csrf(self,session_row,token):
        return bool(token) and hmac.compare_digest(session_row['csrf_hash'],hashlib.sha256(token.encode()).hexdigest())
    def require_role(self,user,roles,tenant_id=None):
        if not user or user['global_role'] not in ROLES:raise AccessDenied('unauthorized')
        if user['global_role']=='SUPER_ADMIN':return
        if user['global_role'] in roles and user['global_role'] in ADMIN_ROLES:return
        if tenant_id and user['global_role'] in roles and user['global_role'] in {'STORE_OWNER','STORE_STAFF'}:
            membership=self.one('SELECT role FROM memberships WHERE tenant_id=? AND user_id=?',tenant_id,user['user_id'])
            if membership and membership['role']==user['global_role']:return
        raise AccessDenied('insufficient role or tenant scope')
    def require_fresh_auth(self,user,max_seconds=300):
        if (now_utc()-parse(user['last_reauth_at'])).total_seconds()>max_seconds:raise AccessDenied('recent MFA required')
    def revoke_session(self,actor,raw):
        with self.tx():
            self.conn.execute('UPDATE sessions SET revoked_at=? WHERE session_hash=? AND user_id=?',(
                iso(now_utc()),hashlib.sha256(raw.encode()).hexdigest(),actor['user_id']))
            self.audit(actor['user_id'],'SESSION_LOGOUT',reason='user initiated logout')
    def revoke_all_user_sessions(self,user,target_user_id=None,reason='user requested logout everywhere'):
        target=target_user_id or user['user_id']
        if target!=user['user_id']:
            self.require_role(user,WRITE_ROLES);self.require_fresh_auth(user)
        with self.tx():
            if not self.one('SELECT id FROM users WHERE id=?',target):raise NotFound('user')
            self.conn.execute('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',(iso(now_utc()),target))
            self.audit(user['user_id'],'USER_SESSIONS_REVOKED',reason=reason,details={'self':target==user['user_id']})
        return {'revoked':True}
    def create_plan(self,user,plan_id,label,price_minor,cycle,max_messages,grace_days):
        self.require_role(user,WRITE_ROLES);self.require_fresh_auth(user)
        if not plan_id.replace('_','').isalnum() or not label or not isinstance(price_minor,int) or price_minor<0 or not 0<=grace_days<=30 or max_messages<0:raise Invalid('bad plan definition')
        with self.tx():
            self.conn.execute('INSERT INTO plans(id,label,price_minor,currency,cycle,max_messages,grace_days) VALUES (?,?,?,"VND",?,?,?)',
                (plan_id,label,price_minor,cycle,max_messages,grace_days))
            self.audit(user['user_id'],'PLAN_CREATED',reason='approved catalog setup',details={'plan':plan_id})
        return {'id':plan_id,'label':label}
    def create_tenant(self,user,name,industry,owner_id):
        self.require_role(user,WRITE_ROLES);self.require_fresh_auth(user)
        if not name.strip() or not industry.strip():raise Invalid('name and industry required')
        with self.tx():
            owner=self.one('SELECT global_role FROM users WHERE id=?',owner_id)
            if not owner or owner['global_role']!='STORE_OWNER':raise Invalid('owner role required')
            tenant=uid('tenant');created=iso(now_utc())
            self.conn.execute('INSERT INTO tenants(id,name,industry,created_at) VALUES (?,?,?,?)',(tenant,name.strip(),industry.strip(),created))
            self.conn.execute('INSERT INTO memberships VALUES (?, ?, ?)',(tenant,owner_id,'STORE_OWNER'))
            self.audit(user['user_id'],'TENANT_CREATED',tenant,reason='new tenant onboarding')
            return tenant
    def assign_subscription(self,user,tenant_id,plan_id,start,trial_days=0):
        self.require_role(user,WRITE_ROLES);self.require_fresh_auth(user)
        if trial_days<0 or trial_days>30:raise Invalid('trial days 0..30')
        if start.tzinfo is None:raise Invalid('timezone required')
        with self.tx():
            plan=self.one('SELECT * FROM plans WHERE id=? AND active=1',plan_id)
            tenant=self.one('SELECT id FROM tenants WHERE id=?',tenant_id)
            if not tenant or not plan:raise NotFound('tenant or plan')
            if self.one('SELECT id FROM subscriptions WHERE tenant_id=?',tenant_id):raise Conflict('subscription exists')
            renewal=start+dt.timedelta(days=trial_days if trial_days else (30 if plan['cycle']=='MONTH' else 365))
            grace=renewal+dt.timedelta(days=plan['grace_days'])
            state='FREE_TRIAL' if trial_days else 'PAYMENT_DUE'
            ident=uid('sub')
            self.conn.execute('INSERT INTO subscriptions(id,tenant_id,plan_id,state,start_at,renewal_at,grace_until) VALUES (?,?,?,?,?,?,?)',(
                ident,tenant_id,plan_id,state,iso(start),iso(renewal),iso(grace)))
            self.audit(user['user_id'],'SUBSCRIPTION_ASSIGNED',tenant_id,reason='plan assignment without payment confirmation',details={'plan':plan_id,'state':state})
            return ident
    def update_service(self,user,tenant_id,enabled=None,paused=None,reason=''):
        self.require_role(user,WRITE_ROLES);self.require_fresh_auth(user)
        if enabled is None and paused is None:raise Invalid('no change requested')
        if not reason or len(reason)<5:raise Invalid('reason required')
        with self.tx():
            if not self.one('SELECT id FROM tenants WHERE id=?',tenant_id):raise NotFound('tenant')
            if enabled is not None:self.conn.execute('UPDATE tenants SET service_enabled=? WHERE id=?',(bool(enabled),tenant_id))
            if paused is not None:self.conn.execute('UPDATE tenants SET bot_paused=? WHERE id=?',(bool(paused),tenant_id))
            self.audit(user['user_id'],'TENANT_SERVICE_CHANGED',tenant_id,reason=reason,details={'enabled':enabled,'paused':paused})
    def get_entitlement(self,user,tenant_id,at=None):
        self.require_role(user,{'SUPER_ADMIN','SUPPORT_ADMIN','TECH_ADMIN','STORE_OWNER','STORE_STAFF'},tenant_id)
        return self._entitlement(tenant_id,at)
    def _entitlement(self,tenant_id,at=None):
        at=at or now_utc()
        t=self.one('SELECT service_enabled,bot_paused FROM tenants WHERE id=?',tenant_id)
        if not t:raise NotFound('tenant')
        s=self.one('SELECT s.*,p.max_messages,p.price_minor,p.cycle FROM subscriptions s JOIN plans p ON s.plan_id=p.id WHERE tenant_id=?',tenant_id)
        if not s:return {'allowed':False,'reason':'NO_SUBSCRIPTION','tenant_id':tenant_id}
        state=s['state']
        until=parse(s['renewal_at']);grace=parse(s['grace_until'])
        # New unpaid subscriptions are NEVER eligible for grace. Grace exists only after an independently verified prior paid cycle.
        prior_paid=s['latest_payment_id'] is not None
        time_valid=(state=='ACTIVE' and at<until) or (state=='FREE_TRIAL' and at<until) or (prior_paid and state in ('PAYMENT_DUE','PAST_DUE') and at<=grace)
        if not t['service_enabled']:reason='SERVICE_DISABLED'
        elif t['bot_paused']:reason='BOT_PAUSED'
        elif not time_valid:reason='SUBSCRIPTION_NOT_ENTITLED'
        else:reason='ALLOWED'
        return {'allowed':reason=='ALLOWED','reason':reason,'tenant_id':tenant_id,'subscription_id':s['id'],'subscription_state':state,'max_messages':s['max_messages'],'current_time_checked_at':iso(at)}
    def reconcile(self,user,tenant_id,at):
        self.require_role(user,WRITE_ROLES);self.require_fresh_auth(user)
        with self.tx():
            s=self.one('SELECT * FROM subscriptions WHERE tenant_id=?',tenant_id)
            if not s:raise NotFound('subscription')
            old=s['state'];new=old;renewal=parse(s['renewal_at']);grace=parse(s['grace_until'])
            if old=='FREE_TRIAL' and at>=renewal:new='EXPIRED'
            elif old=='ACTIVE' and at>=renewal:new='PAYMENT_DUE' if at<=grace else 'SUSPENDED'
            elif old=='PAYMENT_DUE' and at>grace:new='SUSPENDED'
            elif old=='PAYMENT_DUE' and at>renewal:new='PAST_DUE'
            elif old=='PAST_DUE' and at>grace:new='SUSPENDED'
            if new!=old:
                self.conn.execute('UPDATE subscriptions SET state=?,revision=revision+1 WHERE id=?',(new,s['id']))
                self.audit(user['user_id'],'SUBSCRIPTION_STATE',tenant_id,reason='scheduled lifecycle reconciliation',details={'old':old,'new':new})
            return {'old':old,'new':new,'changed':new!=old}
    def apply_verified_payment(self,verification,tenant_id,subscription_id,amount_minor,currency,at):
        """Only an adapter with validated signature + timestamp can create VerifiedPayment.
        TEST_HMAC adapter below is NOT a commercial payment gateway.
        """
        if not isinstance(verification,VerifiedPayment):raise AccessDenied('unverified payment')
        if verification.tenant_id!=tenant_id or verification.subscription_id!=subscription_id or verification.amount_minor!=amount_minor or verification.currency!=currency:raise Invalid('payment fields mismatch')
        with self.tx():
            s=self.one('SELECT s.*,p.price_minor,p.currency,p.cycle,p.grace_days FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.id=? AND s.tenant_id=?',subscription_id,tenant_id)
            if not s:raise NotFound('subscription or tenant')
            if s['price_minor']!=amount_minor or currency!='VND':raise Invalid('incorrect amount or currency')
            existing=self.one('SELECT * FROM payment_events WHERE provider=? AND event_id=?',verification.provider,verification.event_id)
            if existing:
                if existing['subscription_id']!=subscription_id or existing['amount_minor']!=amount_minor:raise Conflict('payment replay changed payload')
                return {'applied':False,'idempotent':True}
            if s['state'] in ('CANCELLED',):raise Conflict('cancelled subscription requires explicit re-enrollment')
            base=max(at,parse(s['renewal_at'])) if s['state']=='ACTIVE' else at
            renewal=base+dt.timedelta(days=30 if s['cycle']=='MONTH' else 365)
            grace=renewal+dt.timedelta(days=s['grace_days'])
            self.conn.execute('INSERT INTO payment_events VALUES (?,?,?,?,?,?)',(verification.provider,verification.event_id,subscription_id,amount_minor,currency,iso(at)))
            self.conn.execute('UPDATE subscriptions SET state="ACTIVE",renewal_at=?,grace_until=?,latest_payment_id=?,revision=revision+1 WHERE id=?',(
                iso(renewal),iso(grace),verification.event_id,subscription_id))
            self.audit(None,'PAYMENT_VERIFIED',tenant_id,reason='cryptographically validated test webhook',details={'event':verification.event_id[:40],'provider':verification.provider})
            return {'applied':True,'idempotent':False}
    def internal_entitlement_from_verified_channel(self,verified_request,at=None):
        from .gateway import VerifiedGatewayRequest
        if not isinstance(verified_request,VerifiedGatewayRequest):raise AccessDenied('signed gateway request required')
        row=self.one('SELECT tenant_id,connection_status FROM channels WHERE platform=? AND external_account_ref=?',verified_request.platform,verified_request.account_ref)
        if not row:raise AccessDenied('channel not mapped to a tenant')
        if row['connection_status']!='VERIFIED':return {'allowed':False,'reason':'CHANNEL_NOT_VERIFIED','source':'staging_channel_registry'}
        decision=self._entitlement(row['tenant_id'],at)
        return {'allowed':decision['allowed'],'reason':decision['reason'],'tenant_id':row['tenant_id'],'source':'staging_entitlement_engine','checked_at':decision.get('current_time_checked_at')}
    def upsert_channel_reference(self,user,tenant_id,platform,account_ref,secret_ref,reason):
        self.require_role(user,{'SUPER_ADMIN','TECH_ADMIN'});self.require_fresh_auth(user)
        if platform not in CHANNELS or not account_ref or not secret_ref.startswith('vault://') or not reason.strip():raise Invalid('invalid channel metadata; use vault:// reference, NEVER a token')
        if not self.one('SELECT id FROM tenants WHERE id=?',tenant_id):raise NotFound('tenant')
        with self.tx():
            self.conn.execute('INSERT INTO channels(tenant_id,platform,external_account_ref,secret_ref,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(tenant_id,platform) DO UPDATE SET external_account_ref=excluded.external_account_ref,secret_ref=excluded.secret_ref,connection_status="UNKNOWN",updated_at=excluded.updated_at',(
                tenant_id,platform,account_ref,secret_ref,iso(now_utc())))
            self.audit(user['user_id'],'CHANNEL_REFERENCE_UPDATED',tenant_id,reason=reason,details={'platform':platform})
    def get_channels(self,user,tenant_id):
        self.require_role(user,{'SUPER_ADMIN','SUPPORT_ADMIN','TECH_ADMIN','STORE_OWNER','STORE_STAFF'},tenant_id)
        return [dict(row) for row in self.rows('SELECT platform,external_account_ref,connection_status,updated_at FROM channels WHERE tenant_id=?',tenant_id)]
    def draft_knowledge(self,user,kind,source,content):
        self.require_role(user,WRITE_ROLES);self.require_fresh_auth(user)
        if kind not in {'PRODUCT','SALES','PRICING','SUPPORT','PUBLIC_DOC'} or not source.strip() or not isinstance(content,dict):raise Invalid('invalid knowledge')
        # Reject client-specified secrets; no arbitrary prompt injection into approved data.
        banned={'api_key','token','password','credential','secret'}
        if any(k.lower() in banned for k in content.keys()):raise Invalid('secrets forbidden in knowledge')
        with self.tx():
            v=self.one('SELECT COALESCE(MAX(version),0)+1 AS v FROM knowledge WHERE kind=?',kind)['v']
            ident=uid('kb')
            self.conn.execute('INSERT INTO knowledge(id,kind,version,status,content_json,source,created_at) VALUES (?, ?, ?, "DRAFT", ?, ?, ?)',(
                ident,kind,v,json.dumps(content,ensure_ascii=False,sort_keys=True),source,iso(now_utc())))
            self.audit(user['user_id'],'KB_DRAFTED',reason='staging knowledge proposal',details={'kind':kind,'version':v})
            return ident
    def approve_knowledge(self,user,kb_id):
        self.require_role(user,WRITE_ROLES);self.require_fresh_auth(user)
        with self.tx():
            kb=self.one('SELECT * FROM knowledge WHERE id=?',kb_id)
            if not kb:raise NotFound('knowledge')
            if kb['status']!='DRAFT':raise Conflict('knowledge not draft')
            self.conn.execute('UPDATE knowledge SET status="APPROVED",approved_by=?,approved_at=? WHERE id=?',(user['user_id'],iso(now_utc()),kb_id))
            self.audit(user['user_id'],'KB_APPROVED',reason='reviewed pricing and product claims',details={'kind':kb['kind'],'version':kb['version']})
    def active_knowledge(self,kind):
        # This is backend knowledge read model; no dynamic model or RAG connected.
        entry=self.one('SELECT * FROM knowledge WHERE kind=? AND status="APPROVED" ORDER BY version DESC LIMIT 1',kind)
        if not entry:return None
        return {'kind':entry['kind'],'version':entry['version'],'source':entry['source'],'approved_at':entry['approved_at'],'content':json.loads(entry['content_json'])}

class VerifiedPayment:
    __slots__=('provider','event_id','tenant_id','subscription_id','amount_minor','currency')
    def __init__(self,*,provider,event_id,tenant_id,subscription_id,amount_minor,currency,proof):
        if proof is not _VERIFIER_PROOF:raise AccessDenied('cannot construct trusted payment event')
        self.provider=provider;self.event_id=event_id;self.tenant_id=tenant_id;self.subscription_id=subscription_id;self.amount_minor=amount_minor;self.currency=currency
_VERIFIER_PROOF=object()

def verify_test_webhook(secret:bytes,body:bytes,timestamp:str,signature:str,at:dt.datetime|None=None):
    """Sandbox-only HMAC fixture; MUST NOT be used as a real payment provider adapter.
    Actual provider verification differs; select an approved gateway before implementing.
    """
    if not secret or len(secret)<32:raise AccessDenied('invalid verifier secret')
    at=at or now_utc()
    try:ts=int(timestamp)
    except (TypeError,ValueError):raise AccessDenied('invalid timestamp')
    if abs(at.timestamp()-ts)>300:raise AccessDenied('stale event')
    if len(body)>8192:raise Invalid('event too large')
    expected=hmac.new(secret,timestamp.encode()+b'.'+body,hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected,signature):raise AccessDenied('invalid signature')
    try:event=json.loads(body)
    except (ValueError,UnicodeDecodeError):raise Invalid('invalid JSON')
    if event.get('type')!='payment.succeeded' or event.get('provider')!='SANDBOX_HMAC':raise AccessDenied('unsupported payment event')
    amount=event.get('amount_minor')
    if type(amount) is not int or amount<0:raise Invalid('invalid amount')
    for k in ('event_id','tenant_id','subscription_id','currency'):
        if not isinstance(event.get(k),str) or not event[k] or len(event[k])>150:raise Invalid('invalid webhook fields')
    return VerifiedPayment(provider='SANDBOX_HMAC',event_id=event['event_id'],tenant_id=event['tenant_id'],subscription_id=event['subscription_id'],amount_minor=amount,currency=event['currency'],proof=_VERIFIER_PROOF)
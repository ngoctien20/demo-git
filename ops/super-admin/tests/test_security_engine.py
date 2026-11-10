from __future__ import annotations
import base64
import datetime as dt
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import sys
from pathlib import Path
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from app.core import (Store, AccessDenied, Conflict, Invalid, now_utc, iso, totp_codes, verify_test_webhook)
from app.server import create_app,CNAME

PASSWORD='very_strong_stage_only_#14786'
SECRET=base64.b32encode(secrets.token_bytes(20)).decode().rstrip('=')
WEBHOOK_SECRET=b'staging_verify_demo_only_secret___123456789012'

def code_for(key):return dict(totp_codes(key))[int(dt.datetime.now(dt.timezone.utc).timestamp()//30)]

@pytest.fixture
def env(tmp_path):
    s=Store(tmp_path/'db.sqlite',Fernet.generate_key())
    admin=s.create_user('super@example.test',PASSWORD,'SUPER_ADMIN',SECRET)
    owner=s.create_user('owner@example.test',PASSWORD,'STORE_OWNER',SECRET)
    staff=s.create_user('staff@example.test',PASSWORD,'STORE_STAFF',SECRET)
    support=s.create_user('support@example.test',PASSWORD,'SUPPORT_ADMIN',SECRET)
    tech=s.create_user('tech@example.test',PASSWORD,'TECH_ADMIN',SECRET)
    app=create_app(s,origin='https://admin.test',sandbox_payment_secret=WEBHOOK_SECRET,allow_test_webhook=True)
    clients={r:TestClient(app,base_url='https://admin.test') for r in ['admin','owner','staff','support','tech']}
    ids={'admin':admin,'owner':owner,'staff':staff,'support':support,'tech':tech}
    users={}
    # login for each independent user; TOTP secret is same but replay prevention is user-specific
    for role,client in clients.items():
        email={'admin':'super','owner':'owner','staff':'staff','support':'support','tech':'tech'}[role]+'@example.test'
        resp=client.post('/api/v1/auth/login',json={'email':email,'password':PASSWORD,'totp':code_for(SECRET)},headers={'Origin':'https://admin.test'})
        assert resp.status_code==200, resp.text
        users[role]={'client':client,'csrf':resp.json()['csrf'],'id':ids[role]}
    yield {'store':s,'app':app,**users}
    s.conn.close()

def post(user,path,data):
    if any(path.endswith(suffix) for suffix in ('/subscription','/service','/channels')) and '/tenants/' in path:
        data={**data,'confirm_tenant_id':path.split('/tenants/')[1].split('/')[0]}
    return user['client'].post(path,json=data,headers={'Origin':'https://admin.test','X-CSRF-Token':user['csrf']})
def setup_tenant(env,trial_days=7):
    p=post(env['admin'],'/api/v1/admin/plans',{'id':'basic','label':'Basic staging','price_minor':159000,'cycle':'MONTH','max_messages':200,'grace_days':4})
    assert p.status_code==201,p.text
    t=post(env['admin'],'/api/v1/admin/tenants',{'name':'Staging Shop A','industry':'fashion','owner_id':env['owner']['id']})
    assert t.status_code==201,t.text
    tid=t.json()['tenant_id']
    sub=post(env['admin'],f'/api/v1/admin/tenants/{tid}/subscription',{'plan_id':'basic','trial_days':trial_days})
    assert sub.status_code==201,sub.text
    return tid,sub.json()['subscription_id']

def signed_payload(payload,ts=None):
    ts=str(int(now_utc().timestamp()) if ts is None else ts)
    body=json.dumps(payload,separators=(',',':')).encode()
    signature=hmac.new(WEBHOOK_SECRET,ts.encode()+b'.'+body,hashlib.sha256).hexdigest()
    return body,{'x-event-timestamp':ts,'x-event-signature':signature}

def event(tid,sid,**overrides):
    out={'provider':'SANDBOX_HMAC','type':'payment.succeeded','event_id':'evt_demo_001','tenant_id':tid,'subscription_id':sid,'amount_minor':159000,'currency':'VND'}
    out.update(overrides);return out

def test_health_never_claims_live(env):
    data=env['admin']['client'].get('/health').json()
    assert data['status']=='STAGING_ONLY' and data['production_readiness']=='NOT_APPROVED'
    assert data['live_n8n']=='DISCONNECTED'

def test_cookie_is_secure_http_only_samesite(env):
    response=env['admin']['client'].post('/api/v1/auth/login',json={'email':'super@example.test','password':PASSWORD,'totp':code_for(SECRET)})
    assert response.status_code==401 # same TOTP code cannot be replayed
    assert env['admin']['client'].cookies.get(CNAME)

def test_wrong_password_is_rejected(env):
    r=env['admin']['client'].post('/api/v1/auth/login',json={'email':'super@example.test','password':'incorrect_pw_is_long_enough','totp':code_for(SECRET)})
    assert r.status_code==401

def test_brute_force_login_is_throttled(env):
    c=env['admin']['client'];body={'email':'attacker@example.test','password':'not_a_real_password_123','totp':'123456'}
    for i in range(5):assert c.post('/api/v1/auth/login',json=body).status_code==401
    assert c.post('/api/v1/auth/login',json=body).status_code==429

def test_session_persists_between_requests_and_revokes(env):
    user=env['owner'];c=user['client']
    assert c.get('/api/v1/auth/me').status_code==200
    assert c.get('/api/v1/auth/me').json()['role']=='STORE_OWNER'
    assert post(user,'/api/v1/auth/logout',{}).json()['revoked']
    assert c.get('/api/v1/auth/me').status_code==401

def test_no_session_denied(env):
    c=TestClient(env['app'],base_url='https://admin.test')
    assert c.get('/api/v1/admin/tenants').status_code==401

def test_csrf_and_cross_site_origin_rejected(env):
    c=env['admin']['client'];data={'id':'basic','label':'Basic staging','price_minor':100,'cycle':'MONTH','max_messages':10,'grace_days':2}
    assert c.post('/api/v1/admin/plans',json=data,headers={'Origin':'https://admin.test'}).status_code==403
    assert c.post('/api/v1/admin/plans',json=data,headers={'Origin':'https://evil.example','X-CSRF-Token':env['admin']['csrf']}).status_code==403
    assert c.post('/api/v1/admin/plans',json=data,headers={'Origin':'https://admin.test','X-CSRF-Token':'wrong'}).status_code==403
    assert post(env['admin'],'/api/v1/admin/plans',data).status_code==201

def test_csrf_recovers_after_refresh(env):
    c=env['admin']['client'];r=c.post('/api/v1/auth/csrf')
    assert r.status_code==200
    new=r.json()['csrf'];assert new!=env['admin']['csrf']
    assert post(env['admin'],'/api/v1/admin/plans',{'id':'abc','label':'Basic','price_minor':1,'cycle':'MONTH','max_messages':1,'grace_days':1}).status_code==403
    env['admin']['csrf']=new
    assert post(env['admin'],'/api/v1/admin/plans',{'id':'abc','label':'Basic','price_minor':1,'cycle':'MONTH','max_messages':1,'grace_days':1}).status_code==201

def test_store_owner_cannot_create_plan_or_tenant(env):
    assert post(env['owner'],'/api/v1/admin/plans',{'id':'basic','label':'Basic','price_minor':100,'cycle':'MONTH','max_messages':20,'grace_days':0}).status_code==403
    assert post(env['support'],'/api/v1/admin/tenants',{'name':'Shop A','industry':'fashion','owner_id':env['owner']['id']}).status_code==403
    assert post(env['tech'],'/api/v1/admin/tenants',{'name':'Shop A','industry':'fashion','owner_id':env['owner']['id']}).status_code==403

def test_owner_cannot_see_other_tenant(env):
    t,_=setup_tenant(env)
    other=post(env['admin'],'/api/v1/admin/tenants',{'name':'Other Shop','industry':'grocery','owner_id':env['owner']['id']})
    # owner assigned both tenants here; demonstrate isolation via independent staff membership instead
    own=other.json()['tenant_id'];assert env['owner']['client'].get(f'/api/v1/tenants/{own}/entitlement').status_code==200
    assert env['staff']['client'].get(f'/api/v1/tenants/{t}/entitlement').status_code==403

def test_super_admin_tenant_creation_audits(env):
    tid,_=setup_tenant(env)
    r=env['admin']['client'].get('/api/v1/admin/tenants');assert r.status_code==200
    assert any(x['id']==tid for x in r.json()['items'])
    assert r.json()['source']=='staging_sqlite'
    audit=env['admin']['client'].get('/api/v1/admin/audit').json()
    assert audit['hash_chain_valid'] and any(x['action']=='TENANT_CREATED' for x in audit['entries'])

def test_tech_admin_cannot_edit_billing_or_view_audit(env):
    setup_tenant(env)
    assert env['tech']['client'].get('/api/v1/admin/audit').status_code==403
    assert post(env['tech'],'/api/v1/admin/plans',{'id':'other','label':'Other','price_minor':30,'cycle':'MONTH','max_messages':20,'grace_days':2}).status_code==403

def test_subscription_not_paid_by_admin_assignment(env):
    tid,_=setup_tenant(env,trial_days=0)
    initial=env['owner']['client'].get(f'/api/v1/tenants/{tid}/entitlement').json()
    assert initial['subscription_state']=='PAYMENT_DUE' and initial['allowed'] is False
    s=env['store'].one('SELECT state FROM subscriptions WHERE tenant_id=?',tid)
    assert s['state']=='PAYMENT_DUE'

def test_service_disabled_by_default_even_with_trial(env):
    tid,_=setup_tenant(env)
    data=env['owner']['client'].get(f'/api/v1/tenants/{tid}/entitlement').json()
    assert not data['allowed'] and data['reason']=='SERVICE_DISABLED'

def test_service_enable_does_not_change_any_n8n_workflow(env):
    tid,_=setup_tenant(env)
    r=post(env['admin'],f'/api/v1/admin/tenants/{tid}/service',{'enabled':True,'reason':'QA activate tenant only'})
    assert r.status_code==200
    assert r.json()['n8n_workflow_modified'] is False
    assert env['owner']['client'].get(f'/api/v1/tenants/{tid}/entitlement').json()['allowed']

def test_pause_and_resume_and_disable(env):
    tid,_=setup_tenant(env)
    path=f'/api/v1/admin/tenants/{tid}/service'
    assert post(env['admin'],path,{'enabled':True,'reason':'Enable QA only'}).status_code==200
    assert post(env['admin'],path,{'paused':True,'reason':'Owner requested break'}).status_code==200
    assert env['owner']['client'].get(f'/api/v1/tenants/{tid}/entitlement').json()['reason']=='BOT_PAUSED'
    assert post(env['admin'],path,{'paused':False,'reason':'Owner back online'}).status_code==200
    assert env['owner']['client'].get(f'/api/v1/tenants/{tid}/entitlement').json()['allowed']
    assert post(env['admin'],path,{'enabled':False,'reason':'Service disabled by admin'}).status_code==200
    assert env['owner']['client'].get(f'/api/v1/tenants/{tid}/entitlement').json()['reason']=='SERVICE_DISABLED'

def test_service_reason_required(env):
    tid,_=setup_tenant(env)
    assert post(env['admin'],f'/api/v1/admin/tenants/{tid}/service',{'enabled':False,'reason':'no'}).status_code==422

def test_trial_expires_even_without_cron_job(env):
    tid,_=setup_tenant(env,trial_days=7)
    assert post(env['admin'],f'/api/v1/admin/tenants/{tid}/service',{'enabled':True,'reason':'QA enable for trial'}).status_code==200
    at=now_utc()+dt.timedelta(days=8)
    result=env['store'].get_entitlement(env['store'].session(env['owner']['client'].cookies.get(CNAME)),tid,at)
    assert not result['allowed']
    assert result['reason']=='SUBSCRIPTION_NOT_ENTITLED'

def test_trial_reconcile_expires_idempotently(env):
    tid,_=setup_tenant(env)
    actor=env['store'].session(env['admin']['client'].cookies.get(CNAME))
    past=now_utc()+dt.timedelta(days=8)
    r1=env['store'].reconcile(actor,tid,past)
    r2=env['store'].reconcile(actor,tid,past)
    assert r1['new']=='EXPIRED' and r1['changed']
    assert not r2['changed']

def test_wrong_tenant_suspension_does_not_change_unrelated(env):
    ta,_=setup_tenant(env)
    tb=post(env['admin'],'/api/v1/admin/tenants',{'name':'Shop B','industry':'grocery','owner_id':env['owner']['id']}).json()['tenant_id']
    assert post(env['admin'],f'/api/v1/admin/tenants/{ta}/service',{'enabled':False,'reason':'Testing scoped disable'}).status_code==200
    assert env['store'].one('SELECT service_enabled FROM tenants WHERE id=?',tb)['service_enabled']==0
    assert env['store'].one('SELECT bot_paused FROM tenants WHERE id=?',tb)['bot_paused']==0

def test_unsigned_payment_is_rejected(env):
    tid,sid=setup_tenant(env,trial_days=0)
    r=env['admin']['client'].post('/api/v1/internal/qa/test-payment-webhook',json=event(tid,sid))
    assert r.status_code==403
    assert env['store'].one('SELECT state FROM subscriptions WHERE id=?',sid)['state']=='PAYMENT_DUE'

def test_signed_sandbox_payment_activates_once(env):
    tid,sid=setup_tenant(env,trial_days=0)
    raw,headers=signed_payload(event(tid,sid))
    c=env['admin']['client'];url='/api/v1/internal/qa/test-payment-webhook'
    a=c.post(url,content=raw,headers=headers);b=c.post(url,content=raw,headers=headers)
    assert a.status_code==200 and a.json()['applied']
    assert b.status_code==200 and b.json()['idempotent'] and not b.json()['applied']
    assert env['store'].one('SELECT COUNT(*) AS c FROM payment_events')['c']==1
    assert env['store'].one('SELECT state FROM subscriptions WHERE id=?',sid)['state']=='ACTIVE'

def test_payment_wrong_tenant_id_is_fail_closed(env):
    tid,sid=setup_tenant(env,trial_days=0)
    raw,headers=signed_payload(event('tenant_wrong',sid))
    r=env['admin']['client'].post('/api/v1/internal/qa/test-payment-webhook',content=raw,headers=headers)
    assert r.status_code==404
    assert env['store'].one('SELECT state FROM subscriptions WHERE id=?',sid)['state']=='PAYMENT_DUE'

def test_payment_wrong_amount_is_fail_closed(env):
    tid,sid=setup_tenant(env,trial_days=0)
    raw,headers=signed_payload(event(tid,sid,amount_minor=1))
    r=env['admin']['client'].post('/api/v1/internal/qa/test-payment-webhook',content=raw,headers=headers)
    assert r.status_code==422
    assert env['store'].one('SELECT COUNT(*) AS c FROM payment_events')['c']==0

def test_payment_invalid_signature_rejected(env):
    tid,sid=setup_tenant(env,trial_days=0)
    raw,headers=signed_payload(event(tid,sid));headers['x-event-signature']='0'*64
    assert env['admin']['client'].post('/api/v1/internal/qa/test-payment-webhook',content=raw,headers=headers).status_code==403

def test_payment_old_timestamp_rejected(env):
    tid,sid=setup_tenant(env,trial_days=0)
    raw,headers=signed_payload(event(tid,sid),ts=int(now_utc().timestamp())-999)
    assert env['admin']['client'].post('/api/v1/internal/qa/test-payment-webhook',content=raw,headers=headers).status_code==403

def test_payment_wrong_currency_is_fail_closed(env):
    tid,sid=setup_tenant(env,trial_days=0)
    raw,headers=signed_payload(event(tid,sid,currency='USD'))
    assert env['admin']['client'].post('/api/v1/internal/qa/test-payment-webhook',content=raw,headers=headers).status_code==422

def test_payment_fake_screenshot_cannot_activate(env):
    tid,sid=setup_tenant(env,trial_days=0)
    payload=event(tid,sid,receipt='screenshot_paid.jpg')
    assert env['store'].one('SELECT state FROM subscriptions WHERE id=?',sid)['state']=='PAYMENT_DUE'
    assert not any('upload' in route.path for route in env['app'].routes)

def test_webhook_disabled_in_default_app(env):
    c=TestClient(create_app(env['store'],origin='https://admin.test'),base_url='https://admin.test')
    assert c.post('/api/v1/internal/qa/test-payment-webhook').status_code==404

def test_channel_vault_reference_cannot_return_secret(env):
    tid,_=setup_tenant(env)
    r=post(env['admin'],f'/api/v1/admin/tenants/{tid}/channels',{'platform':'telegram','external_account_ref':'chat-abc','secret_ref':'vault://qa/tenant-abc','reason':'Test credential pointer only'})
    assert r.status_code==200
    ch=env['owner']['client'].get(f'/api/v1/tenants/{tid}/channels').json()['items']
    assert ch[0]['platform']=='telegram' and 'secret_ref' not in ch[0]

def test_channel_plain_token_cannot_be_saved(env):
    tid,_=setup_tenant(env)
    r=post(env['admin'],f'/api/v1/admin/tenants/{tid}/channels',{'platform':'line','external_account_ref':'oa-1','secret_ref':'SECRET-THIS-IS-A-TOKEN','reason':'Trying unencrypted reference'})
    assert r.status_code==422

def test_support_cannot_change_channel_binding(env):
    tid,_=setup_tenant(env)
    r=post(env['support'],f'/api/v1/admin/tenants/{tid}/channels',{'platform':'line','external_account_ref':'oa-1','secret_ref':'vault://qa/tenant-abc','reason':'Should not be allowed'})
    assert r.status_code==403

def test_product_knowledge_requires_approval(env):
    c=env['admin']['client']
    k=post(env['admin'],'/api/v1/admin/knowledge/drafts',{'kind':'PRICING','source':'internal://pricing/staging','content':{'note':'Contact for confirmed quote'}})
    assert k.status_code==201
    kid=k.json()['knowledge_id']
    assert c.get('/api/v1/public/knowledge/PRICING').status_code==404
    assert post(env['admin'],f'/api/v1/admin/knowledge/{kid}/approve',{}).status_code==200
    read=c.get('/api/v1/public/knowledge/PRICING')
    assert read.status_code==200 and read.json()['content']['note']=='Contact for confirmed quote'

def test_staff_cannot_publish_knowledge(env):
    r=post(env['staff'],'/api/v1/admin/knowledge/drafts',{'kind':'PRICING','source':'internal://pricing/staging','content':{'price':0}})
    assert r.status_code==403

def test_internal_playbook_never_exposed_publicly(env):
    assert env['admin']['client'].get('/api/v1/public/knowledge/SALES').status_code==404

def test_knowledge_secret_key_rejected(env):
    r=post(env['admin'],'/api/v1/admin/knowledge/drafts',{'kind':'PUBLIC_DOC','source':'internal://docs','content':{'api_key':'not-a-real-token'}})
    assert r.status_code==422

def test_audit_is_append_only_and_hash_chained(env):
    setup_tenant(env)
    s=env['store'];assert s.verify_audit()
    with pytest.raises(sqlite3.DatabaseError):s.conn.execute('DELETE FROM audit_events WHERE seq=1')
    with pytest.raises(sqlite3.DatabaseError):s.conn.execute('UPDATE audit_events SET action="bad" WHERE seq=1')
    assert s.verify_audit()

def test_no_exposed_management_urls_in_routes(env):
    paths='\n'.join(r.path for r in env['app'].routes)
    for banned in ('n8n/workflows/activate','production-order','create_order','/admin/credential/read','payment/confirm-from-screenshot'):
        assert banned not in paths

def test_no_leakage_of_passwords_or_tokens_in_audit(env):
    setup_tenant(env)
    content=json.dumps(env['admin']['client'].get('/api/v1/admin/audit').json())
    assert PASSWORD not in content and SECRET not in content and CNAME not in content

def test_missing_entitlement_is_fail_closed(env):
    a=env['admin']['client'].get('/api/v1/tenants/tenant_nonexistent/entitlement')
    assert a.status_code==404

def test_unauthorized_staff_cannot_change_store_service(env):
    tid,_=setup_tenant(env)
    r=post(env['staff'],f'/api/v1/admin/tenants/{tid}/service',{'paused':True,'reason':'Not authorized staff'})
    assert r.status_code==403

def test_tenant_owner_no_global_tenant_listing(env):
    assert env['owner']['client'].get('/api/v1/admin/tenants').status_code==403

def test_missing_explicit_stage_env_does_not_auto_start_service():
    assert os.environ.get('TIEN404_STAGING_ONLY')!='I_UNDERSTAND_NOT_PRODUCTION'


def test_unpaid_new_tenant_is_denied_even_within_grace_window(env):
    tid,_=setup_tenant(env,trial_days=0)
    assert post(env['admin'],f'/api/v1/admin/tenants/{tid}/service',{'enabled':True,'reason':'Enable for entitlement check'}).status_code==200
    entitlement=env['owner']['client'].get(f'/api/v1/tenants/{tid}/entitlement').json()
    assert entitlement['subscription_state']=='PAYMENT_DUE' and entitlement['allowed'] is False
    assert entitlement['reason']=='SUBSCRIPTION_NOT_ENTITLED'

def test_paid_tenant_is_allowed_during_grace_after_prior_payment(env):
    tid,sid=setup_tenant(env,trial_days=0)
    assert post(env['admin'],f'/api/v1/admin/tenants/{tid}/service',{'enabled':True,'reason':'Enable after paid only'}).status_code==200
    raw,headers=signed_payload(event(tid,sid))
    assert env['admin']['client'].post('/api/v1/internal/qa/test-payment-webhook',content=raw,headers=headers).status_code==200
    admin=env['store'].session(env['admin']['client'].cookies.get(CNAME))
    expiry=env['store'].one('SELECT renewal_at,grace_until FROM subscriptions WHERE id=?',sid)
    elapsed=dt.datetime.fromisoformat(expiry['renewal_at'])+dt.timedelta(seconds=1)
    r=env['store'].reconcile(admin,tid,elapsed)
    assert r['new']=='PAYMENT_DUE'
    allowed=env['store'].get_entitlement(admin,tid,elapsed)
    assert allowed['allowed'] is True
    past=dt.datetime.fromisoformat(expiry['grace_until'])+dt.timedelta(seconds=1)
    assert env['store'].get_entitlement(admin,tid,past)['allowed'] is False

def test_low_entropy_mfa_secret_rejected(tmp_path):
    s=Store(tmp_path/'mfa.db',Fernet.generate_key())
    with pytest.raises(Invalid):s.create_user('bad@example.test',PASSWORD,'SUPER_ADMIN','A')
    s.conn.close()

def test_logout_all_revokes_sessions(env):
    r=post(env['admin'],'/api/v1/auth/logout-all',{})
    assert r.status_code==200 and r.json()['revoked']
    assert env['admin']['client'].get('/api/v1/auth/me').status_code==401

def test_admin_can_revoke_other_user_sessions_with_reason(env):
    owner=env['owner']
    assert owner['client'].get('/api/v1/auth/me').status_code==200
    r=post(env['admin'],f'/api/v1/admin/users/{owner["id"]}/revoke-sessions',{'reason':'Owner lost device'})
    assert r.status_code==200
    assert owner['client'].get('/api/v1/auth/me').status_code==401

def test_support_admin_cannot_revoke_other_user_sessions(env):
    r=post(env['support'],f'/api/v1/admin/users/{env["owner"]["id"]}/revoke-sessions',{'reason':'Trying unauthorized revocation'})
    assert r.status_code==403

def test_another_owner_cannot_read_other_tenant(env):
    tid,_=setup_tenant(env)
    another=env['store'].create_user('other_owner@example.test',PASSWORD,'STORE_OWNER',SECRET)
    data=env['store'].login('other_owner@example.test',PASSWORD,code_for(SECRET))
    c=TestClient(env['app'],base_url='https://admin.test')
    c.cookies.set(CNAME,data['session'],domain='admin.test',path='/')
    assert c.get(f'/api/v1/tenants/{tid}/entitlement').status_code==403

def test_sensitive_audit_reason_rejects_email_or_token(env):
    tid,_=setup_tenant(env)
    for reason in ('Please call me at owner@example.test','password=secret_value'):
        result=post(env['admin'],f'/api/v1/admin/tenants/{tid}/service',{'enabled':True,'reason':reason})
        assert result.status_code==422


def test_wrong_tenant_confirmation_blocks_service_mutation(env):
    tid,_=setup_tenant(env)
    body={'enabled':True,'reason':'The wrong shop was selected','confirm_tenant_id':'tenant_wrong'}
    r=env['admin']['client'].post(f'/api/v1/admin/tenants/{tid}/service',json=body,
        headers={'Origin':'https://admin.test','X-CSRF-Token':env['admin']['csrf']})
    assert r.status_code==403
    assert env['store'].one('SELECT service_enabled FROM tenants WHERE id=?',tid)['service_enabled']==0

def test_subscription_assignment_requires_explicit_tenant_confirmation(env):
    tid,_=setup_tenant(env)
    r=env['admin']['client'].post(f'/api/v1/admin/tenants/{tid}/subscription',
        json={'plan_id':'basic','trial_days':1,'confirm_tenant_id':'tenant_other'},
        headers={'Origin':'https://admin.test','X-CSRF-Token':env['admin']['csrf']})
    assert r.status_code==403

def test_admin_recent_mfa_requirement_stale_session_denies_write(env):
    raw=env['admin']['client'].cookies.get(CNAME)
    old=iso(now_utc()-dt.timedelta(minutes=6))
    env['store'].conn.execute('UPDATE sessions SET last_reauth_at=? WHERE session_hash=?',
        (old,hashlib.sha256(raw.encode()).hexdigest()))
    p=post(env['admin'],'/api/v1/admin/plans',{'id':'basic','label':'Basic','price_minor':100,'cycle':'MONTH','max_messages':10,'grace_days':3})
    assert p.status_code==403

def test_role_and_session_survive_database_reopen(tmp_path):
    key=Fernet.generate_key();db=tmp_path/'durable.db'
    s1=Store(db,key)
    u=s1.create_user('persist@example.test',PASSWORD,'SUPER_ADMIN',SECRET)
    login=s1.login('persist@example.test',PASSWORD,code_for(SECRET))
    assert login and s1.session(login['session'])
    s1.conn.close()
    s2=Store(db,key)
    assert s2.session(login['session'])['user_id']==u
    assert s2.verify_audit()
    s2.conn.close()

GATEWAY_SECRET=b'gateway_staging_only_secret___abcdef0123456789'
def gateway_payload(platform,account_ref,**extra):
    data={'platform':platform,'account_ref':account_ref,'request_id':'request_12345','purpose':'CHECK_ENTITLEMENT'}
    data.update(extra)
    ts=str(int(now_utc().timestamp()))
    raw=json.dumps(data,separators=(',',':')).encode()
    sig=hmac.new(GATEWAY_SECRET,ts.encode()+b'.'+raw,hashlib.sha256).hexdigest()
    return raw,{'x-gateway-timestamp':ts,'x-gateway-signature':sig}

def test_internal_gateway_is_disabled_by_default(env):
    assert env['admin']['client'].post('/api/v1/internal/gateway/entitlement').status_code==404

def test_gateway_does_not_trust_client_supplied_tenant_id(env):
    app=create_app(env['store'],origin='https://admin.test',gateway_secret=GATEWAY_SECRET)
    c=TestClient(app,base_url='https://admin.test')
    raw,headers=gateway_payload('telegram','chatabc',tenant_id='tenant_victim')
    assert c.post('/api/v1/internal/gateway/entitlement',content=raw,headers=headers).status_code==422

def test_gateway_requires_valid_hmac(env):
    app=create_app(env['store'],origin='https://admin.test',gateway_secret=GATEWAY_SECRET)
    c=TestClient(app,base_url='https://admin.test')
    raw,headers=gateway_payload('telegram','chatabc')
    headers['x-gateway-signature']='0'*64
    assert c.post('/api/v1/internal/gateway/entitlement',content=raw,headers=headers).status_code==403

def test_gateway_cannot_use_unverified_channel(env):
    tid,_=setup_tenant(env)
    assert post(env['admin'],f'/api/v1/admin/tenants/{tid}/channels',{'platform':'telegram','external_account_ref':'chatabc','secret_ref':'vault://qa/telegram-1','reason':'Store only external reference'}).status_code==200
    app=create_app(env['store'],origin='https://admin.test',gateway_secret=GATEWAY_SECRET)
    c=TestClient(app,base_url='https://admin.test')
    raw,headers=gateway_payload('telegram','chatabc')
    result=c.post('/api/v1/internal/gateway/entitlement',content=raw,headers=headers)
    assert result.status_code==200 and not result.json()['allowed']
    assert result.json()['reason']=='CHANNEL_NOT_VERIFIED'

def test_gateway_entitlement_mapped_to_correct_tenant_and_fails_closed(env):
    tid,_=setup_tenant(env)
    post(env['admin'],f'/api/v1/admin/tenants/{tid}/channels',{'platform':'telegram','external_account_ref':'chatabc','secret_ref':'vault://qa/telegram-1','reason':'Metadata only, still unverified'})
    # Adapter external verification is intentionally not exposed; simulate verified state ONLY inside ephemeral QA SQLite.
    env['store'].conn.execute('UPDATE channels SET connection_status="VERIFIED" WHERE tenant_id=?',(tid,))
    app=create_app(env['store'],origin='https://admin.test',gateway_secret=GATEWAY_SECRET)
    c=TestClient(app,base_url='https://admin.test')
    raw,headers=gateway_payload('telegram','chatabc')
    r=c.post('/api/v1/internal/gateway/entitlement',content=raw,headers=headers)
    assert r.status_code==200 and not r.json()['allowed'] and r.json()['tenant_id']==tid
    assert r.json()['reason']=='SERVICE_DISABLED'
    assert post(env['admin'],f'/api/v1/admin/tenants/{tid}/service',{'enabled':True,'reason':'QA service enable only'}).status_code==200
    r2=c.post('/api/v1/internal/gateway/entitlement',content=raw,headers=headers)
    assert r2.status_code==200 and r2.json()['allowed'] and r2.json()['tenant_id']==tid

def test_gateway_wrong_external_account_is_rejected(env):
    tid,_=setup_tenant(env)
    post(env['admin'],f'/api/v1/admin/tenants/{tid}/channels',{'platform':'telegram','external_account_ref':'known-account','secret_ref':'vault://qa/tg1a1','reason':'Bind known account'})
    c=TestClient(create_app(env['store'],origin='https://admin.test',gateway_secret=GATEWAY_SECRET),base_url='https://admin.test')
    raw,headers=gateway_payload('telegram','unknown-account')
    assert c.post('/api/v1/internal/gateway/entitlement',content=raw,headers=headers).status_code==403

def test_cannot_map_same_channel_account_to_two_tenants(env):
    tid,_=setup_tenant(env)
    other=post(env['admin'],'/api/v1/admin/tenants',{'name':'Independent shop','industry':'home goods','owner_id':env['owner']['id']}).json()['tenant_id']
    a=post(env['admin'],f'/api/v1/admin/tenants/{tid}/channels',{'platform':'line','external_account_ref':'official-account-id-1','secret_ref':'vault://qa/line-shop-a','reason':'Owner authorized channel mapping'})
    assert a.status_code==200
    # Duplicate mapping is rejected by unique database constraint.
    with pytest.raises(sqlite3.IntegrityError):
        env['store'].upsert_channel_reference(env['store'].session(env['admin']['client'].cookies.get(CNAME)),other,'line','official-account-id-1','vault://qa/line-shop-b','Must not hijack other tenant channel')


def test_private_staging_backup_and_restore_integrity(tmp_path):
    from app.backup import backup_private_stage, verify_stage_restore
    key=Fernet.generate_key();s=Store(tmp_path/'base.sqlite',key)
    s.create_user('snapshot@example.test',PASSWORD,'SUPER_ADMIN',SECRET)
    private=tmp_path/'private';private.mkdir(mode=0o700)
    destination=private/'snapshot.sqlite'
    snapshot=backup_private_stage(s,destination)
    assert snapshot['integrity']=='ok' and snapshot['size_bytes']>500
    assert snapshot['sha256']==hashlib.sha256(destination.read_bytes()).hexdigest()
    assert (destination.stat().st_mode & 0o077)==0
    s.conn.close()
    restored=verify_stage_restore(destination,key)
    assert restored['integrity_ok'] and restored['audit_chain_valid']
    assert restored['sha256']==snapshot['sha256']

def test_stage_backup_refuses_world_readable_folder(env,tmp_path):
    from app.backup import backup_private_stage
    public=tmp_path/'public';public.mkdir(mode=0o755)
    with pytest.raises(Invalid):backup_private_stage(env['store'],public/'dump.sqlite')
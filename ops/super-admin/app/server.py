"""Staging-only HTTPS API reference; never points to live Orders, n8n, or payment systems.

Do not deploy until the existing Sites app has been audited and the persistence,
identity, webhook, secret management, and rate limiting adapters are reviewed.
"""
from __future__ import annotations
import datetime as dt
import os
import re
import secrets
from typing import Annotated, Literal
from fastapi import FastAPI, Request, Depends, Response, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ConfigDict
from .core import Store, AccessDenied, Conflict, NotFound, Invalid, now_utc, iso, parse, verify_test_webhook

class Strict(BaseModel):model_config=ConfigDict(extra='forbid',strict=True)
class Login(Strict):
    email: str=Field(min_length=3,max_length=254)
    password: str=Field(min_length=14,max_length=200)
    totp: str=Field(pattern=r'^\d{6}$')
class Reauth(Strict):
    password: str=Field(min_length=14,max_length=200)
    totp: str=Field(pattern=r'^\d{6}$')
class PlanInput(Strict):
    id: str=Field(pattern=r'^[a-z0-9_]{3,35}$')
    label: str=Field(min_length=2,max_length=100)
    price_minor: int=Field(ge=0,le=10**12)
    cycle: Literal['MONTH','YEAR']
    max_messages: int=Field(ge=0,le=10**8)
    grace_days: int=Field(ge=0,le=30)
class TenantInput(Strict):
    name: str=Field(min_length=2,max_length=150)
    industry: str=Field(min_length=2,max_length=90)
    owner_id: str=Field(min_length=5,max_length=80)
class SubscriptionInput(Strict):
    confirm_tenant_id: str=Field(min_length=5,max_length=80)
    plan_id: str=Field(min_length=3,max_length=35)
    trial_days: int=Field(ge=0,le=30)
class ServiceInput(Strict):
    confirm_tenant_id: str=Field(min_length=5,max_length=80)
    enabled: bool|None=None
    paused: bool|None=None
    reason: str=Field(min_length=5,max_length=200)
class ReasonInput(Strict):
    reason: str=Field(min_length=5,max_length=200)
class ChannelInput(Strict):
    confirm_tenant_id: str=Field(min_length=5,max_length=80)
    platform: Literal['messenger','line','zalo','telegram']
    external_account_ref: str=Field(min_length=1,max_length=180)
    secret_ref: str=Field(pattern=r'^vault://[A-Za-z0-9/_-]{5,150}$')
    reason: str=Field(min_length=5,max_length=200)
class KnowledgeInput(Strict):
    kind: Literal['PRODUCT','SALES','PRICING','SUPPORT','PUBLIC_DOC']
    source: str=Field(min_length=4,max_length=300)
    content: dict

CNAME='__Host-tien404_sid'

def create_app(store:Store,*,gateway_secret:bytes|None=None,origin:str='https://admin.test',sandbox_payment_secret:bytes|None=None,allow_test_webhook:bool=False,secure_cookies:bool=True):
    if not origin.startswith('https://') or '/' in origin[8:] or '*' in origin:
        raise ValueError('single HTTPS origin required, no wildcard')
    app=FastAPI(title='TIEN404 admin staging security API',version='0.1.0',docs_url=None,redoc_url=None,openapi_url=None)
    app.state.store=store
    @app.middleware('http')
    async def headers_and_origin(request:Request,call_next):
        if request.method not in {'GET','HEAD','OPTIONS'}:
            req_origin=request.headers.get('origin')
            if req_origin and req_origin!=origin:
                return JSONResponse({'error':'cross_origin_denied'},status_code=403)
        response=await call_next(request)
        response.headers.update({'Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"})
        return response
    @app.exception_handler(AccessDenied)
    async def on_denied(request,exc):return JSONResponse({'error':str(exc)},status_code=403)
    @app.exception_handler(Conflict)
    async def on_conflict(request,exc):return JSONResponse({'error':str(exc)},status_code=409)
    @app.exception_handler(Invalid)
    async def on_invalid(request,exc):return JSONResponse({'error':str(exc)},status_code=422)
    @app.exception_handler(NotFound)
    async def on_missing(request,exc):return JSONResponse({'error':'not_found'},status_code=404)

    def actor(request:Request):
        row=store.session(request.cookies.get(CNAME,''))
        if not row:raise HTTPException(status_code=401,detail='unauthenticated')
        return row
    def write_actor(request:Request,x_csrf_token:Annotated[str|None,Header()]=None):
        user=actor(request)
        if not store.verify_csrf(user,x_csrf_token):raise HTTPException(status_code=403,detail='csrf_invalid')
        return user
    def admin(user,roles):store.require_role(user,roles)

    @app.get('/health')
    def health():return {'status':'STAGING_ONLY','production_readiness':'NOT_APPROVED','source':'local_sqlite_test_backend','checked_at':iso(now_utc()),'live_n8n':'DISCONNECTED','payment_gateway':'SANDBOX_ONLY'}
    @app.post('/api/v1/auth/login')
    def login(payload:Login,response:Response):
        try:data=store.login(payload.email,payload.password,payload.totp)
        except AccessDenied:raise HTTPException(status_code=429,detail='rate_limited')
        if not data:raise HTTPException(status_code=401,detail='invalid_login')
        response.set_cookie(CNAME,data['session'],max_age=8*60*60,path='/',httponly=True,secure=secure_cookies,samesite='strict')
        return {'csrf':data['csrf'],'session_expires_at':data['expires_at'],'type':'STAGING_SESSION'}
    @app.get('/api/v1/auth/me')
    def me(user=Depends(actor)):return {'user_id':user['user_id'],'role':user['global_role'],'session_expires_at':user['expires_at']}
    @app.post('/api/v1/auth/csrf')
    def csrf(user=Depends(actor)):
        token=secrets.token_urlsafe(32)
        with store.tx():store.conn.execute('UPDATE sessions SET csrf_hash=? WHERE session_hash=?',(__import__('hashlib').sha256(token.encode()).hexdigest(),user['session_hash']))
        return {'csrf':token}
    @app.post('/api/v1/auth/logout')
    def logout(request:Request,response:Response,user=Depends(write_actor)):
        store.revoke_session(user,request.cookies.get(CNAME,''))
        response.delete_cookie(CNAME,path='/',secure=secure_cookies,httponly=True,samesite='strict')
        return {'revoked':True}
    @app.post('/api/v1/auth/logout-all')
    def logout_all(request:Request,response:Response,user=Depends(write_actor)):
        result=store.revoke_all_user_sessions(user)
        response.delete_cookie(CNAME,path='/',secure=secure_cookies,httponly=True,samesite='strict')
        return result
    @app.post('/api/v1/admin/users/{user_id}/revoke-sessions')
    def revoke_user_sessions(user_id:str,body:ReasonInput,user=Depends(write_actor)):
        store.require_role(user,{'SUPER_ADMIN'});store.require_fresh_auth(user)
        return store.revoke_all_user_sessions(user,user_id,body.reason)
    @app.post('/api/v1/auth/reauth')
    def reauth(payload:Reauth,user=Depends(write_actor)):
        # A new TOTP timestep is required (replay prevention) to reauthorize sensitive operations.
        key=store.fernet.decrypt(store.one('SELECT totp_enc FROM users WHERE id=?',user['user_id'])['totp_enc']).decode()
        password_hash=store.one('SELECT password_hash FROM users WHERE id=?',user['user_id'])['password_hash']
        from argon2.exceptions import VerifyMismatchError,VerificationError
        from .core import totp_codes
        import hmac
        try:pw_ok=store.hasher.verify(password_hash,payload.password)
        except (VerifyMismatchError,VerificationError):pw_ok=False
        if not pw_ok:raise AccessDenied('invalid reauthentication')
        codes=[counter for counter,code in totp_codes(key) if hmac.compare_digest(code,payload.totp)]
        with store.tx():
            saved=store.one('SELECT last_totp_counter FROM users WHERE id=?',user['user_id'])
            valid=[c for c in codes if c>saved['last_totp_counter']]
            if not valid:raise AccessDenied('expired or reused TOTP')
            store.conn.execute('UPDATE users SET last_totp_counter=? WHERE id=?',(max(valid),user['user_id']))
            store.conn.execute('UPDATE sessions SET last_reauth_at=? WHERE session_hash=?',(iso(now_utc()),user['session_hash']))
            store.audit(user['user_id'],'SESSION_REAUTH',reason='password and new TOTP verified')
        return {'reauthenticated':True}

    @app.get('/api/v1/admin/tenants')
    def tenants(user=Depends(actor)):
        admin(user,{'SUPER_ADMIN','SUPPORT_ADMIN','TECH_ADMIN'})
        records=store.rows('SELECT id,name,industry,service_enabled,bot_paused,created_at FROM tenants ORDER BY created_at DESC LIMIT 100')
        return {'items':[dict(r) for r in records],'source':'staging_sqlite','updated_at':iso(now_utc()),'status':'STAGING_DATA'}
    @app.post('/api/v1/admin/plans',status_code=201)
    def plan(body:PlanInput,user=Depends(write_actor)):return store.create_plan(user,body.id,body.label,body.price_minor,body.cycle,body.max_messages,body.grace_days)
    @app.post('/api/v1/admin/tenants',status_code=201)
    def tenant(body:TenantInput,user=Depends(write_actor)):return {'tenant_id':store.create_tenant(user,body.name,body.industry,body.owner_id)}
    @app.post('/api/v1/admin/tenants/{tenant_id}/subscription',status_code=201)
    def subscribe(tenant_id:str,body:SubscriptionInput,user=Depends(write_actor)):
        if body.confirm_tenant_id!=tenant_id:raise AccessDenied('tenant confirmation mismatch')
        return {'subscription_id':store.assign_subscription(user,tenant_id,body.plan_id,now_utc(),body.trial_days)}
    @app.post('/api/v1/admin/tenants/{tenant_id}/service')
    def change_service(tenant_id:str,body:ServiceInput,user=Depends(write_actor)):
        if body.confirm_tenant_id!=tenant_id:raise AccessDenied('tenant confirmation mismatch')
        store.update_service(user,tenant_id,body.enabled,body.paused,body.reason)
        return {'updated':True,'tenant_id':tenant_id,'n8n_workflow_modified':False}
    @app.post('/api/v1/admin/tenants/{tenant_id}/reconcile')
    def reconcile(tenant_id:str,user=Depends(write_actor)):return store.reconcile(user,tenant_id,now_utc())
    @app.get('/api/v1/tenants/{tenant_id}/entitlement')
    def entitlement(tenant_id:str,user=Depends(actor)):return store.get_entitlement(user,tenant_id)
    @app.post('/api/v1/admin/tenants/{tenant_id}/channels')
    def channel(tenant_id:str,body:ChannelInput,user=Depends(write_actor)):
        if body.confirm_tenant_id!=tenant_id:raise AccessDenied('tenant confirmation mismatch')
        store.upsert_channel_reference(user,tenant_id,body.platform,body.external_account_ref,body.secret_ref,body.reason)
        return {'updated':True,'status':'UNKNOWN','token_returned':False}
    @app.get('/api/v1/tenants/{tenant_id}/channels')
    def channels(tenant_id:str,user=Depends(actor)):return {'items':store.get_channels(user,tenant_id),'updated_at':iso(now_utc()),'source':'staging_sqlite'}
    @app.post('/api/v1/admin/knowledge/drafts',status_code=201)
    def draft(body:KnowledgeInput,user=Depends(write_actor)):return {'knowledge_id':store.draft_knowledge(user,body.kind,body.source,body.content)}
    @app.post('/api/v1/admin/knowledge/{kb_id}/approve')
    def approve(kb_id:str,user=Depends(write_actor)):store.approve_knowledge(user,kb_id);return {'approved':True,'auto_deployed_to_model':False}
    @app.get('/api/v1/public/knowledge/{kind}')
    def knowledge(kind:str):
        if kind not in {'PRODUCT','PRICING','PUBLIC_DOC'}:raise NotFound('public knowledge')
        data=store.active_knowledge(kind)
        if not data:raise NotFound('approved knowledge')
        return data
    @app.get('/api/v1/admin/audit')
    def audit(user=Depends(actor)):
        admin(user,{'SUPER_ADMIN'})
        data=store.rows('SELECT id,created_at,actor_id,action,tenant_id,reason,sha256 FROM audit_events ORDER BY seq DESC LIMIT 100')
        return {'entries':[dict(x) for x in data],'hash_chain_valid':store.verify_audit()}
    @app.post('/api/v1/internal/gateway/entitlement')
    async def gateway_entitlement(request:Request):
        if not gateway_secret:raise NotFound('gateway integration disabled')
        from .gateway import verify_internal_gateway_request
        assertion=verify_internal_gateway_request(gateway_secret,await request.body(),request.headers.get('x-gateway-timestamp',''),request.headers.get('x-gateway-signature',''))
        return store.internal_entitlement_from_verified_channel(assertion)
    @app.post('/api/v1/internal/qa/test-payment-webhook')
    async def test_payment_webhook(request:Request):
        if not allow_test_webhook or not sandbox_payment_secret:raise NotFound('test hook disabled')
        body=await request.body()
        v=verify_test_webhook(sandbox_payment_secret,body,request.headers.get('x-event-timestamp',''),request.headers.get('x-event-signature',''))
        result=store.apply_verified_payment(v,v.tenant_id,v.subscription_id,v.amount_minor,v.currency,now_utc())
        return {'status':'SANDBOX_ONLY',**result}
    return app

# Direct `uvicorn app.server:app` deliberately cannot start without explicitly
# setting every staging-only prerequisite. This avoids accidental public exposure.
if os.environ.get('TIEN404_STAGING_ONLY')=='I_UNDERSTAND_NOT_PRODUCTION':
    from cryptography.fernet import Fernet
    k=os.environ.get('TIEN404_ENCRYPTION_KEY','').encode()
    if not k:raise RuntimeError('TIEN404_ENCRYPTION_KEY is required; never commit it')
    app=create_app(Store(os.environ.get('TIEN404_DB_PATH','./staging_admin.db'),k),origin=os.environ.get('TIEN404_ADMIN_ORIGIN','https://admin.example.invalid'))
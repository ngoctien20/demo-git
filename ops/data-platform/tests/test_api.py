from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import Settings, create_app

TENANT_A='11111111-1111-4111-8111-111111111111'
TENANT_B='22222222-2222-4222-8222-222222222222'
USER='33333333-3333-4333-8333-333333333333'
TOKEN='eyJhbGciOiJIUzI1NiJ9.' + 'eyJzdWIiOiIxMjM0In0.' + 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'

# We simulate a Supabase Auth service and a tenant-scoped PostgREST endpoint.
# These fixtures never use real customer data, credentials, or live HTTP calls.
def api(handler, config=True):
    settings=Settings('https://staging.supabase.co' if config else None,
                      'sb_publishable_example_staging' if config else None,
                      'https://app-staging.example.invalid')
    return TestClient(create_app(settings,transport=httpx.MockTransport(handler)))

def headers():return {'Authorization':'Bearer '+TOKEN}

def good(request):
    assert request.url.host=='staging.supabase.co'
    assert request.headers.get('apikey')=='sb_publishable_example_staging'
    assert request.headers.get('authorization')=='Bearer '+TOKEN
    if request.url.path=='/auth/v1/user':return httpx.Response(200,json={'id':USER})
    if request.url.path.endswith('/tenant_memberships'):
        tid=request.url.params.get('tenant_id','eq.'+TENANT_A).removeprefix('eq.')
        if tid==TENANT_B:return httpx.Response(200,json=[])
        assert request.url.params.get('user_id')=='eq.'+USER
        return httpx.Response(200,json=[{'tenant_id':TENANT_A,'role':'owner'}])
    if request.url.path.endswith('/products'):
        assert request.url.params['tenant_id']=='eq.'+TENANT_A
        return httpx.Response(200,json=[{'id':'p','tenant_id':TENANT_A,'sku':'A001','name':'Áo thun','price_vnd':159000,'stock_on_hand':10,'is_active':True,'updated_at':'2026-11-10T00:00:00Z','private_field':'must-not-appear'}])
    if request.url.path.endswith('/orders'):
        return httpx.Response(200,json=[{'id':'o','tenant_id':TENANT_A,'status':'pending','total_vnd':159000,'created_at':'2026-11-10T00:00:00Z','customer_phone':'PRIVATE'}])
    raise AssertionError('unexpected request: '+str(request.url))

def test_health_is_honest_unknown_and_configured_not_verified():
    with api(good,False) as client:
        data=client.get('/health').json()
        assert data['status']=='UNKNOWN' and data['database_connected'] is False
        assert client.get('/api/v1/tenants',headers=headers()).status_code==503
    with api(good) as client:
        assert client.get('/health').json()['status']=='CONFIGURED_NOT_VERIFIED'

def test_no_auth_blocks_before_provider_access():
    with api(lambda req: (_ for _ in ()).throw(AssertionError('network should not be called'))) as client:
        assert client.get('/api/v1/tenants/'+TENANT_A+'/products').status_code==401
        assert client.get('/api/v1/tenants/'+TENANT_A+'/orders').status_code==401

def test_tenant_scope_and_allowlisted_fields():
    with api(good) as client:
        res=client.get('/api/v1/tenants/'+TENANT_A+'/products',headers=headers())
        assert res.status_code==200
        assert res.json()['items'][0]['price_vnd']==159000
        assert 'private_field' not in str(res.json())
        assert client.get('/api/v1/tenants/'+TENANT_B+'/products',headers=headers()).status_code==404
        orders=client.get('/api/v1/tenants/'+TENANT_A+'/orders',headers=headers())
        assert orders.status_code==200 and 'customer_phone' not in str(orders.json())

def test_staff_cannot_read_order_totals():
    def handler(req):
        if req.url.path=='/auth/v1/user':return httpx.Response(200,json={'id':USER})
        return httpx.Response(200,json=[{'tenant_id':TENANT_A,'role':'staff'}])
    with api(handler) as client:
        assert client.get('/api/v1/tenants/'+TENANT_A+'/orders',headers=headers()).status_code==403

def test_invalid_auth_and_provider_failures_fail_closed():
    def denied(req):return httpx.Response(401,json={'message':'secret detail'})
    with api(denied) as client:
        res=client.get('/api/v1/tenants',headers=headers())
        assert res.status_code==401 and 'secret' not in res.text
    def outage(req):return httpx.Response(503,text='internal-token-do-not-echo')
    with api(outage) as client:
        res=client.get('/api/v1/tenants',headers=headers())
        assert res.status_code==503 and 'internal-token' not in res.text

def test_provider_tenant_violation_and_invalid_payload():
    def wrong(req):
        if req.url.path=='/auth/v1/user':return httpx.Response(200,json={'id':USER})
        if req.url.path.endswith('tenant_memberships'):return httpx.Response(200,json=[{'tenant_id':TENANT_A,'role':'owner'}])
        return httpx.Response(200,json=[{'tenant_id':TENANT_B,'id':'leak'}])
    with api(wrong) as client:
        res=client.get('/api/v1/tenants/'+TENANT_A+'/products',headers=headers())
        assert res.status_code==502 and 'leak' not in res.text

def test_unsupported_mutations_and_bad_inputs_rejected():
    with api(good) as client:
        assert client.post('/api/v1/tenants/'+TENANT_A+'/orders',headers=headers(),json={}).status_code==405
        assert client.get('/api/v1/tenants/not-a-uuid/products',headers=headers()).status_code==422
        assert client.get('/api/v1/tenants/'+TENANT_A+'/products?limit=101',headers=headers()).status_code==422

def test_cross_origin_blocked_preflight_and_only_allowed_origin():
    with api(good) as client:
        blocked=client.options('/api/v1/tenants',headers={'Origin':'https://evil.example','Access-Control-Request-Method':'GET'})
        assert blocked.status_code==400
        ok=client.options('/api/v1/tenants',headers={'Origin':'https://app-staging.example.invalid','Access-Control-Request-Method':'GET'})
        assert ok.status_code==200

def test_settings_reject_production_and_insecure_host():
    with pytest.raises(ValueError):Settings('http://example.com','sb_pub','https://front.example')
    with pytest.raises(ValueError):Settings('https://x.supabase.co','sb_pub','https://front.example',mode='production')
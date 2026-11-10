"""No external API requests. Super Admin read-only adapter is explicitly fail-closed."""
import asyncio
import httpx
from app.data_platform_status import fetch_data_platform_status

def run(url, handler):
    return asyncio.run(fetch_data_platform_status(url,transport=httpx.MockTransport(handler)))

def test_disabled_or_other_host_fail_closed():
    assert run(None, lambda req: None)['status']=='UNKNOWN'
    assert run('http://tien404-data-staging.onrender.com', lambda req: None)['status']=='CONFIGURATION_REJECTED'
    assert run('https://attacker.example.invalid', lambda req: None)['status']=='CONFIGURATION_REJECTED'

def test_realistic_staging_health_never_claims_database_connected():
    def ok(request):
        assert request.url.host=='tien404-data-staging.onrender.com'
        return httpx.Response(200,json={'mode':'staging','status':'CONFIGURED_NOT_VERIFIED',
                                        'database_connected':False,'production_readiness':'NOT_APPROVED',
                                        'observed_at':'2026-11-10T13:00:00Z'})
    result=run('https://tien404-data-staging.onrender.com',ok)
    assert result['status']=='API_REACHABLE_DB_NOT_VERIFIED'
    assert result['can_write'] is False and result['tenant_data_connected'] is False

def test_bad_upstream_never_upgrades_reliability_or_reveals_payload():
    def bad(request):return httpx.Response(200,json={'mode':'production','status':'OK','database_connected':True,
                                                      'production_readiness':'READY','secret':'do-not-leak'})
    result=run('https://tien404-data-staging.onrender.com',bad)
    assert result['status']=='UNTRUSTED_UPSTREAM_RESPONSE'
    assert 'do-not-leak' not in str(result)

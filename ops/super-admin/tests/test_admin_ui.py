"""Isolated Super Admin staging UI + read API tests. No production resources."""
import base64
import secrets
from pathlib import Path
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from app.core import Store,totp_codes
from app.server import create_app

PASS="very_strong_stage_only_password!"
def totp(s): 
    import time
    return dict(totp_codes(s))[int(time.time()//30)]

def client_with_user(tmp_path,role="SUPER_ADMIN"):
    store=Store(tmp_path/"admin-ui-test.sqlite",Fernet.generate_key())
    secret=base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")
    user_id=store.create_user("admin@example.test",PASS,role,secret)
    client=TestClient(create_app(store,origin="https://admin.test"),base_url="https://admin.test")
    return store,client,secret,user_id

def test_ui_assets_staging_and_csp(tmp_path):
    s,c,secret,uid=client_with_user(tmp_path)
    for path,typ in [("/admin","text/html"),("/admin/","text/html"),("/admin/assets/admin.css","text/css"),("/admin/assets/admin.js","text/javascript")]:
        r=c.get(path)
        assert r.status_code==200,(path,r.text)
        assert typ in r.headers.get("content-type","")
        assert "script-src 'self'" in r.headers["content-security-policy"]
        assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
        assert r.headers.get("cache-control")=="no-store"
    page=c.get("/admin").text
    assert 'id="login-form"' in page
    assert 'noindex,nofollow' in page
    assert "STAGING" in page
    assert "sk-" not in page
    assert c.get("/api/v1/admin/plans").status_code==401
    assert c.get("/api/v1/admin/tenants").status_code==401
    assert c.get("/api/v1/admin/audit").status_code==401
    assert "default-src 'none'" in c.get("/api/v1/admin/plans").headers["content-security-policy"]
    s.conn.close()

def test_plans_are_read_from_staging_only_by_admin_roles(tmp_path):
    s,c,secret,uid=client_with_user(tmp_path)
    login=c.post("/api/v1/auth/login",json={"email":"admin@example.test","password":PASS,"totp":totp(secret)},headers={"Origin":"https://admin.test"})
    assert login.status_code==200
    headers={"Origin":"https://admin.test","X-CSRF-Token":login.json()["csrf"]}
    plans=c.get("/api/v1/admin/plans")
    assert plans.status_code==200
    assert plans.json()["items"]==[]
    assert plans.json()["status"]=="STAGING_DATA"
    resp=c.post("/api/v1/admin/plans",json={"id":"test_plan","label":"Staging only","price_minor":150000,"cycle":"MONTH","max_messages":1000,"grace_days":0},headers=headers)
    assert resp.status_code==201,resp.text
    data=c.get("/api/v1/admin/plans").json()
    assert len(data["items"])==1
    assert data["items"][0]["id"]=="test_plan"
    assert data["items"][0]["price_minor"]==150000
    s.conn.close()

def test_store_owner_cannot_list_admin_plans(tmp_path):
    s,c,secret,uid=client_with_user(tmp_path,role="STORE_OWNER")
    login=c.post("/api/v1/auth/login",json={"email":"admin@example.test","password":PASS,"totp":totp(secret)})
    assert login.status_code==200
    assert c.get("/api/v1/admin/plans").status_code==403
    assert c.get("/api/v1/admin/audit").status_code==403
    s.conn.close()


def test_data_platform_status_requires_admin_session_and_stays_staging(monkeypatch,tmp_path):
    s,c,secret,uid=client_with_user(tmp_path,role="SUPER_ADMIN")
    monkeypatch.delenv("TIEN404_STAGING_DATA_PLATFORM_URL",raising=False)
    assert c.get("/api/v1/admin/integrations/data-platform").status_code==401
    assert c.post("/api/v1/auth/login",json={
        "email":"admin@example.test","password":PASS,"totp":totp(secret)
    }).status_code==200
    result=c.get("/api/v1/admin/integrations/data-platform")
    assert result.status_code==200
    assert result.json()["status"]=="UNKNOWN"
    assert result.json()["production_readiness"]=="NOT_APPROVED"
    s.conn.close()
    owner_dir=tmp_path / "owner-case"
    owner_dir.mkdir()
    s,c,secret,uid=client_with_user(owner_dir,role="STORE_OWNER")
    assert c.post("/api/v1/auth/login",json={
        "email":"admin@example.test","password":PASS,"totp":totp(secret)
    }).status_code==200
    assert c.get("/api/v1/admin/integrations/data-platform").status_code==403
    s.conn.close()


def test_admin_ui_scrubs_privileged_dom_on_logout_and_role_change():
    """Regression contract: no audit/tenant rows survive a session boundary.

    API authorization is separately covered by backend tests. This test guards
    against a UI-only privacy regression; full browser role-switch QA remains
    required before hosting the Super Admin.
    """
    script = (Path(__file__).resolve().parents[1] / "app/ui/admin.js").read_text()
    assert "function resetConsole()" in script
    for target in ('"tenants-body"', '"plans-body"', '"audit-body"'):
        assert target in script.split("function resetConsole(){", 1)[1].split("function showLogin", 1)[0]
    assert "state.epoch++;" in script.split("function showLogin", 1)[1].split("async function refreshTenants", 1)[0]
    for name in ("refreshTenants", "refreshPlans", "refreshAudit"):
        body = script.split(f"async function {name}()", 1)[1].split("async function ", 1)[0]
        assert "const epoch=state.epoch;" in body
        assert "if(epoch!==state.epoch||!state.me)return;" in body
        assert "if(epoch!==state.epoch)return;" in body
    assert 'document.querySelector(\'[data-tab="audit"]\').hidden=true;' in script
    logout = script.split('$(\"logout\").addEventListener', 1)[1]
    assert logout.index("showLogin();") < logout.index('await request("/api/v1/auth/logout"')
    assert 'resetConsole();\n  show("login-view",false)' in script

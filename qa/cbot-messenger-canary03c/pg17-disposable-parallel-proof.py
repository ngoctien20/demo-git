#!/usr/bin/env python3
"""Disposable PostgreSQL 17 acceptance — no Supabase, n8n, Meta or credentials.

Every thread opens an INDEPENDENT psql session. This is a real DB unique-key
concurrency test, not an in-memory JS simulation. Does NOT test separate
production workers, a DB server crash, native Meta identity or provider Send.
"""
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor

APP, PAGE, RECIP, MARKER = "11", "22", "33", "44"
GRANTS = {
    "one": "00000000-0000-0000-0000-000000000001",
    "wrong": "00000000-0000-0000-0000-000000000002",
    "expired": "00000000-0000-0000-0000-000000000003",
    "revoked": "00000000-0000-0000-0000-000000000004",
}

def run_psql(sql, role=None, expect_error=False):
    prefix = "SET ROLE " + role + ";\n" if role else ""
    cmd = ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
           "-h", "127.0.0.1", "-U", "postgres", "-d", "canary_qa",
           "-c", prefix + sql]
    env = dict(os.environ)
    env["PGPASSWORD"] = "disposable_CI_only"
    out = subprocess.run(cmd, env=env, capture_output=True, text=True,
                         timeout=20, check=False)
    if expect_error:
        assert out.returncode != 0, "unsafe unauthorized SQL unexpectedly worked"
        return "DENIED"
    assert out.returncode == 0, "PSQL failed: " + out.stderr[:500]
    return out.stdout.strip().splitlines()[-1] if out.stdout.strip() else ""

def fn(grant, app=APP, page=PAGE, recipient=RECIP,
       marker=MARKER, event="55"):
    def h(x):
        assert len(x) == 2 and all(c in "0123456789abcdef" for c in x)
        return "decode(repeat('" + x + "',32),'hex')"
    assert grant in GRANTS.values()
    return ("SELECT count(*) FROM canary_disposable_qa.claim_once("
            + "'" + grant + "',"
            + ",".join(h(v) for v in (app,page,recipient,marker,event))
            + ");")

def seed():
    sql = """
    INSERT INTO canary_disposable_qa.grants
      (grant_id,app_fp,page_fp,recipient_fp,marker_fp,expires_at,grant_state)
    SELECT id,decode(repeat('11',32),'hex'),
      decode(repeat('22',32),'hex'),decode(repeat('33',32),'hex'),
      decode(repeat('44',32),'hex'),
      CASE WHEN id = '00000000-0000-0000-0000-000000000003'::uuid
      THEN now() - interval '1 minute'
      ELSE now()+interval '20 minutes' END,
      CASE WHEN id='00000000-0000-0000-0000-000000000004'::uuid
      THEN 'REVOKED' ELSE 'APPROVED' END
    FROM (VALUES
      ('00000000-0000-0000-0000-000000000001'::uuid),
      ('00000000-0000-0000-0000-000000000002'::uuid),
      ('00000000-0000-0000-0000-000000000003'::uuid),
      ('00000000-0000-0000-0000-000000000004'::uuid)
    ) x(id);
    """
    run_psql(sql)

def main():
    seed()
    target=GRANTS["one"]
    # 64 INDEPENDENT database connections, many truly overlapping, one grant.
    with ThreadPoolExecutor(max_workers=16) as executor:
        futures=[executor.submit(run_psql,fn(target,event=f"{i%255:02x}"),
                                 "canary_runtime_qa") for i in range(64)]
        results=[int(f.result()) for f in futures]
    assert sum(results)==1, ("concurrent split",sum(results))
    assert results.count(0)==63
    print("PASS 64 independent PostgreSQL connections -> 1 claim, 63 denied")
    assert run_psql(fn(target,event="aa"),"canary_runtime_qa") == "0"
    print("PASS different Meta MID cannot reuse a consumed grant")
    count=run_psql("SELECT count(*) FROM canary_disposable_qa.claims "
                   "WHERE grant_id='" + target + "'")
    assert count == "1"
    print("PASS grant survives reconnect in a new PostgreSQL session")
    assert run_psql(fn(GRANTS["wrong"],page="ff"),"canary_runtime_qa")=="0"
    assert run_psql(fn(GRANTS["wrong"],recipient="ff"),"canary_runtime_qa")=="0"
    assert run_psql(fn(GRANTS["wrong"],app="ff"),"canary_runtime_qa")=="0"
    assert run_psql(fn(GRANTS["wrong"],marker="ff"),"canary_runtime_qa")=="0"
    print("PASS wrong app/page/recipient/marker denied")
    assert run_psql(fn(GRANTS["expired"]),"canary_runtime_qa")=="0"
    assert run_psql(fn(GRANTS["revoked"]),"canary_runtime_qa")=="0"
    print("PASS expired and revoked grants denied")
    assert run_psql(fn(GRANTS["wrong"]),"canary_intruder_qa",
                    expect_error=True)=="DENIED"
    assert run_psql("SELECT * FROM canary_disposable_qa.grants",
                    "canary_intruder_qa",expect_error=True)=="DENIED"
    assert run_psql("UPDATE canary_disposable_qa.grants "
                    "SET grant_state='APPROVED'",
                    "canary_runtime_qa",expect_error=True)=="DENIED"
    assert run_psql("INSERT INTO canary_disposable_qa.grants(grant_id) "
                    "VALUES ('00000000-0000-0000-0000-000000000005')",
                    "canary_runtime_qa",expect_error=True)=="DENIED"
    print("PASS outsider cannot execute/read; runtime cannot mint or modify grants")
    assert run_psql(fn(GRANTS["wrong"]),"canary_runtime_qa") == "1"
    assert run_psql(fn(GRANTS["wrong"],event="bb"),"canary_runtime_qa")=="0"
    print("PASS CLAIMED with unknown send result must remain consumed; NO RETRY")
    # All real sends/Orders/model calls are structurally absent from this script.
    print("RESULT: PG17_DISPOSABLE_AT_MOST_ONE_CLAIM_PASS; "
          "provider_messages_sent=0; orders_written=0; "
          "supabase_staging_changed=false; "
          "real_page_psid_verified=false; "
          "production_backend_certified=false")

if __name__=="__main__":
    main()

"""Hosted read-only acceptance against the existing two staging Owners."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "notification"))
from staging_conflict import request, SHOPS

shops = {"A": "qa-staging-shop-a-20261110", "B": "qa-staging-shop-b-20261110"}
endpoint = "/functions/v1/tien404-r1-owner-preflight"


def check(label, actual, expected):
    print(f"{label} expected={expected} actual={actual}", flush=True)
    if actual != expected:
        raise RuntimeError(label)


def run():
    check("invalid JWT", request("POST", endpoint, "invalid.test.token",
          {"shop_slug": shops["A"]})[0], 401)
    for label, own in shops.items():
        status, login = request("POST", "/auth/v1/token?grant_type=password", body={
            "email": os.environ[f"TIEN404_QA_{label}_EMAIL"],
            "password": os.environ[f"TIEN404_QA_{label}_PASSWORD"],
        })
        check(f"login {label}", status, 200)
        token = login["access_token"]
        try:
            for target, slug in shops.items():
                status, result = request("POST", endpoint, token, {"shop_slug": slug})
                check(f"Owner {label} shop {target}", status, 200 if own == slug else 403)
                if own == slug:
                    check("verified", result.get("owner_verified"), True)
                    check("scope", result.get("shop_slug"), own)
                    for key in ("real_order_writes", "sandbox_order_writes", "outbound_messaging"):
                        check(key, result.get(key) is False, True)
                else:
                    check("denial reason", result.get("error"), "OWNER_NOT_AUTHORIZED")
            rpc = "/rest/v1/rpc/qa_owner_pairing"
            own_shop = {"p_shop": SHOPS[label], "p_action": "issue"}
            other = next(value for key, value in SHOPS.items() if key != label)
            check("cross-shop issue", request("POST", rpc, token, {**own_shop, "p_shop": other})[0], 403)
            status, issued = request("POST", rpc, token, own_shop)
            check("own-shop issue", status, 200)
            check("one-time code format", len(issued.get("code", "")) == 32, True)
            poll = {**own_shop, "p_action":"status", "p_challenge":issued["challengeId"]}
            status, pending = request("POST", rpc, token, poll)
            check("own status", status, 200)
            check("awaiting verified bot", pending.get("state"), "WAITING_FOR_BOT")
            check("code hidden on read", "code" in pending, False)
            check("premature confirm", request("POST", rpc, token, {**poll,"p_action":"confirm"})[0], 409)
            check("cross-shop status", request("POST", rpc, token, {**poll,"p_shop":other})[0], 403)
            check("cross-shop confirm", request("POST", rpc, token, {**poll,"p_shop":other,"p_action":"confirm"})[0], 403)
        finally:
            status, _ = request("POST", "/auth/v1/logout?scope=local", token)
            check(f"logout {label}", status in (200, 204), True)


if __name__ == "__main__":
    run()

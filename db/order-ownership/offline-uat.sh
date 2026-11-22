#!/usr/bin/env bash
# B-P1-05 OFFLINE UAT — Order Ownership Gateway DRAFT on the staging-equivalent stack.
# LOCAL/DISPOSABLE PostgreSQL only (vault is a local stub). NOT hosted acceptance.
PGDATABASE=t404_wsa_order_gateway; source "$(dirname "$0")/../ws-a/lib.sh"
OG="$ROOT/db/order-ownership"
TA=9c8c524c-88db-4771-8ab0-a4316298494c; TB=4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5
CA=f0000000-0000-4000-8000-0000000000a1; CN=f0000000-0000-4000-8000-0000000000a9; CB=f0000000-0000-4000-8000-0000000000b1
OA1=d1000000-0000-4000-8000-0000000000a1; OA2=d1000000-0000-4000-8000-0000000000a2; ON1=d1000000-0000-4000-8000-0000000000a9; OB1=d1000000-0000-4000-8000-0000000000b1
RA='messenger:PAGE_A_1:psid-customer-a'; RB='messenger:PAGE_A_1:psid-attacker-b'
n(){ echo "nonce-$(cat /proc/sys/kernel/random/uuid)"; }
svc(){ as service "$1"; }
j(){ admin "SELECT '$(printf "%s" "$1" | sed "s/'/''/g")'::jsonb->>'$2'"; }

build_stack
SA=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default"); SB=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TB' AND is_default")
admin "CREATE SCHEMA vault; CREATE TABLE vault.decrypted_secrets(name text PRIMARY KEY, decrypted_secret text);
 INSERT INTO public.customers(id,tenant_id,store_id,display_name,phone) VALUES
  ('$CA','$TA','$SA','Khách A','0912000001'),('$CN','$TA','$SA','Khách không SĐT',NULL),('$CB','$TB','$SB','Khách B','0912000002');
 INSERT INTO public.orders(id,tenant_id,store_id,customer_id,total_vnd) VALUES
  ('$OA1','$TA','$SA','$CA',159000),('$OA2','$TA','$SA','$CA',99000),('$ON1','$TA','$SA','$CN',1000),('$OB1','$TB','$SB','$CB',189000);" >/dev/null

runfile "$OG/10_order_ownership_gateway.DRAFT.sql" T404_OG_DRAFT_OK
deny NOT_REAPPLIABLE T404_OG_ALREADY_APPLIED "${PSQL[@]}" -d "$PGDATABASE" -f "$OG/10_order_ownership_gateway.DRAFT.sql"

# --- who may call
for f in "public.order_ownership_request_otp('$SA','$OA1','$RA','$(n)')" "public.order_ownership_verify_otp(gen_random_uuid(),'123456','$RA','$(n)')" \
         "public.order_ownership_check(gen_random_uuid(),'$OA1','$RA')" "public.order_ownership_revoke(gen_random_uuid())"; do
  t=$(echo "$f" | sed -E 's/public\.order_ownership_([a-z_]+).*/\1/' | tr a-z A-Z)
  deny ANON_$t 'permission denied' as anon "SELECT $f"
  deny AUTH_$t 'permission denied' as a0000000-0000-4000-8000-00000000000a "SELECT $f"
done
deny SERVICE_READS_TABLE_DIRECTLY 'permission denied' svc "SELECT count(*) FROM app_private.order_ownership_challenges"
deny SERVICE_CALLS_HELPER 'permission denied' svc "SELECT app_private.t404_og_pepper()"

# --- pepper is mandatory
deny NO_PEPPER pepper_missing svc "SELECT public.order_ownership_request_otp('$SA','$OA1','$RA','$(n)')"
admin "INSERT INTO vault.decrypted_secrets VALUES ('t404_order_gateway_pepper','$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')')" >/dev/null

# --- knowing the order id is not enough; no enumeration
R=$(svc "SELECT public.order_ownership_request_otp('$SB','$OA1','$RB','$(n)')")
ok "$(j "$R" code)" "" FOREIGN_STORE_ORDER_GETS_NO_CODE
R0=$(svc "SELECT public.order_ownership_request_otp('$SA',gen_random_uuid(),'$RB','$(n)')")
ok "$(j "$R0" code)" "" UNKNOWN_ORDER_GETS_NO_CODE
RN=$(svc "SELECT public.order_ownership_request_otp('$SA','$ON1','$RA','$(n)')")
ok "$(j "$RN" code)" "" ORDER_WITHOUT_CONTACT_GETS_NO_CODE
RR=$(svc "SELECT public.order_ownership_request_otp('$SA','$OA1','$RB','$(n)')")
ok "$(admin "SELECT (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys('$R0'::jsonb) k)=(SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys('$(printf "%s" "$RR" | sed "s/'/''/g")'::jsonb) k)")" t SAME_RESPONSE_SHAPE_REAL_VS_NOOP
ok "$(admin "SELECT '$(printf "%s" "$RR" | sed "s/'/''/g")'::jsonb->'deliver_to'->>'phone'")" 0912000001 CODE_GOES_TO_PHONE_ON_FILE_NOT_TO_REQUESTER
# attacker B asked for a code on A's order: the code went to A's phone; B guesses
CB_ID=$(j "$RR" challenge_id)
for i in 1 2 3 4; do V=$(svc "SELECT public.order_ownership_verify_otp('$CB_ID','00000$i','$RB','$(n)')"); done
ok "$(j "$V" reason)" wrong_code FOUR_WRONG_GUESSES_STILL_WRONG_CODE
V=$(svc "SELECT public.order_ownership_verify_otp('$CB_ID','000005','$RB','$(n)')"); ok "$(j "$V" reason)" locked FIFTH_WRONG_GUESS_LOCKS
REAL_B=$(j "$RR" code)
deny LOCKED_EVEN_WITH_RIGHT_CODE challenge_invalid svc "SELECT public.order_ownership_verify_otp('$CB_ID','$REAL_B','$RB','$(n)')"
ok "$(admin "SELECT count(*) FROM app_private.order_access_grants")" 0 NO_GRANT_AFTER_BRUTE_FORCE

# --- legit owner flow
RA1=$(svc "SELECT public.order_ownership_request_otp('$SA','$OA1','$RA','$(n)')"); CH=$(j "$RA1" challenge_id); CODE=$(j "$RA1" code)
ok "$(echo "$CODE" | grep -Ec '^[0-9]{6}$')" 1 CODE_IS_6_DIGITS
ok "$(admin "SELECT count(*) FROM app_private.order_ownership_challenges WHERE code_digest IN (encode(sha256('$CODE'),'hex'), encode(sha256(convert_to('$CH:$CODE','UTF8')),'hex'))")" 0 CODE_NOT_STORED_UNPEPPERED
ok "$(admin "SELECT expires_at <= created_at + interval '5 minutes' FROM app_private.order_ownership_challenges WHERE id='$CH'")" t CHALLENGE_TTL_5_MIN
deny OTHER_REQUESTER_RIGHT_CODE challenge_invalid svc "SELECT public.order_ownership_verify_otp('$CH','$CODE','$RB','$(n)')"
NV=$(n)
V=$(svc "SELECT public.order_ownership_verify_otp('$CH','$CODE','$RA','$NV')"); ok "$(j "$V" ok)" true OWNER_VERIFIES
G=$(j "$V" grant_id)
deny REPLAY_SAME_NONCE replay_detected svc "SELECT public.order_ownership_verify_otp('$CH','$CODE','$RA','$NV')"
deny REUSE_CONSUMED_CODE challenge_used svc "SELECT public.order_ownership_verify_otp('$CH','$CODE','$RA','$(n)')"
ok "$(svc "SELECT public.order_ownership_check('$G','$OA1','$RA')")" t GRANT_VALID_FOR_OWNER_AND_ORDER
ok "$(svc "SELECT public.order_ownership_check('$G','$OA1','$RB')")" f GRANT_USELESS_FOR_OTHER_REQUESTER
ok "$(svc "SELECT public.order_ownership_check('$G','$OA2','$RA')")" f GRANT_DOES_NOT_COVER_OTHER_ORDER
ok "$(svc "SELECT public.order_ownership_check(gen_random_uuid(),'$OA1','$RA')")" f RANDOM_GRANT_FALSE
admin "UPDATE app_private.order_access_grants SET created_at=created_at-interval '1 hour', expires_at=created_at-interval '59 minutes' WHERE id='$G'" >/dev/null
ok "$(svc "SELECT public.order_ownership_check('$G','$OA1','$RA')")" f EXPIRED_GRANT_FALSE
# expired challenge
RA2=$(svc "SELECT public.order_ownership_request_otp('$SA','$OA2','$RA','$(n)')")
admin "UPDATE app_private.order_ownership_challenges SET created_at=created_at-interval '1 hour', expires_at=expires_at-interval '1 hour' WHERE id='$(j "$RA2" challenge_id)'" >/dev/null
deny EXPIRED_CHALLENGE challenge_invalid svc "SELECT public.order_ownership_verify_otp('$(j "$RA2" challenge_id)','$(j "$RA2" code)','$RA','$(n)')"
# revoke
RA3=$(svc "SELECT public.order_ownership_request_otp('$SA','$OA2','$RA','$(n)')")
G3=$(j "$(svc "SELECT public.order_ownership_verify_otp('$(j "$RA3" challenge_id)','$(j "$RA3" code)','$RA','$(n)')")" grant_id)
ok "$(svc "SELECT public.order_ownership_revoke('$G3')")" t REVOKE_OK
ok "$(svc "SELECT public.order_ownership_check('$G3','$OA2','$RA')")" f REVOKED_GRANT_FALSE
# a new code supersedes the old pending one
RA4=$(svc "SELECT public.order_ownership_request_otp('$SB','$OB1','messenger:PAGE_B_1:psid-b','$(n)')")
RA5=$(svc "SELECT public.order_ownership_request_otp('$SB','$OB1','messenger:PAGE_B_1:psid-b','$(n)')")
deny SUPERSEDED_CODE challenge_invalid svc "SELECT public.order_ownership_verify_otp('$(j "$RA4" challenge_id)','$(j "$RA4" code)','messenger:PAGE_B_1:psid-b','$(n)')"
# rate limits (3 per order per hour: RA4, RA5 + one more are allowed, the 4th is refused)
svc "SELECT public.order_ownership_request_otp('$SB','$OB1','messenger:PAGE_B_1:psid-b3','$(n)')" >/dev/null
deny ORDER_RATE_LIMIT rate_limited svc "SELECT public.order_ownership_request_otp('$SB','$OB1','messenger:PAGE_B_1:psid-b2','$(n)')"
for i in 1 2; do svc "SELECT public.order_ownership_request_otp('$SA',gen_random_uuid(),'messenger:PAGE_A_1:psid-spam','$(n)')" >/dev/null; done
admin "INSERT INTO app_private.order_ownership_challenges(tenant_id,store_id,order_id,customer_id,requester_digest,code_digest,expires_at)
  SELECT '$TA','$SA','$OA2','$CA',app_private.t404_og_sha('requester:messenger:PAGE_A_1:psid-spam'),repeat('0',64),now()+interval '5 minutes' FROM generate_series(1,5)" >/dev/null
deny REQUESTER_RATE_LIMIT rate_limited svc "SELECT public.order_ownership_request_otp('$SA','$OA1','messenger:PAGE_A_1:psid-spam','$(n)')"
# input validation
deny BAD_REQUESTER invalid_requester svc "SELECT public.order_ownership_request_otp('$SA','$OA1','0912000001','$(n)')"
deny SHORT_NONCE invalid_nonce svc "SELECT public.order_ownership_request_otp('$SA','$OA1','$RA','abc')"
ok "$(admin "SELECT count(*) FROM information_schema.columns WHERE table_schema='app_private' AND table_name LIKE 'order_%' AND column_name IN ('code','otp','phone')")" 0 NO_PLAINTEXT_CODE_OR_PHONE_COLUMNS
ok "$(admin "SELECT count(*) FROM app_private.audit_events WHERE event_type LIKE 'order_otp_%'")" "$(admin "SELECT count(*) FROM app_private.audit_events WHERE event_type IN ('order_otp_issued','order_otp_failed','order_otp_verified','order_otp_request_noop')")" AUDIT_EVENTS_WRITTEN

# --- rollback + re-apply
runfile "$OG/90_order_ownership_gateway_rollback.DRAFT.sql" T404_OG_ROLLBACK_OK
ok "$(admin "SELECT count(*) FROM public.orders")" 6 ORDERS_UNTOUCHED_BY_ROLLBACK
runfile "$OG/10_order_ownership_gateway.DRAFT.sql" T404_OG_DRAFT_OK
echo "WSA_ORDER_GATEWAY_PASS=$PASS"

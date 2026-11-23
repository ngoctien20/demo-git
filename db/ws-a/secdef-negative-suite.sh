#!/usr/bin/env bash
# B-P0-06 — Negative (attack) suite for every SECURITY DEFINER RPC that an API role can EXECUTE on
# staging (17 for authenticated + anon ones), on the staging-equivalent stack built from repo SQL.
# LOCAL/DISPOSABLE PostgreSQL only; simulated Supabase roles + JWT claims; NOT hosted acceptance.
# Attack classes: anon, missing sub, no membership, cross-tenant (B -> A), cross-store inside one
# tenant, role escalation (staff/manager -> owner powers), deactivated membership, non-allow-listed
# tenant, self-serve tenant -> other tenant, id-smuggling (own store id + foreign row id), RLS reads.
# Every denial phase is wrapped by a full data checksum: denied calls must leave zero side effects.
PGDATABASE=t404_wsa_negative; source "$(dirname "$0")/lib.sh"

TA=9c8c524c-88db-4771-8ab0-a4316298494c; TB=4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5; TC=7c7c7c7c-0000-4000-8000-00000000000c
OA=a0000000-0000-4000-8000-00000000000a; OB=b0000000-0000-4000-8000-00000000000b
MA=a0000000-0000-4000-8000-0000000000a2; STA=a0000000-0000-4000-8000-0000000000a3; MX=a0000000-0000-4000-8000-0000000000a4
OC=c0000000-0000-4000-8000-00000000000c; NOM=e0000000-0000-4000-8000-0000000000e0
U1=d0000000-0000-4000-8000-0000000000e1; U2=d0000000-0000-4000-8000-0000000000e2; UN=d0000000-0000-4000-8000-0000000000e9
CUA=f0000000-0000-4000-8000-0000000000a1; CUB=f0000000-0000-4000-8000-0000000000b1
PA=c0000000-0000-4000-8000-0000000000a1; PB=c0000000-0000-4000-8000-0000000000b1

build_stack
# Mutation self-test (proves the suite is not vacuous): WSA_MUTATE=<name> weakens one guard on purpose,
# and the run MUST then fail. Used only by mutation-selftest.sh.
case "${WSA_MUTATE:-}" in
 '') ;;
 store_manager_any_member) admin "CREATE OR REPLACE FUNCTION app_private.t404_store_manager_tenant(p_store uuid) RETURNS uuid
   LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS \$m\$ SELECT tenant_id FROM public.stores WHERE id=p_store \$m\$" >/dev/null;;
 faq_no_store_filter) admin "$(sed -n '/CREATE FUNCTION public.save_store_faq/,/^END \$f\$;/p' "$(src db/v23-web/30_store_bot_settings.sql)" \
   | sed 's/CREATE FUNCTION/CREATE OR REPLACE FUNCTION/; s/WHERE id=p_id AND tenant_id=tid AND store_id=p_store/WHERE id=p_id/')" >/dev/null;;
 anon_grant_leak) admin "GRANT EXECUTE ON FUNCTION public.set_product_stock(uuid,uuid,integer,timestamptz) TO anon" >/dev/null;;
 *) echo "unknown WSA_MUTATE"; exit 2;;
esac
# ---------------- fixtures (admin = migration owner, not an API role) ----------------
admin "INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
  ('$MA','manager-a@qa.invalid',now()),('$STA','staff-a@qa.invalid',now()),('$MX','ex-manager-a@qa.invalid',now()),
  ('$OC','owner-c@qa.invalid',now()),('$NOM','nobody@qa.invalid',now()),
  ('$U1','u1@qa.invalid',now()),('$U2','u2@qa.invalid',now()),('$UN','unconfirmed@qa.invalid',NULL);
 INSERT INTO public.tenants(id,slug,name) VALUES ('$TC','not-allowlisted-shop-c','Shop C (not allow-listed)');
 INSERT INTO public.tenant_memberships(tenant_id,user_id,role,active) VALUES
  ('$TA','$MA','manager',true),('$TA','$STA','staff',true),('$TA','$MX','manager',false),('$TC','$OC','owner',true);
 INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role)
  SELECT tenant_id,id,'$OA'::uuid,'owner' FROM public.stores WHERE tenant_id='$TA' AND is_default
   AND NOT EXISTS (SELECT 1 FROM public.store_memberships x WHERE x.user_id='$OA' AND x.store_id=stores.id) UNION ALL
  SELECT tenant_id,id,'$OB'::uuid,'owner' FROM public.stores WHERE tenant_id='$TB' AND is_default
   AND NOT EXISTS (SELECT 1 FROM public.store_memberships x WHERE x.user_id='$OB' AND x.store_id=stores.id) UNION ALL
  SELECT tenant_id,id,'$MA','manager' FROM public.stores WHERE tenant_id='$TA' AND is_default UNION ALL
  SELECT tenant_id,id,'$STA','staff' FROM public.stores WHERE tenant_id='$TA' AND is_default UNION ALL
  SELECT tenant_id,id,'$MX','manager' FROM public.stores WHERE tenant_id='$TA' AND is_default UNION ALL
  SELECT tenant_id,id,'$OC','owner' FROM public.stores WHERE tenant_id='$TC' AND is_default;" >/dev/null
SA=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default")
SB=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TB' AND is_default")
SC=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TC' AND is_default")
admin "INSERT INTO public.customers(id,tenant_id,store_id,display_name,phone) VALUES
  ('$CUA','$TA','$SA','Khách A','0912000001'),('$CUB','$TB','$SB','Khách B','0912000002')" >/dev/null

# Legit setup through the RPCs themselves (proves the happy path still works for the real owner).
SA2=$(as $OA "SELECT public.create_store('$TA','chi-nhanh-2','Chi nhánh 2')"); ok "$([ -n "$SA2" ] && echo y)" y OWNER_A_CREATES_SECOND_STORE
FAQA=$(as $OA "SELECT public.save_store_faq('$SA',NULL,'Giờ mở cửa?','8h-22h',true)")
FAQB=$(as $OB "SELECT public.save_store_faq('$SB',NULL,'Ship không?','Có ship',true)")
as $OA "SELECT public.save_store_bot_settings('$SA','Shop A','',  'polite',true,'{}',NULL)" >/dev/null
AIDA=$(as $OA "SELECT public.create_assistant('$SA','Trợ lý A','shop')")
AIDB=$(as $OB "SELECT public.create_assistant('$SB','Trợ lý B','shop')")
SHA_A=$(admin "SELECT config_sha256 FROM public.assistant_config_versions WHERE assistant_id='$AIDA' AND state='draft'")
ok "$(as $OA "SELECT public.publish_assistant_config('$AIDA','$SHA_A')")" 1 OWNER_A_PUBLISHES_V1
admin "INSERT INTO public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status)
  VALUES ('$TA','$SA','$AIDA','messenger','PAGE_A_1','staging','active'),('$TB','$SB','$AIDB','messenger','PAGE_B_1','staging','active')" >/dev/null
UPA=$(admin "SELECT updated_at FROM public.products WHERE id='$PA'")

snapshot(){ admin "SELECT md5(string_agg(x,'|' ORDER BY x)) FROM (
  SELECT 't:'||t::text x FROM public.tenants t UNION ALL SELECT 'tm:'||m::text FROM public.tenant_memberships m UNION ALL
  SELECT 's:'||s::text FROM public.stores s UNION ALL SELECT 'sm:'||m::text FROM public.store_memberships m UNION ALL
  SELECT 'p:'||p::text FROM public.products p UNION ALL SELECT 'c:'||c::text FROM public.customers c UNION ALL
  SELECT 'f:'||f::text FROM public.store_faqs f UNION ALL SELECT 'b:'||b::text FROM public.store_bot_settings b UNION ALL
  SELECT 'a:'||a::text FROM public.assistants a UNION ALL SELECT 'v:'||v::text FROM public.assistant_config_versions v UNION ALL
  SELECT 'cc:'||c::text FROM public.channel_connections c UNION ALL SELECT 'st:'||s::text FROM app_private.self_serve_tenants s UNION ALL
  SELECT 'l:'||l::text FROM app_private.web_leads l) q"; }
AUDIT0=$(admin "SELECT count(*) FROM app_private.audit_events")
SNAP0=$(snapshot)

# ================= 0. surface: who can EXECUTE what =================
ok "$(admin "SELECT string_agg(p.proname,',' ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace IN ('public'::regnamespace,'app_private'::regnamespace) AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')")" \
  "get_channel_menu,submit_lead" ANON_SECDEF_SURFACE_IS_EXACTLY_MENU_AND_LEAD
ok "$(admin "SELECT count(*) FROM pg_proc p WHERE p.pronamespace IN ('public'::regnamespace,'app_private'::regnamespace) AND p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE')")" 16 AUTH_SECDEF_SURFACE_16_IN_REPO_PLUS_QA_OWNER_PAIRING_HOSTED
ok "$(admin "SELECT count(*) FROM pg_proc p WHERE p.pronamespace IN ('public'::regnamespace,'app_private'::regnamespace) AND p.prosecdef AND NOT coalesce(p.proconfig @> ARRAY['search_path=\"\"'],false)")" 0 EVERY_SECDEF_PINS_EMPTY_SEARCH_PATH
ok "$(admin "SELECT count(*) FROM pg_proc p WHERE p.pronamespace='app_private'::regnamespace AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))")" 0 NO_APP_PRIVATE_HELPER_CALLABLE_BY_API
ok "$(admin "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee IN ('anon','authenticated') AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE') AND table_schema IN ('public','app_private')")" 0 NO_DIRECT_TABLE_WRITE_GRANTS
ok "$(admin "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='anon' AND table_schema IN ('public','app_private')")" 0 ANON_HAS_NO_TABLE_GRANTS

# ================= 1. anon + missing sub =================
for f in "public.create_store('$TA','x1','X')" "public.set_store_member('$SA','$OB','owner',true)" \
  "public.save_merchant_product('$TA','Z1','Z',1,true,1,NULL)" "public.save_merchant_product_in_store('$SA','Z1','Z',1,true,1,NULL)" \
  "public.save_store_bot_settings('$SA','x','','polite',true,'{}',NULL)" "public.save_store_faq('$SA',NULL,'abc','d',true)" \
  "public.delete_store_faq('$SA','$FAQA')" "public.set_customer_stage('$SA','$CUA','hot',NULL,NULL)" \
  "public.set_product_stock('$SA','$PA',99,'$UPA')" "public.register_shop('Shop X','fashion')" \
  "public.create_assistant('$SA','x','shop')" "public.save_assistant_draft('$AIDA','{}',NULL)" \
  "public.publish_assistant_config('$AIDA','x')" "public.rollback_assistant_config('$AIDA',1)" \
  "public.resolve_channel_assistant('messenger','PAGE_A_1')"; do
  n=$(echo "$f" | sed -E 's/public\.([a-z_]+).*/\1/' | tr a-z A-Z)
  deny ANON_$n 'permission denied' as anon "SELECT $f"
done
for f in "public.create_store('$TA','x1','X')" "public.set_store_member('$SA','$OB','owner',true)" \
  "public.save_merchant_product_in_store('$SA','Z1','Z',1,true,1,NULL)" "public.save_store_faq('$SA',NULL,'abc','d',true)" \
  "public.set_product_stock('$SA','$PA',99,'$UPA')" "public.register_shop('Shop X','fashion')" "public.create_assistant('$SA','x','shop')"; do
  n=$(echo "$f" | sed -E 's/public\.([a-z_]+).*/\1/' | tr a-z A-Z)
  deny NOSUB_$n 'access_denied|permission denied' as nosub "SELECT $f"
done

# ================= 2. cross-tenant: owner B attacks tenant A =================
deny B_CREATE_STORE_IN_A        access_denied as $OB "SELECT public.create_store('$TA','b-trong-a','B in A')"
deny B_SET_MEMBER_IN_A          access_denied as $OB "SELECT public.set_store_member('$SA','$MA','staff',true)"
deny B_ADD_SELF_VIA_OTHER_OWNER 'access_denied|invalid_member' as $OB "SELECT public.set_store_member('$SA','$OB','owner',true)"
deny B_PRODUCT_V1_IN_A          access_denied as $OB "SELECT public.save_merchant_product('$TA','QA-A001','hijack',1,true,NULL,'$UPA')"
deny B_PRODUCT_IN_A_STORE       access_denied as $OB "SELECT public.save_merchant_product_in_store('$SA','B-NEW','x',1,true,1,NULL)"
deny B_BOT_SETTINGS_A           access_denied as $OB "SELECT public.save_store_bot_settings('$SA','hijack','','polite',false,'{}',NULL)"
deny B_FAQ_CREATE_IN_A          access_denied as $OB "SELECT public.save_store_faq('$SA',NULL,'hijack?','x',true)"
deny B_FAQ_EDIT_A_VIA_A_STORE   access_denied as $OB "SELECT public.save_store_faq('$SA','$FAQA','hijack?','x',true)"
deny B_FAQ_EDIT_A_VIA_OWN_STORE faq_not_found as $OB "SELECT public.save_store_faq('$SB','$FAQA','hijack?','x',true)"
deny B_FAQ_DELETE_A_VIA_A_STORE access_denied as $OB "SELECT public.delete_store_faq('$SA','$FAQA')"
deny B_FAQ_DELETE_A_VIA_OWN     faq_not_found as $OB "SELECT public.delete_store_faq('$SB','$FAQA')"
deny B_STAGE_A_CUSTOMER         access_denied as $OB "SELECT public.set_customer_stage('$SA','$CUA','lost',NULL,'x')"
deny B_STAGE_A_CUST_VIA_OWN     customer_not_found as $OB "SELECT public.set_customer_stage('$SB','$CUA','lost',NULL,'x')"
deny B_STOCK_A                  access_denied as $OB "SELECT public.set_product_stock('$SA','$PA',0,'$UPA')"
deny B_STOCK_A_VIA_OWN_STORE    product_changed_or_missing as $OB "SELECT public.set_product_stock('$SB','$PA',0,'$UPA')"
deny B_CREATE_ASSISTANT_IN_A    access_denied as $OB "SELECT public.create_assistant('$SA','x','shop')"
deny B_SAVE_DRAFT_A             access_denied as $OB "SELECT public.save_assistant_draft('$AIDA','{}',NULL)"
deny B_PUBLISH_A                access_denied as $OB "SELECT public.publish_assistant_config('$AIDA','$SHA_A')"
deny B_ROLLBACK_A               access_denied as $OB "SELECT public.rollback_assistant_config('$AIDA',1)"
deny B_RESOLVER                 'permission denied' as $OB "SELECT * FROM public.resolve_channel_assistant('messenger','PAGE_A_1')"

# ================= 3. escalation inside tenant A =================
deny STAFF_CREATE_STORE         access_denied as $STA "SELECT public.create_store('$TA','staff-store','x')"
deny MANAGER_CREATE_STORE       access_denied as $MA  "SELECT public.create_store('$TA','mgr-store','x')"
deny STAFF_PROMOTE_SELF         'access_denied|invalid_member' as $STA "SELECT public.set_store_member('$SA','$STA','owner',true)"
deny MANAGER_PROMOTE_SELF       'access_denied|invalid_member' as $MA "SELECT public.set_store_member('$SA','$MA','owner',true)"
deny MANAGER_PROMOTE_STAFF      access_denied as $MA "SELECT public.set_store_member('$SA','$STA','owner',true)"
deny MANAGER_DEMOTE_OWNER       access_denied as $MA "SELECT public.set_store_member('$SA','$OA','staff',false)"
deny OWNER_ADD_FOREIGN_USER     not_a_tenant_member as $OA "SELECT public.set_store_member('$SA','$OB','owner',true)"
deny OWNER_EDITS_OWN_ROW        invalid_member as $OA "SELECT public.set_store_member('$SA','$OA','staff',true)"
deny STAFF_PRODUCT              access_denied as $STA "SELECT public.save_merchant_product_in_store('$SA','S1','x',1,true,1,NULL)"
deny STAFF_PRODUCT_V1           access_denied as $STA "SELECT public.save_merchant_product('$TA','S1','x',1,true,1,NULL)"
deny STAFF_STOCK                access_denied as $STA "SELECT public.set_product_stock('$SA','$PA',0,'$UPA')"
deny STAFF_BOT_SETTINGS         access_denied as $STA "SELECT public.save_store_bot_settings('$SA','x','','polite',true,'{}',NULL)"
deny STAFF_FAQ                  access_denied as $STA "SELECT public.save_store_faq('$SA',NULL,'abc','d',true)"
deny STAFF_FAQ_DELETE           access_denied as $STA "SELECT public.delete_store_faq('$SA','$FAQA')"
deny STAFF_STAGE                access_denied as $STA "SELECT public.set_customer_stage('$SA','$CUA','hot',NULL,NULL)"
deny STAFF_ASSISTANT            access_denied as $STA "SELECT public.create_assistant('$SA','x','shop')"
deny STAFF_PUBLISH              access_denied as $STA "SELECT public.publish_assistant_config('$AIDA','$SHA_A')"
deny STAFF_ROLLBACK             access_denied as $STA "SELECT public.rollback_assistant_config('$AIDA',1)"
# cross-store inside tenant A: manager of the default store is not a member of store 2
deny MANAGER_WRITES_OTHER_STORE access_denied as $MA "SELECT public.save_merchant_product_in_store('$SA2','M2','x',1,true,1,NULL)"
deny MANAGER_FAQ_OTHER_STORE    access_denied as $MA "SELECT public.save_store_faq('$SA2',NULL,'abc','d',true)"
deny MANAGER_ASSIST_OTHER_STORE access_denied as $MA "SELECT public.create_assistant('$SA2','x','shop')"
deny MANAGER_STOCK_VIA_STORE2   access_denied as $MA "SELECT public.set_product_stock('$SA2','$PA',0,'$UPA')"
# deactivated tenant membership with a still-active store membership
deny EXMANAGER_PRODUCT          access_denied as $MX "SELECT public.save_merchant_product_in_store('$SA','X1','x',1,true,1,NULL)"
deny EXMANAGER_V1_PRODUCT       access_denied as $MX "SELECT public.save_merchant_product('$TA','X1','x',1,true,1,NULL)"
deny EXMANAGER_BOT              access_denied as $MX "SELECT public.save_store_bot_settings('$SA','x','','polite',true,'{}',NULL)"
deny EXMANAGER_ASSISTANT        access_denied as $MX "SELECT public.save_assistant_draft('$AIDA','{}',NULL)"
# user with no membership at all
deny NOMEMBER_STORE             access_denied as $NOM "SELECT public.create_store('$TA','n1','x')"
deny NOMEMBER_FAQ               access_denied as $NOM "SELECT public.save_store_faq('$SA',NULL,'abc','d',true)"
deny NOMEMBER_RANDOM_ASSISTANT  access_denied as $NOM "SELECT public.save_assistant_draft(gen_random_uuid(),'{}',NULL)"
deny NOMEMBER_RANDOM_STORE      access_denied as $NOM "SELECT public.save_store_faq(gen_random_uuid(),NULL,'abc','d',true)"
# owner of a tenant that is NOT on the allow-list (and not self-serve)
deny NOT_ALLOWLISTED_STORE      access_denied as $OC "SELECT public.create_store('$TC','c2','x')"
deny NOT_ALLOWLISTED_PRODUCT    access_denied as $OC "SELECT public.save_merchant_product_in_store('$SC','C1','x',1,true,1,NULL)"
deny NOT_ALLOWLISTED_BOT        access_denied as $OC "SELECT public.save_store_bot_settings('$SC','x','','polite',true,'{}',NULL)"
deny NOT_ALLOWLISTED_ASSISTANT  access_denied as $OC "SELECT public.create_assistant('$SC','x','shop')"
deny UNCONFIRMED_REGISTER       access_denied as $UN "SELECT public.register_shop('Shop X','fashion')"

ok "$(snapshot)" "$SNAP0" ZERO_SIDE_EFFECTS_AFTER_ALL_DENIALS
ok "$(admin "SELECT count(*) FROM app_private.audit_events")" "$AUDIT0" NO_AUDIT_ROWS_FROM_DENIED_CALLS

# ================= 4. self-serve tenants are isolated from each other =================
T1=$(as $U1 "SELECT public.register_shop('Shop U1','fashion')"); T2=$(as $U2 "SELECT public.register_shop('Shop U2','food')")
S1=$(admin "SELECT id FROM public.stores WHERE tenant_id='$T1' AND is_default"); S2=$(admin "SELECT id FROM public.stores WHERE tenant_id='$T2' AND is_default")
deny U1_SECOND_SHOP             shop_already_registered as $U1 "SELECT public.register_shop('Shop U1b','fashion')"
deny U1_STORE_IN_U2             access_denied as $U1 "SELECT public.create_store('$T2','u1-in-u2','x')"
deny U1_MEMBER_IN_U2            access_denied as $U1 "SELECT public.set_store_member('$S2','$U1','owner',true)"
deny U1_PRODUCT_IN_U2           access_denied as $U1 "SELECT public.save_merchant_product_in_store('$S2','U1','x',1,true,1,NULL)"
deny U1_BOT_U2                  access_denied as $U1 "SELECT public.save_store_bot_settings('$S2','x','','polite',true,'{}',NULL)"
deny U1_ASSISTANT_U2            access_denied as $U1 "SELECT public.create_assistant('$S2','x','shop')"
deny U1_INTO_QA_A               access_denied as $U1 "SELECT public.save_store_faq('$SA',NULL,'abc','d',true)"
deny U1_V1_WRITER_OWN_TENANT    access_denied as $U1 "SELECT public.save_merchant_product('$T1','U1','x',1,true,1,NULL)"
ok "$([ -n "$(as $U1 "SELECT public.save_store_faq('$S1',NULL,'Có ship?','Có',true)")" ] && echo y)" y U1_WRITES_OWN_STORE

# ================= 5. RLS reads: nobody reads another tenant's rows =================
for t in store_faqs store_bot_settings assistants assistant_config_versions channel_connections products customers stores store_memberships; do
  ok "$(as $OB "SELECT count(*) FROM public.$t WHERE tenant_id='$TA'")" 0 RLS_B_READS_NO_A_$(echo $t | tr a-z A-Z)
  ok "$(as $U1 "SELECT count(*) FROM public.$t WHERE tenant_id<>'$T1'")" 0 RLS_U1_READS_ONLY_OWN_$(echo $t | tr a-z A-Z)
done
ok "$(as $MA "SELECT count(*) FROM public.store_faqs WHERE store_id='$SA2'")" 0 RLS_MANAGER_NOT_IN_STORE2
deny AUTH_READ_LEADS 'permission denied' as $OA "SELECT count(*) FROM app_private.web_leads"
deny AUTH_READ_AUDIT 'permission denied' as $OA "SELECT count(*) FROM app_private.audit_events"

# ================= 6. anon public RPCs leak nothing internal =================
M=$(as anon "SELECT public.get_channel_menu('messenger','PAGE_A_1')")
ok "$(admin "SELECT ('$(printf "%s" "$M" | sed "s/'/''/g")'::jsonb ?| ARRAY['tenant_id','store_id','assistant_id','environment','external_account_id'])")" f MENU_HAS_NO_INTERNAL_IDS
ok "$(as anon "SELECT public.get_channel_menu('messenger','PAGE_B_1') IS NULL")" t MENU_NULL_WHEN_NOTHING_PUBLISHED
ok "$(as anon "SELECT public.get_channel_menu('sms','PAGE_A_1') IS NULL")" t MENU_UNKNOWN_CHANNEL_NULL
ok "$(as anon "SELECT public.get_channel_menu('messenger',repeat('A',200)) IS NULL")" t MENU_OVERLONG_ID_NULL
admin "UPDATE public.channel_connections SET status='disabled' WHERE external_account_id='PAGE_A_1'" >/dev/null
ok "$(as anon "SELECT public.get_channel_menu('messenger','PAGE_A_1') IS NULL")" t MENU_DISABLED_CONNECTION_NULL
admin "UPDATE public.channel_connections SET status='active' WHERE external_account_id='PAGE_A_1'" >/dev/null
ok "$(as anon "SELECT public.submit_lead('Lan','Shop Lan','0912345678',NULL,NULL,NULL,'Cần tư vấn AI',NULL)")" t ANON_LEAD_RETURNS_ONLY_BOOLEAN
deny ANON_LEAD_READBACK 'permission denied' as anon "SELECT count(*) FROM app_private.web_leads"

# ================= 7. legit owner paths still work after all of the above =================
ok "$([ -n "$(as $OA "SELECT public.set_product_stock('$SA','$PA',7,'$UPA')")" ] && echo y)" y OWNER_A_SETS_STOCK
ok "$(admin "SELECT stock_on_hand FROM public.products WHERE id='$PA'")" 7 STOCK_CHANGED_ONLY_BY_OWNER
as $OA "SELECT public.set_customer_stage('$SA','$CUA','hot',NULL,'gọi lại')" >/dev/null
ok "$(admin "SELECT stage FROM public.customers WHERE id='$CUB'")" new B_CUSTOMER_UNTOUCHED
ok "$(admin "SELECT count(*) FROM public.store_faqs WHERE id='$FAQB'")" 1 B_FAQ_UNTOUCHED

echo "STATIC_ONLY: public.qa_owner_pairing(uuid,text,uuid) — source not in repo (B-P0-08 gap); reviewed from hosted definition: requires auth.uid() to be an ACTIVE OWNER of p_shop and challenge.requester_user_id=auth.uid(); offline test BLOCKED until its migration is committed."
echo "WSA_SECDEF_NEGATIVE_PASS=$PASS"

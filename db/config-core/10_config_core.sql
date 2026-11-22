-- TIEN404 Universal Configuration Core v1 (Phase 1). STATUS: PROPOSED — NOT APPLIED ANYWHERE HOSTED.
-- Requires V20 Store Authority 10+20+30 (develop 868b932): stores, store_memberships,
-- app_private.t404_qa_tenant_allowed, app_private.audit_events. Independent of V23 (PR #487).
-- Written against the hosted staging catalog read on 2026-11-22 (read-only).
--
-- Adds (all Store-scoped; read = active Store member via RLS; write = owner/manager via RPC only):
--   public.action_types              Action Registry (global, read-only; status released/experimental)
--   public.industry_templates        Industry templates (global, read-only; versioned)
--   public.assistants                AI Assistants of a Store (Tenant -> Store -> Assistant)
--   public.assistant_config_versions Versioned config snapshots: one draft + one published per Assistant;
--                                    published rows are immutable; rollback = NEW published copy
--   public.channel_connections       Channel account -> exactly one tenant/store/assistant
--                                    (created by service_role/admin only; owners read)
--   RPCs  create_assistant, save_assistant_draft, publish_assistant_config, rollback_assistant_config
--   service_role only: resolve_channel_assistant(channel, external_account_id)
-- Nothing live reads these tables yet: applying this changes no bot behaviour.
-- Rollback: 90_config_core_rollback.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $pre$ BEGIN
 IF to_regclass('public.stores') IS NULL OR to_regclass('public.store_memberships') IS NULL THEN RAISE EXCEPTION 'T404_CC_PRECHECK_V20_MISSING'; END IF;
 IF to_regprocedure('app_private.t404_qa_tenant_allowed(uuid)') IS NULL THEN RAISE EXCEPTION 'T404_CC_PRECHECK_V20_30_MISSING'; END IF;
 IF to_regclass('app_private.audit_events') IS NULL THEN RAISE EXCEPTION 'T404_CC_PRECHECK_AUDIT_MISSING'; END IF;
 IF to_regclass('public.assistants') IS NOT NULL OR to_regclass('public.action_types') IS NOT NULL THEN RAISE EXCEPTION 'T404_CC_ALREADY_APPLIED'; END IF;
END $pre$;

-- 1. Action Registry ------------------------------------------------------------------------
CREATE TABLE public.action_types(
 action_type text PRIMARY KEY CHECK (action_type ~ '^[A-Z][A-Z_]{2,39}$'),
 status text NOT NULL CHECK (status IN ('released','experimental','retired')),
 title text NOT NULL,
 registry_version int NOT NULL DEFAULT 1
);
INSERT INTO public.action_types(action_type,status,title) VALUES
 ('SHOW_CATALOG','released','Hiển thị danh mục'),
 ('SHOW_CONTENT','released','Hiển thị nội dung'),
 ('SHOW_PROFILE','released','Giới thiệu cá nhân/tổ chức'),
 ('OPEN_LINK','released','Mở đường dẫn'),
 ('SHOW_PLAYLIST','released','Danh sách nhạc/video'),
 ('SEARCH_KNOWLEDGE','experimental','Tra cứu kiến thức'),
 ('ORDER_LOOKUP','released','Tra cứu đơn hàng'),
 ('HUMAN_HANDOFF','released','Chuyển nhân viên'),
 ('BOOKING_REQUEST','experimental','Tiếp nhận lịch hẹn'),
 ('CONTACT_INFO','released','Hiển thị liên hệ'),
 ('SHOW_SERVICES','released','Danh sách dịch vụ'),
 ('FAQ','released','Câu hỏi thường gặp');

-- 2. Validator (mirrors config-core/lib/action-registry.mjs; parity checked by QA) ----------
CREATE FUNCTION app_private.t404_cfg_str(v jsonb, mn int, mx int) RETURNS boolean
 LANGUAGE sql IMMUTABLE SET search_path='' AS $f$
 SELECT coalesce(jsonb_typeof(v)='string' AND char_length(btrim(v#>>'{}',E' \t\r\n'))>=mn AND char_length(v#>>'{}')<=mx,false) $f$;

CREATE FUNCTION app_private.t404_cfg_int(v jsonb, mn numeric, mx numeric) RETURNS boolean
 LANGUAGE sql IMMUTABLE SET search_path='' AS $f$
 SELECT coalesce(jsonb_typeof(v)='number' AND (v#>>'{}')::numeric=trunc((v#>>'{}')::numeric)
   AND (v#>>'{}')::numeric BETWEEN mn AND mx,false) $f$;

CREATE FUNCTION app_private.t404_cfg_url_error(v jsonb, hosts text[]) RETURNS text
 LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $f$
DECLARE raw text; m text[]; host text;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'string' THEN RETURN 'url_invalid'; END IF;
 raw := v#>>'{}';
 IF char_length(raw) > 500 THEN RETURN 'url_invalid'; END IF;
 IF raw ~* '^http://' THEN RETURN 'url_not_https'; END IF;
 m := regexp_match(raw, '^[hH][tT][tT][pP][sS]://([^/?#[:space:]\\]+)([/?#][^[:space:]\\]*)?$');
 IF m IS NULL OR m[1] ~ '[@:]' THEN RETURN 'url_invalid'; END IF;
 host := lower(m[1]);
 IF host !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' OR host ~ '^[0-9.]+$' THEN RETURN 'url_host_invalid'; END IF;
 IF host ~ '(^|\.)(localhost|local|internal|lan|home|corp)$' THEN RETURN 'url_host_invalid'; END IF;
 IF hosts IS NOT NULL AND NOT host = ANY(hosts) THEN RETURN 'url_host_not_allowed'; END IF;
 RETURN NULL;
END $f$;

CREATE FUNCTION app_private.t404_cfg_phone_ok(v jsonb) RETURNS boolean
 LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $f$
DECLARE d text;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
 d := regexp_replace(v#>>'{}', '[[:space:].()-]', '', 'g');
 IF d LIKE '+84%' THEN d := '0'||substr(d,4); ELSIF d LIKE '84%' AND char_length(d)=11 THEN d := '0'||substr(d,3); END IF;
 RETURN d ~ '^0[35789][0-9]{8}$' OR d ~ '^02[0-9]{9}$';
END $f$;

-- Returns 'path|code' errors (empty array = valid). p_mode: 'draft' | 'publish'.
CREATE FUNCTION app_private.t404_cfg_validate(cfg jsonb, p_mode text) RETURNS text[]
 LANGUAGE plpgsql STABLE SET search_path='' AS $f$
DECLARE
 errs text[] := '{}'; k text; it jsonb; i int := 0; p text; c jsonb; st text; ids text[] := '{}';
 ch text; o jsonb; cfg_err boolean; e text; s jsonb; n int;
 yt text[] := ARRAY['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be'];
 kinds jsonb := jsonb_build_object(
   'youtube', to_jsonb(ARRAY['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be']),
   'facebook', to_jsonb(ARRAY['facebook.com','www.facebook.com','m.facebook.com','fb.com','m.me']),
   'tiktok', to_jsonb(ARRAY['tiktok.com','www.tiktok.com','vt.tiktok.com']),
   'zalo', to_jsonb(ARRAY['zalo.me','oa.zalo.me']),
   'website', 'null'::jsonb);
 allowed_keys jsonb := '{"SHOW_CATALOG":["category"],"SHOW_CONTENT":["title","text"],"SHOW_PROFILE":[],"OPEN_LINK":["url","link_kind"],
   "SHOW_PLAYLIST":["url","title"],"SEARCH_KNOWLEDGE":[],"ORDER_LOOKUP":[],"HUMAN_HANDOFF":["team","ack_text"],
   "BOOKING_REQUEST":["note"],"CONTACT_INFO":["phone","email","address","hours"],"SHOW_SERVICES":["items"],"FAQ":["topic"]}'::jsonb;
 hosts text[];
BEGIN
 IF jsonb_typeof(cfg) IS DISTINCT FROM 'object' THEN RETURN ARRAY['$|config_not_object']; END IF;
 FOR k IN SELECT jsonb_object_keys(cfg) LOOP
  IF NOT k = ANY(ARRAY['schema_version','greeting','addressing','profile','menu']) THEN errs := errs || (k||'|unknown_key'); END IF;
 END LOOP;
 IF cfg->'schema_version' IS DISTINCT FROM '1'::jsonb THEN errs := errs || 'schema_version|schema_version_unsupported'::text; END IF;
 IF NOT app_private.t404_cfg_str(cfg->'greeting',1,640) THEN errs := errs || 'greeting|greeting_invalid'::text; END IF;
 IF cfg ? 'addressing' THEN
  IF jsonb_typeof(cfg->'addressing') <> 'object' THEN errs := errs || 'addressing|addressing_invalid'::text;
  ELSE
   FOR k IN SELECT jsonb_object_keys(cfg->'addressing') LOOP
    IF NOT k = ANY(ARRAY['self','customer']) THEN errs := errs || ('addressing.'||k||'|unknown_key'); END IF;
   END LOOP;
   FOREACH k IN ARRAY ARRAY['self','customer'] LOOP
    IF cfg->'addressing' ? k AND NOT app_private.t404_cfg_str(cfg->'addressing'->k,1,20) THEN errs := errs || ('addressing.'||k||'|addressing_invalid'); END IF;
   END LOOP;
  END IF;
 END IF;
 IF cfg ? 'profile' THEN
  IF jsonb_typeof(cfg->'profile') <> 'object' THEN errs := errs || 'profile|profile_invalid'::text;
  ELSE
   FOR k IN SELECT jsonb_object_keys(cfg->'profile') LOOP
    IF NOT k = ANY(ARRAY['display_name','bio']) THEN errs := errs || ('profile.'||k||'|unknown_key'); END IF;
   END LOOP;
   IF cfg->'profile' ? 'display_name' AND NOT app_private.t404_cfg_str(cfg->'profile'->'display_name',1,100) THEN errs := errs || 'profile.display_name|profile_invalid'::text; END IF;
   IF cfg->'profile' ? 'bio' AND NOT app_private.t404_cfg_str(cfg->'profile'->'bio',1,1000) THEN errs := errs || 'profile.bio|profile_invalid'::text; END IF;
  END IF;
 END IF;
 IF jsonb_typeof(cfg->'menu') IS DISTINCT FROM 'array' THEN RETURN errs || 'menu|menu_invalid'::text; END IF;
 IF jsonb_array_length(cfg->'menu') > 12 THEN errs := errs || 'menu|menu_too_long'::text; END IF;
 FOR it IN SELECT x FROM jsonb_array_elements(cfg->'menu') x LOOP
  p := 'menu['||i||']'; i := i+1;
  IF jsonb_typeof(it) <> 'object' THEN errs := errs || (p||'|item_invalid'); CONTINUE; END IF;
  FOR k IN SELECT jsonb_object_keys(it) LOOP
   IF NOT k = ANY(ARRAY['id','action_type','label','description','enabled','sort_order','action_config','channel_overrides']) THEN errs := errs || (p||'.'||k||'|unknown_key'); END IF;
  END LOOP;
  IF jsonb_typeof(it->'id') IS DISTINCT FROM 'string' OR (it->>'id') !~ '^[a-z][a-z0-9_]{1,31}$' THEN errs := errs || (p||'.id|item_id_invalid');
  ELSIF (it->>'id') = ANY(ids) THEN errs := errs || (p||'.id|item_id_duplicate');
  ELSE ids := ids || (it->>'id'); END IF;
  st := NULL;
  IF jsonb_typeof(it->'action_type') = 'string' THEN SELECT a.status INTO st FROM public.action_types a WHERE a.action_type = it->>'action_type'; END IF;
  IF st IS NULL OR NOT allowed_keys ? (it->>'action_type') THEN errs := errs || (p||'.action_type|action_type_unknown'); st := NULL;
  ELSIF p_mode='publish' AND st <> 'released' AND it->'enabled' IS DISTINCT FROM 'false'::jsonb THEN errs := errs || (p||'.action_type|action_not_released'); END IF;
  IF p_mode='publish' AND it->'enabled'='true'::jsonb AND jsonb_typeof(it->'action_config')='object'
     AND jsonb_typeof(it->'action_config'->'url')='string' AND position('THAY-LINK' IN it->'action_config'->>'url')>0 THEN
   errs := errs || (p||'.action_config.url|url_placeholder');
  END IF;
  IF NOT app_private.t404_cfg_str(it->'label',1,40) THEN errs := errs || (p||'.label|label_invalid'); END IF;
  IF it ? 'description' AND NOT app_private.t404_cfg_str(it->'description',1,120) THEN errs := errs || (p||'.description|description_invalid'); END IF;
  IF jsonb_typeof(it->'enabled') IS DISTINCT FROM 'boolean' THEN errs := errs || (p||'.enabled|enabled_invalid'); END IF;
  IF NOT app_private.t404_cfg_int(it->'sort_order',0,1000) THEN errs := errs || (p||'.sort_order|sort_order_invalid'); END IF;
  c := CASE WHEN it->'action_config' IS NULL OR jsonb_typeof(it->'action_config')='null' THEN '{}'::jsonb ELSE it->'action_config' END;
  IF jsonb_typeof(c) <> 'object' THEN errs := errs || (p||'.action_config|action_config_invalid');
  ELSIF st IS NOT NULL THEN
   n := cardinality(errs);
   FOR k IN SELECT jsonb_object_keys(c) LOOP
    IF NOT (allowed_keys->(it->>'action_type')) ? k THEN errs := errs || (p||'.action_config.'||k||'|unknown_key'); END IF;
   END LOOP;
   CASE it->>'action_type'
    WHEN 'SHOW_CATALOG' THEN
     IF c ? 'category' AND NOT app_private.t404_cfg_str(c->'category',1,40) THEN errs := errs || (p||'.action_config.category|config_value_invalid'); END IF;
    WHEN 'SHOW_CONTENT' THEN
     IF NOT c ? 'text' THEN errs := errs || (p||'.action_config.text|required'); END IF;
     IF c ? 'title' AND NOT app_private.t404_cfg_str(c->'title',1,80) THEN errs := errs || (p||'.action_config.title|config_value_invalid'); END IF;
     IF c ? 'text' AND NOT app_private.t404_cfg_str(c->'text',1,1000) THEN errs := errs || (p||'.action_config.text|content_text_required'); END IF;
    WHEN 'OPEN_LINK' THEN
     IF NOT c ? 'url' THEN errs := errs || (p||'.action_config.url|required'); END IF;
     IF c ? 'link_kind' AND (jsonb_typeof(c->'link_kind') <> 'string' OR NOT kinds ? (c->>'link_kind')) THEN errs := errs || (p||'.action_config.link_kind|link_kind_invalid'); END IF;
    WHEN 'SHOW_PLAYLIST' THEN
     IF NOT c ? 'url' THEN errs := errs || (p||'.action_config.url|required'); END IF;
     IF c ? 'title' AND NOT app_private.t404_cfg_str(c->'title',1,80) THEN errs := errs || (p||'.action_config.title|config_value_invalid'); END IF;
    WHEN 'HUMAN_HANDOFF' THEN
     IF NOT c ? 'team' THEN errs := errs || (p||'.action_config.team|required'); END IF;
     IF c ? 'team' AND (jsonb_typeof(c->'team') <> 'string' OR NOT (c->>'team') = ANY(ARRAY['sales','page_admin','booking','consultant','support','manager'])) THEN
      errs := errs || (p||'.action_config.team|handoff_team_invalid'); END IF;
     IF c ? 'ack_text' AND NOT app_private.t404_cfg_str(c->'ack_text',1,300) THEN errs := errs || (p||'.action_config.ack_text|config_value_invalid'); END IF;
    WHEN 'BOOKING_REQUEST' THEN
     IF c ? 'note' AND NOT app_private.t404_cfg_str(c->'note',1,200) THEN errs := errs || (p||'.action_config.note|config_value_invalid'); END IF;
    WHEN 'CONTACT_INFO' THEN
     IF c ? 'phone' AND NOT app_private.t404_cfg_phone_ok(c->'phone') THEN errs := errs || (p||'.action_config.phone|phone_invalid'); END IF;
     IF c ? 'email' AND NOT (jsonb_typeof(c->'email')='string' AND char_length(c->>'email')<=200
        AND (c->>'email') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN errs := errs || (p||'.action_config.email|email_invalid'); END IF;
     IF c ? 'address' AND NOT app_private.t404_cfg_str(c->'address',1,200) THEN errs := errs || (p||'.action_config.address|config_value_invalid'); END IF;
     IF c ? 'hours' AND NOT app_private.t404_cfg_str(c->'hours',1,120) THEN errs := errs || (p||'.action_config.hours|config_value_invalid'); END IF;
    WHEN 'SHOW_SERVICES' THEN
     IF c ? 'items' THEN
      cfg_err := jsonb_typeof(c->'items') <> 'array' OR jsonb_array_length(c->'items') > 20;
      IF NOT cfg_err THEN
       FOR s IN SELECT y FROM jsonb_array_elements(c->'items') y LOOP
        IF jsonb_typeof(s) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(s) kk WHERE NOT kk = ANY(ARRAY['name','price_vnd','note']))
           OR NOT app_private.t404_cfg_str(s->'name',1,80)
           OR (s ? 'price_vnd' AND jsonb_typeof(s->'price_vnd') <> 'null' AND NOT app_private.t404_cfg_int(s->'price_vnd',0,10000000000))
           OR (s ? 'note' AND NOT app_private.t404_cfg_str(s->'note',1,200)) THEN cfg_err := true; EXIT; END IF;
       END LOOP;
      END IF;
      IF cfg_err THEN errs := errs || (p||'.action_config.items|services_invalid'); END IF;
     END IF;
    WHEN 'FAQ' THEN
     IF c ? 'topic' AND NOT app_private.t404_cfg_str(c->'topic',1,60) THEN errs := errs || (p||'.action_config.topic|config_value_invalid'); END IF;
    ELSE NULL;
   END CASE;
   -- Whole-config checks only when the fields themselves are fine (same as JS `check`).
   IF cardinality(errs) = n THEN
    IF it->>'action_type' = 'OPEN_LINK' THEN
     hosts := CASE WHEN kinds->coalesce(c->>'link_kind','website') = 'null'::jsonb THEN NULL
                   ELSE ARRAY(SELECT jsonb_array_elements_text(kinds->(c->>'link_kind'))) END;
     e := app_private.t404_cfg_url_error(c->'url', hosts);
     IF e IS NOT NULL THEN errs := errs || (p||'.action_config|'||e); END IF;
    ELSIF it->>'action_type' = 'SHOW_PLAYLIST' THEN
     e := app_private.t404_cfg_url_error(c->'url', yt);
     IF e IS NOT NULL THEN errs := errs || (p||'.action_config|'||e); END IF;
    ELSIF it->>'action_type' = 'CONTACT_INFO' AND NOT (c ?| ARRAY['phone','email','address','hours']) THEN
     errs := errs || (p||'.action_config|contact_empty');
    END IF;
   END IF;
  END IF;
  IF it ? 'channel_overrides' THEN
   IF jsonb_typeof(it->'channel_overrides') <> 'object' THEN errs := errs || (p||'.channel_overrides|overrides_invalid');
   ELSE
    FOR ch, o IN SELECT key, value FROM jsonb_each(it->'channel_overrides') LOOP
     IF NOT ch = ANY(ARRAY['messenger','web','zalo_bot','zalo_oa','telegram']) THEN errs := errs || (p||'.channel_overrides.'||ch||'|channel_unknown'); CONTINUE; END IF;
     IF jsonb_typeof(o) <> 'object' THEN errs := errs || (p||'.channel_overrides.'||ch||'|overrides_invalid'); CONTINUE; END IF;
     FOR k IN SELECT jsonb_object_keys(o) LOOP
      IF NOT k = ANY(ARRAY['label','enabled']) THEN errs := errs || (p||'.channel_overrides.'||ch||'.'||k||'|unknown_key'); END IF;
     END LOOP;
     IF o ? 'label' AND NOT app_private.t404_cfg_str(o->'label',1,40) THEN errs := errs || (p||'.channel_overrides.'||ch||'.label|label_invalid'); END IF;
     IF o ? 'enabled' AND jsonb_typeof(o->'enabled') <> 'boolean' THEN errs := errs || (p||'.channel_overrides.'||ch||'.enabled|enabled_invalid'); END IF;
    END LOOP;
   END IF;
  END IF;
 END LOOP;
 IF p_mode='publish' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cfg->'menu') x WHERE jsonb_typeof(x)='object' AND x->'enabled'='true'::jsonb) THEN
  errs := errs || 'menu|menu_no_enabled_item'::text;
 END IF;
 RETURN errs;
END $f$;

-- 3. Industry templates ---------------------------------------------------------------------
CREATE TABLE public.industry_templates(
 template_key text NOT NULL CHECK (template_key ~ '^[a-z][a-z0-9_]{1,31}$'),
 version int NOT NULL CHECK (version >= 1),
 name text NOT NULL,
 industry text NOT NULL,
 config jsonb NOT NULL,
 status text NOT NULL DEFAULT 'released' CHECK (status IN ('released','retired')),
 PRIMARY KEY (template_key, version)
);
-- Validation is enforced by the RPCs (the only writers) and by QA for seeds. No CHECK that calls
-- t404_cfg_validate: it reads action_types, which pg_dump/restore does not order before this data.
-- BEGIN GENERATED TEMPLATE SEED (node config-core/build-seed.mjs)
INSERT INTO public.industry_templates(template_key,version,name,industry,config) VALUES
 ('shop',1,'Cửa hàng','retail','{"schema_version":1,"greeting":"Chào bạn! Mình là trợ lý của shop. Bạn muốn xem sản phẩm hay tra cứu đơn hàng?","addressing":{"self":"mình","customer":"bạn"},"menu":[{"enabled":true,"sort_order":10,"action_config":{},"id":"catalog","action_type":"SHOW_CATALOG","label":"Xem sản phẩm"},{"enabled":true,"sort_order":20,"action_config":{},"id":"order_lookup","action_type":"ORDER_LOOKUP","label":"Tra cứu đơn hàng"},{"enabled":false,"sort_order":30,"action_config":{"url":"https://example.com/THAY-LINK-WEBSITE","link_kind":"website"},"id":"website","action_type":"OPEN_LINK","label":"Xem website"},{"enabled":true,"sort_order":40,"action_config":{"team":"sales"},"id":"handoff","action_type":"HUMAN_HANDOFF","label":"Gặp nhân viên"}]}'::jsonb),
 ('artist',1,'Nghệ sĩ / Nhà sáng tạo','creator','{"schema_version":1,"greeting":"Chào bạn! Mình là trợ lý của trang. Bạn muốn nghe nhạc, xem thông tin hay liên hệ đội ngũ quản lý?","addressing":{"self":"mình","customer":"bạn"},"menu":[{"enabled":false,"sort_order":10,"action_config":{"url":"https://www.youtube.com/@THAY-LINK-PLAYLIST"},"id":"music","action_type":"SHOW_PLAYLIST","label":"Nghe nhạc"},{"enabled":true,"sort_order":20,"action_config":{},"id":"profile","action_type":"SHOW_PROFILE","label":"Thông tin nghệ sĩ"},{"enabled":false,"sort_order":30,"action_config":{"url":"https://www.youtube.com/@THAY-LINK-KENH","link_kind":"youtube"},"id":"youtube","action_type":"OPEN_LINK","label":"Kênh YouTube"},{"enabled":true,"sort_order":40,"action_config":{"team":"manager"},"id":"manager","action_type":"HUMAN_HANDOFF","label":"Liên hệ quản lý"}]}'::jsonb),
 ('service',1,'Dịch vụ','service','{"schema_version":1,"greeting":"Chào bạn! Mình có thể giới thiệu dịch vụ, bảng giá hoặc chuyển bạn tới chuyên viên tư vấn.","addressing":{"self":"mình","customer":"bạn"},"menu":[{"enabled":true,"sort_order":10,"action_config":{},"id":"services","action_type":"SHOW_SERVICES","label":"Xem dịch vụ"},{"enabled":true,"sort_order":20,"action_config":{},"id":"price_list","action_type":"SHOW_SERVICES","label":"Xem bảng giá"},{"enabled":false,"sort_order":30,"action_config":{},"id":"booking","action_type":"BOOKING_REQUEST","label":"Đặt lịch tư vấn"},{"enabled":true,"sort_order":40,"action_config":{"team":"consultant"},"id":"handoff","action_type":"HUMAN_HANDOFF","label":"Liên hệ nhân viên"}]}'::jsonb),
 ('education',1,'Nội dung / Giáo dục','education','{"schema_version":1,"greeting":"Chào bạn! Mình có thể giới thiệu khóa học, tài liệu và lịch hoạt động.","addressing":{"self":"mình","customer":"bạn"},"menu":[{"enabled":true,"sort_order":10,"action_config":{},"id":"courses","action_type":"SHOW_SERVICES","label":"Xem khóa học"},{"enabled":false,"sort_order":20,"action_config":{"url":"https://example.com/THAY-LINK-TAI-LIEU","link_kind":"website"},"id":"free_docs","action_type":"OPEN_LINK","label":"Tài liệu miễn phí"},{"enabled":true,"sort_order":30,"action_config":{"topic":"lịch hoạt động"},"id":"schedule","action_type":"FAQ","label":"Lịch hoạt động"},{"enabled":true,"sort_order":40,"action_config":{"team":"manager"},"id":"manager","action_type":"HUMAN_HANDOFF","label":"Liên hệ quản lý"}]}'::jsonb);
-- END GENERATED TEMPLATE SEED

-- 4. Assistants, config versions, channel connections ----------------------------------------
CREATE TABLE public.assistants(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
 template_key text,
 template_version int,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT assistants_scope_key UNIQUE (tenant_id, store_id, id),
 CONSTRAINT assistants_store_fk FOREIGN KEY (tenant_id, store_id) REFERENCES public.stores(tenant_id, id) ON DELETE RESTRICT,
 CONSTRAINT assistants_template_fk FOREIGN KEY (template_key, template_version) REFERENCES public.industry_templates(template_key, version)
);
CREATE INDEX assistants_store_idx ON public.assistants(tenant_id, store_id);

CREATE TABLE public.assistant_config_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 assistant_id uuid NOT NULL,
 version_no int NOT NULL CHECK (version_no >= 1),
 state text NOT NULL CHECK (state IN ('draft','published','superseded')),
 config jsonb NOT NULL,
 config_sha256 text NOT NULL,
 source text NOT NULL CHECK (char_length(source) <= 120),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,
 published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 CONSTRAINT acv_assistant_fk FOREIGN KEY (tenant_id, store_id, assistant_id) REFERENCES public.assistants(tenant_id, store_id, id) ON DELETE RESTRICT,
 CONSTRAINT acv_version_key UNIQUE (assistant_id, version_no),
 CONSTRAINT acv_published_meta CHECK ((state='draft') = (published_at IS NULL))
);
CREATE UNIQUE INDEX acv_one_draft ON public.assistant_config_versions(assistant_id) WHERE state='draft';
CREATE UNIQUE INDEX acv_one_published ON public.assistant_config_versions(assistant_id) WHERE state='published';

-- Published/superseded snapshots are immutable; the only allowed change is published -> superseded.
CREATE FUNCTION app_private.t404_acv_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.state <> 'draft' THEN RAISE EXCEPTION 'config_version_immutable' USING ERRCODE='42501'; END IF;
  RETURN OLD;
 END IF;
 IF (NEW.tenant_id, NEW.store_id, NEW.assistant_id, NEW.version_no, NEW.created_at) IS DISTINCT FROM
    (OLD.tenant_id, OLD.store_id, OLD.assistant_id, OLD.version_no, OLD.created_at) THEN
  RAISE EXCEPTION 'config_version_immutable' USING ERRCODE='42501';
 END IF;
 IF OLD.state = 'draft' THEN RETURN NEW; END IF;
 IF OLD.state = 'published' AND NEW.state = 'superseded' AND NEW.config = OLD.config AND NEW.config_sha256 = OLD.config_sha256
    AND NEW.published_at = OLD.published_at THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'config_version_immutable' USING ERRCODE='42501';
END $f$;
CREATE TRIGGER t404_acv_guard BEFORE UPDATE OR DELETE ON public.assistant_config_versions
 FOR EACH ROW EXECUTE FUNCTION app_private.t404_acv_guard();

CREATE TABLE public.channel_connections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 assistant_id uuid,
 channel text NOT NULL CHECK (channel IN ('messenger','web','zalo_bot','zalo_oa','telegram')),
 external_account_id text NOT NULL CHECK (external_account_id ~ '^[A-Za-z0-9_.:-]{1,128}$'),
 display_name text CHECK (display_name IS NULL OR char_length(display_name) <= 150),
 environment text NOT NULL CHECK (environment IN ('demo','staging','production')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','disabled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 -- One provider account belongs to exactly one tenant/store, whatever its status (no silent re-binding).
 CONSTRAINT channel_connections_account_key UNIQUE (channel, external_account_id),
 CONSTRAINT channel_connections_store_fk FOREIGN KEY (tenant_id, store_id) REFERENCES public.stores(tenant_id, id) ON DELETE RESTRICT,
 CONSTRAINT channel_connections_assistant_fk FOREIGN KEY (tenant_id, store_id, assistant_id) REFERENCES public.assistants(tenant_id, store_id, id) ON DELETE RESTRICT
);

-- 5. Grants + RLS: read for active Store members, no direct writes for clients ----------------
REVOKE ALL ON public.action_types, public.industry_templates, public.assistants,
  public.assistant_config_versions, public.channel_connections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.action_types, public.industry_templates, public.assistants,
  public.assistant_config_versions, public.channel_connections TO authenticated;
GRANT ALL ON public.action_types, public.industry_templates, public.assistants,
  public.assistant_config_versions, public.channel_connections TO service_role;
ALTER TABLE public.action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_types FORCE ROW LEVEL SECURITY;
ALTER TABLE public.industry_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industry_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY action_types_auth_read ON public.action_types FOR SELECT TO authenticated USING (true);
CREATE POLICY industry_templates_auth_read ON public.industry_templates FOR SELECT TO authenticated USING (status='released');

ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_config_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY assistants_store_member_read ON public.assistants FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.store_memberships sm
   JOIN public.stores s ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id AND s.active
   JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
   WHERE sm.tenant_id=assistants.tenant_id AND sm.store_id=assistants.store_id AND sm.user_id=(SELECT auth.uid()) AND sm.active));
CREATE POLICY acv_store_member_read ON public.assistant_config_versions FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.store_memberships sm
   JOIN public.stores s ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id AND s.active
   JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
   WHERE sm.tenant_id=assistant_config_versions.tenant_id AND sm.store_id=assistant_config_versions.store_id AND sm.user_id=(SELECT auth.uid()) AND sm.active));
CREATE POLICY channel_connections_store_member_read ON public.channel_connections FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.store_memberships sm
   JOIN public.stores s ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id AND s.active
   JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
   WHERE sm.tenant_id=channel_connections.tenant_id AND sm.store_id=channel_connections.store_id AND sm.user_id=(SELECT auth.uid()) AND sm.active));

-- 6. RPCs (owner/manager of the Store; QA tenant allow-list kept) -----------------------------
CREATE FUNCTION app_private.t404_cfg_manager_tenant(p_store uuid) RETURNS uuid
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid;
BEGIN
 SELECT s.tenant_id INTO tid FROM public.stores s WHERE s.id=p_store AND s.active;
 IF auth.uid() IS NULL OR tid IS NULL OR NOT app_private.t404_qa_tenant_allowed(tid) OR NOT EXISTS (
   SELECT 1 FROM public.store_memberships sm
   JOIN public.tenant_memberships m ON m.tenant_id=sm.tenant_id AND m.user_id=sm.user_id AND m.active
   WHERE sm.tenant_id=tid AND sm.store_id=p_store AND sm.user_id=auth.uid() AND sm.active AND sm.role IN ('owner','manager')) THEN
  RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
 END IF;
 RETURN tid;
END $f$;
REVOKE ALL ON FUNCTION app_private.t404_cfg_manager_tenant(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app_private.t404_cfg_sha(cfg jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $f$
 SELECT encode(sha256(convert_to(cfg::text,'UTF8')),'hex') $f$;

-- Locks the assistant row and returns its scope; access_denied if caller cannot manage it.
CREATE FUNCTION app_private.t404_cfg_lock_assistant(p_assistant uuid, OUT tid uuid, OUT sid uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 SELECT a.tenant_id, a.store_id INTO tid, sid FROM public.assistants a WHERE a.id=p_assistant FOR UPDATE;
 IF sid IS NULL THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 PERFORM app_private.t404_cfg_manager_tenant(sid);
END $f$;
REVOKE ALL ON FUNCTION app_private.t404_cfg_lock_assistant(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_assistant(p_store uuid, p_name text, p_template_key text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_cfg_manager_tenant(p_store); tpl public.industry_templates; aid uuid;
BEGIN
 IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'invalid_name' USING ERRCODE='22023'; END IF;
 SELECT * INTO tpl FROM public.industry_templates t WHERE t.template_key=p_template_key AND t.status='released'
  ORDER BY t.version DESC LIMIT 1;
 IF tpl.template_key IS NULL THEN RAISE EXCEPTION 'template_unknown' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.assistants a WHERE a.tenant_id=tid AND a.store_id=p_store) >= 10 THEN
  RAISE EXCEPTION 'assistant_limit' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.assistants(tenant_id,store_id,name,template_key,template_version,created_by)
  VALUES (tid,p_store,btrim(p_name),tpl.template_key,tpl.version,auth.uid()) RETURNING id INTO aid;
 INSERT INTO public.assistant_config_versions(tenant_id,store_id,assistant_id,version_no,state,config,config_sha256,source,created_by)
  VALUES (tid,p_store,aid,1,'draft',tpl.config,app_private.t404_cfg_sha(tpl.config),'template:'||tpl.template_key||'@'||tpl.version,auth.uid());
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,auth.uid(),'assistant_create',jsonb_build_object('store_id',p_store,'assistant_id',aid,'template',tpl.template_key,'template_version',tpl.version));
 RETURN aid;
END $f$;

-- Save the draft. p_expected_sha = sha of the draft the editor loaded (optimistic concurrency);
-- NULL creates a new draft from scratch only when none exists. Returns the new draft sha.
CREATE FUNCTION public.save_assistant_draft(p_assistant uuid, p_config jsonb, p_expected_sha text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE sc record; errs text[]; d public.assistant_config_versions; sha text;
BEGIN
 SELECT * INTO sc FROM app_private.t404_cfg_lock_assistant(p_assistant);
 IF octet_length(coalesce(p_config::text,'')) > 65536 THEN RAISE EXCEPTION 'config_too_large' USING ERRCODE='22023'; END IF;
 errs := app_private.t404_cfg_validate(p_config,'draft');
 IF errs <> '{}' THEN RAISE EXCEPTION 'invalid_config' USING ERRCODE='22023', DETAIL=array_to_string(errs[1:20],'; '); END IF;
 sha := app_private.t404_cfg_sha(p_config);
 SELECT * INTO d FROM public.assistant_config_versions v WHERE v.assistant_id=p_assistant AND v.state='draft';
 IF d.id IS NULL THEN
  IF p_expected_sha IS NOT NULL THEN RAISE SQLSTATE 'PT409' USING MESSAGE='draft_changed'; END IF;
  INSERT INTO public.assistant_config_versions(tenant_id,store_id,assistant_id,version_no,state,config,config_sha256,source,created_by)
   VALUES (sc.tid,sc.sid,p_assistant,
     (SELECT coalesce(max(v.version_no),0)+1 FROM public.assistant_config_versions v WHERE v.assistant_id=p_assistant),
     'draft',p_config,sha,'edit',auth.uid());
 ELSE
  IF p_expected_sha IS DISTINCT FROM d.config_sha256 THEN RAISE SQLSTATE 'PT409' USING MESSAGE='draft_changed'; END IF;
  UPDATE public.assistant_config_versions SET config=p_config, config_sha256=sha, created_by=auth.uid(), updated_at=now(), source='edit'
   WHERE id=d.id;
 END IF;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (sc.tid,auth.uid(),'assistant_draft_save',jsonb_build_object('assistant_id',p_assistant,'sha',sha));
 RETURN sha;
END $f$;

-- Publish the current draft (must match p_expected_sha). Old published -> superseded.
CREATE FUNCTION public.publish_assistant_config(p_assistant uuid, p_expected_sha text)
 RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE sc record; d public.assistant_config_versions; errs text[];
BEGIN
 SELECT * INTO sc FROM app_private.t404_cfg_lock_assistant(p_assistant);
 SELECT * INTO d FROM public.assistant_config_versions v WHERE v.assistant_id=p_assistant AND v.state='draft';
 IF d.id IS NULL OR p_expected_sha IS DISTINCT FROM d.config_sha256 THEN RAISE SQLSTATE 'PT409' USING MESSAGE='draft_changed'; END IF;
 errs := app_private.t404_cfg_validate(d.config,'publish');
 IF errs <> '{}' THEN RAISE EXCEPTION 'invalid_config' USING ERRCODE='22023', DETAIL=array_to_string(errs[1:20],'; '); END IF;
 UPDATE public.assistant_config_versions SET state='superseded' WHERE assistant_id=p_assistant AND state='published';
 UPDATE public.assistant_config_versions SET state='published', published_at=now(), published_by=auth.uid() WHERE id=d.id;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (sc.tid,auth.uid(),'assistant_publish',jsonb_build_object('assistant_id',p_assistant,'version_no',d.version_no,'sha',d.config_sha256));
 RETURN d.version_no;
END $f$;

-- Roll back = publish a NEW version copying an older published/superseded one (history is never rewritten).
-- An open draft is left untouched.
CREATE FUNCTION public.rollback_assistant_config(p_assistant uuid, p_version_no int)
 RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE sc record; old public.assistant_config_versions; nv int; errs text[];
BEGIN
 SELECT * INTO sc FROM app_private.t404_cfg_lock_assistant(p_assistant);
 SELECT * INTO old FROM public.assistant_config_versions v WHERE v.assistant_id=p_assistant AND v.version_no=p_version_no
  AND v.state IN ('published','superseded');
 IF old.id IS NULL THEN RAISE EXCEPTION 'version_not_found' USING ERRCODE='22023'; END IF;
 -- Re-validate against today's registry (an action may have been retired since).
 errs := app_private.t404_cfg_validate(old.config,'publish');
 IF errs <> '{}' THEN RAISE EXCEPTION 'invalid_config' USING ERRCODE='22023', DETAIL=array_to_string(errs[1:20],'; '); END IF;
 SELECT max(v.version_no)+1 INTO nv FROM public.assistant_config_versions v WHERE v.assistant_id=p_assistant;
 UPDATE public.assistant_config_versions SET state='superseded' WHERE assistant_id=p_assistant AND state='published';
 INSERT INTO public.assistant_config_versions(tenant_id,store_id,assistant_id,version_no,state,config,config_sha256,source,created_by,published_at,published_by)
  VALUES (sc.tid,sc.sid,p_assistant,nv,'published',old.config,old.config_sha256,'rollback:v'||p_version_no,auth.uid(),now(),auth.uid());
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (sc.tid,auth.uid(),'assistant_rollback',jsonb_build_object('assistant_id',p_assistant,'from_version',p_version_no,'new_version',nv));
 RETURN nv;
END $f$;

-- Trusted resolver for channel adapters (service_role only). The adapter passes the provider
-- account it VERIFIED (e.g. Meta-signed page id); tenant/store/assistant come only from this table.
CREATE FUNCTION public.resolve_channel_assistant(p_channel text, p_external_account_id text)
 RETURNS TABLE(tenant_id uuid, store_id uuid, assistant_id uuid, environment text, version_no int, config jsonb, config_sha256 text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT c.tenant_id, c.store_id, c.assistant_id, c.environment, v.version_no, v.config, v.config_sha256
 FROM public.channel_connections c
 JOIN public.stores s ON s.tenant_id=c.tenant_id AND s.id=c.store_id AND s.active
 JOIN public.assistants a ON a.tenant_id=c.tenant_id AND a.store_id=c.store_id AND a.id=c.assistant_id AND a.status='active'
 JOIN public.assistant_config_versions v ON v.assistant_id=a.id AND v.state='published'
 WHERE c.channel=p_channel AND c.external_account_id=p_external_account_id AND c.status='active' $f$;

REVOKE ALL ON FUNCTION public.create_assistant(uuid,text,text), public.save_assistant_draft(uuid,jsonb,text),
 public.publish_assistant_config(uuid,text), public.rollback_assistant_config(uuid,int),
 public.resolve_channel_assistant(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_assistant(uuid,text,text), public.save_assistant_draft(uuid,jsonb,text),
 public.publish_assistant_config(uuid,text), public.rollback_assistant_config(uuid,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_channel_assistant(text,text) TO service_role;
REVOKE ALL ON FUNCTION app_private.t404_cfg_str(jsonb,int,int), app_private.t404_cfg_int(jsonb,numeric,numeric),
 app_private.t404_cfg_url_error(jsonb,text[]), app_private.t404_cfg_phone_ok(jsonb), app_private.t404_cfg_validate(jsonb,text),
 app_private.t404_cfg_sha(jsonb), app_private.t404_acv_guard() FROM PUBLIC, anon, authenticated;

SELECT 'T404_CC_CONFIG_CORE_OK' AS marker;
COMMIT;

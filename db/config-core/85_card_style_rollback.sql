-- Rollback of 30_card_style.sql: restore the validator body from 10_config_core.sql, drop helpers.
-- Refuses if any stored config still uses card_style (it would become invalid).
BEGIN;
DO $g$ BEGIN
 IF EXISTS (SELECT 1 FROM public.assistant_config_versions WHERE config ? 'card_style') THEN
  RAISE EXCEPTION 'card_style_in_use';
 END IF;
END $g$;
-- Returns 'path|code' errors (empty array = valid). p_mode: 'draft' | 'publish'.
CREATE OR REPLACE FUNCTION app_private.t404_cfg_validate(cfg jsonb, p_mode text) RETURNS text[]
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
DROP FUNCTION IF EXISTS app_private.t404_cfg_card_style_errors(jsonb);
DROP FUNCTION IF EXISTS app_private.t404_cfg_card_style_obj(jsonb,text);
SELECT 'T404_CARD_STYLE_85_OK';
COMMIT;

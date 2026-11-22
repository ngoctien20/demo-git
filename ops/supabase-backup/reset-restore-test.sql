-- Dọn dự án tien404-restore-test trước mỗi lần khôi phục thử.
-- CHỈ chạy được trên dự án có bảng đánh dấu restore_test_guard.marker (staging không có bảng này).
do $$ begin
  if to_regclass('restore_test_guard.marker') is null then
    raise exception 'DUNG: day khong phai du an tien404-restore-test (thieu restore_test_guard.marker)';
  end if;
end $$;

drop schema if exists app_private, factory_private, tien404_r1_qa, tien404_v175_qa, tien404_dialogue_private cascade;
drop schema if exists supabase_migrations cascade;

-- Schema public: xóa mọi đối tượng ứng dụng, giữ lại schema
do $$ declare r record; begin
  for r in select format('drop view if exists %I.%I cascade', schemaname, viewname) q from pg_views where schemaname = 'public' loop execute r.q; end loop;
  for r in select format('drop table if exists %I.%I cascade', schemaname, tablename) q from pg_tables where schemaname = 'public' loop execute r.q; end loop;
  for r in select format('drop function if exists %s cascade', p.oid::regprocedure) q
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop execute r.q; end loop;
  for r in select format('drop sequence if exists %I.%I cascade', sequence_schema, sequence_name) q from information_schema.sequences where sequence_schema = 'public' loop execute r.q; end loop;
  for r in select format('drop type if exists %I.%I cascade', n.nspname, t.typname) q
           from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typtype in ('e','d','c') and t.typrelid = 0
             and not exists (select 1 from pg_depend d where d.objid = t.oid and d.deptype = 'e') loop execute r.q; end loop;
end $$;

-- Dữ liệu Auth từ lần khôi phục trước
do $$ declare t text; begin
  foreach t in array array['mfa_amr_claims','mfa_challenges','mfa_factors','refresh_tokens','sessions','one_time_tokens',
                           'identities','flow_state','audit_log_entries','users'] loop
    if to_regclass('auth.' || t) is not null then execute format('delete from auth.%I', t); end if;
  end loop;
end $$;

-- Role tùy chỉnh từ lần khôi phục trước
do $$ declare r record; begin
  for r in select rolname from pg_roles where rolname like 'tien404\_%' loop
    execute format('grant %I to current_user', r.rolname);  -- cần là thành viên mới được drop owned
    execute format('drop owned by %I cascade', r.rolname);
    execute format('drop role %I', r.rolname);
  end loop;
end $$;

-- TIEN404 V14.4.3 — DISPOSABLE PG17 CI SECURITY DEFINER DEMO ONLY.
-- This fixture INTENTIONALLY demonstrates privilege bypass, never deploy.
-- Independent guard BEFORE any DDL, inside exact disposable CI database.
DO $only_ci$
BEGIN
 IF current_database()<>'tien404_v1443_definer_ci'
    OR current_user<>'postgres'
    OR current_setting('tien404.v1443_ci',true)<>'ON'
 THEN
   RAISE EXCEPTION 'V1443_EPHEMERAL_PG17_NO_HOSTED_SQL_ALLOWED';
 END IF;
END
$only_ci$;

CREATE SCHEMA qa_v1443;
REVOKE ALL ON SCHEMA qa_v1443 FROM PUBLIC;
CREATE ROLE qa_v1443_anon NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT USAGE ON SCHEMA qa_v1443 TO qa_v1443_anon;
CREATE TABLE qa_v1443.products(id integer PRIMARY KEY,tenant text,store text);
INSERT INTO qa_v1443.products VALUES (1,'tenant-shared','store-a'),
                                     (2,'tenant-shared','store-b');
ALTER TABLE qa_v1443.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v1443.products FORCE ROW LEVEL SECURITY;
GRANT SELECT ON qa_v1443.products TO qa_v1443_anon;
CREATE POLICY deny_anon_select ON qa_v1443.products FOR SELECT
  TO qa_v1443_anon USING (false);
CREATE FUNCTION qa_v1443.read_count() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
 SELECT count(*)::integer FROM qa_v1443.products
$$;
REVOKE ALL ON FUNCTION qa_v1443.read_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_v1443.read_count() TO qa_v1443_anon;

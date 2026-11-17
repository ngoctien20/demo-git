-- V17.2C.15 isolated ephemeral CI Postgres bootstrap only.
-- This file must NEVER be run on any Supabase project.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $fn$ SELECT null::uuid $fn$;

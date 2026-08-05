-- ═══════════════════════════════════════════════════════════════════════════
-- Local validation shim — NOT part of the deployed schema.
--
-- Recreates just enough of the Supabase platform (auth, storage, roles, the
-- realtime publication, pgvector's surface) that `supabase/migrations/*.sql`
-- can be applied to a bare Postgres 16 in CI to catch syntax, dependency and
-- policy-expression errors before they reach a real project.
--
-- Run with: supabase/tests/validate.sh
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists graphql_public;

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema public, extensions to anon, authenticated, service_role;

-- ─── auth ───────────────────────────────────────────────────────────────────

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$;

-- ─── storage ────────────────────────────────────────────────────────────────

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

-- ─── pgvector surface ───────────────────────────────────────────────────────
-- A domain over float8[] stands in for the real `vector` type. It accepts the
-- same literals and supports the `<=>` cosine-distance operator used by the
-- search RPC, which is all the migrations need in order to parse and plan.
-- validate.sh rewrites `vector(1536)` → `vector` and swaps the ivfflat index
-- for a btree, since typmods and access methods cannot be faked.

create domain extensions.vector as float8[];

create or replace function extensions.vector_cosine_distance(a extensions.vector, b extensions.vector)
returns float8
language plpgsql
immutable
as $$
declare
  dot float8 := 0; na float8 := 0; nb float8 := 0; i integer;
begin
  if a is null or b is null or array_length(a, 1) is distinct from array_length(b, 1) then
    return null;
  end if;
  for i in 1 .. array_length(a, 1) loop
    dot := dot + a[i] * b[i];
    na := na + a[i] * a[i];
    nb := nb + b[i] * b[i];
  end loop;
  if na = 0 or nb = 0 then return 1; end if;
  return 1 - (dot / (sqrt(na) * sqrt(nb)));
end;
$$;

create operator extensions.<=> (
  leftarg = extensions.vector,
  rightarg = extensions.vector,
  function = extensions.vector_cosine_distance
);

create or replace function extensions.vector_cosine_ops() returns void language sql as $$ select $$;

-- ─── pg_net surface ─────────────────────────────────────────────────────────

create or replace function extensions.http_post(url text, headers jsonb, body jsonb)
returns bigint
language sql
as $$ select 0::bigint; $$;

-- ─── realtime ───────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

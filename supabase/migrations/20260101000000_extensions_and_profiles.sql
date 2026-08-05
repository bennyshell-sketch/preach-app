-- ═══════════════════════════════════════════════════════════════════════════
-- Preach — 001: extensions, profiles, shared helpers
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "vector" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Profiles ───────────────────────────────────────────────────────────────
-- One row per auth.users row, created by trigger on signup.

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text not null default 'Friend',
  handle            text unique,
  avatar_url        text,
  bio               text,
  denomination      text,
  -- Privacy settings, editable end-to-end from Me → Profile.
  notes_public      boolean not null default false,
  discoverable      boolean not null default true,
  show_online       boolean not null default true,
  -- Engagement
  streak_days       integer not null default 0,
  last_active_on    date,
  expo_push_token   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint display_name_len check (char_length(display_name) between 1 and 60),
  constraint handle_format check (handle is null or handle ~ '^[a-z0-9_]{3,24}$'),
  constraint bio_len check (bio is null or char_length(bio) <= 280)
);

create index profiles_handle_idx on public.profiles using gin (handle extensions.gin_trgm_ops);
create index profiles_display_name_idx on public.profiles using gin (display_name extensions.gin_trgm_ops);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile whenever a user signs up, carrying over whatever the
-- identity provider gave us (Google/Apple full name, avatar).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, 'friend@preach.app'), '@', 1)
    ),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- Any signed-in user may read profiles: the app shows member profiles, friend
-- suggestions and room rosters. Rows the owner marked undiscoverable are
-- filtered by the search RPC, not hidden outright, because a room member must
-- still resolve their co-members' names.
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "users insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

-- unfold Phase 0 schema: discoveries + full-text search + API tokens.
-- Embeddings, relations and threads arrive in later migrations (Phase 1/2),
-- once an embedding provider (and therefore vector dimension) is chosen.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- discovery
-- ---------------------------------------------------------------------------
create type discovery_status as enum ('pending', 'ready', 'failed');

create table public.discovery (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  original_url    text not null,
  canonical_url   text,
  url_hash        text not null,
  title           text,
  summary         text,
  why_note        text,
  resource_type   text,
  domain          text,
  thumbnail_url   text,
  favicon_url     text,
  tags            text[] not null default '{}',
  search_tsv      tsvector,
  status          discovery_status not null default 'pending',
  error           text,
  saved_at        timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_opened_at  timestamptz,
  constraint discovery_user_url_unique unique (user_id, url_hash),
  constraint why_note_len check (char_length(why_note) <= 500)
);

create index discovery_user_saved_idx on public.discovery (user_id, saved_at desc);
create index discovery_search_idx on public.discovery using gin (search_tsv);

-- search_tsv is maintained by trigger rather than a generated column because
-- array_to_string() is not IMMUTABLE.
create or replace function public.discovery_search_tsv() returns trigger
language plpgsql as $$
begin
  new.search_tsv :=
      setweight(to_tsvector('english', coalesce(new.title, '')), 'A')
   || setweight(to_tsvector('english', coalesce(new.why_note, '')), 'A')
   || setweight(to_tsvector('english', array_to_string(new.tags, ' ')), 'B')
   || setweight(to_tsvector('english', coalesce(new.summary, '')), 'C')
   || setweight(to_tsvector('simple',  coalesce(new.domain, '')), 'D');
  new.updated_at := now();
  return new;
end $$;

create trigger discovery_search_tsv_trg
  before insert or update of title, why_note, tags, summary, domain
  on public.discovery
  for each row execute function public.discovery_search_tsv();

-- ---------------------------------------------------------------------------
-- api_token: personal tokens for the Chrome extension (stored hashed)
-- ---------------------------------------------------------------------------
create table public.api_token (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null default 'Chrome extension',
  token_hash    text not null unique,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index api_token_user_idx on public.api_token (user_id);

-- ---------------------------------------------------------------------------
-- Row level security. The app server talks to Postgres directly and always
-- filters by user_id; RLS is defence in depth for anything using the
-- anon/authenticated roles via PostgREST.
-- ---------------------------------------------------------------------------
alter table public.discovery enable row level security;
alter table public.api_token enable row level security;

create policy discovery_owner on public.discovery
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy api_token_owner_read on public.api_token
  for select to authenticated
  using (user_id = auth.uid());

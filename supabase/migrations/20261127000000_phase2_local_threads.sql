-- unfold Phase 2: local embeddings + threads.
--
-- 1. Embeddings move from Voyage (1024-dim) to a local model, bge-small-en-v1.5
--    (384-dim). Existing vectors are dropped; the worker re-embeds every item.
-- 2. Threads: nightly clusters of related items, with stable ids and keyword names.

-- ---------------------------------------------------------------------------
-- 1. 384-dim embeddings
-- ---------------------------------------------------------------------------
drop index if exists public.discovery_embedding_idx;
alter table public.discovery drop column if exists embedding;
alter table public.discovery add column embedding extensions.vector(384);
-- Re-run enrichment for everything (summary/tags/embedding are now computed locally).
update public.discovery set embedding_model = null, enriched_at = null, enrich_error = null;

create index discovery_embedding_idx
  on public.discovery using hnsw (embedding extensions.vector_cosine_ops);

-- "Why related" is now computed from shared tags; the cached LLM text is unused.
alter table public.relation drop column if exists explanation;

-- ---------------------------------------------------------------------------
-- 2. threads
-- ---------------------------------------------------------------------------
create table if not exists public.thread (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  centroid    extensions.vector(384),
  size        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists thread_user_idx on public.thread (user_id);

-- One discovery can sit in more than one thread (primary = its own cluster).
create table if not exists public.thread_member (
  thread_id     uuid not null references public.thread (id) on delete cascade,
  discovery_id  uuid not null references public.discovery (id) on delete cascade,
  score         real not null,           -- similarity to the thread centroid
  is_primary    boolean not null default true,
  added_at      timestamptz not null default now(),
  primary key (thread_id, discovery_id)
);
create index if not exists thread_member_discovery_idx on public.thread_member (discovery_id);

-- Last clustering run per user, so the nightly job skips unchanged libraries.
create table if not exists public.thread_build (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  built_at    timestamptz not null default now(),
  item_count  int not null default 0,
  fingerprint text
);

alter table public.thread enable row level security;
alter table public.thread_member enable row level security;
alter table public.thread_build enable row level security;

drop policy if exists thread_owner on public.thread;
create policy thread_owner on public.thread
  for select to authenticated using (user_id = auth.uid());

drop policy if exists thread_member_owner on public.thread_member;
create policy thread_member_owner on public.thread_member
  for select to authenticated
  using (exists (select 1 from public.thread t where t.id = thread_id and t.user_id = auth.uid()));

drop policy if exists thread_build_owner on public.thread_build;
create policy thread_build_owner on public.thread_build
  for select to authenticated using (user_id = auth.uid());

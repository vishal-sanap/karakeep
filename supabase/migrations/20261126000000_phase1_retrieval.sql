-- unfold Phase 1: AI enrichment, embeddings, related items.
-- Embeddings: Voyage AI voyage-3.5-lite at 1024 dimensions. Changing model or
-- dimension means a new migration plus a re-embed of every discovery.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- discovery: enrichment state + embedding
-- ---------------------------------------------------------------------------
alter table public.discovery
  add column if not exists embedding        extensions.vector(1024),
  add column if not exists embedding_model  text,
  add column if not exists enriched_at      timestamptz,
  add column if not exists enrich_error     text;

-- Cosine distance; HNSW works well from an empty table and needs no tuning.
create index if not exists discovery_embedding_idx
  on public.discovery using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- relation: cached "why related" explanations and dismissals.
-- Neighbours are computed on view; a row exists only once the user opened or
-- dismissed a connection. Pairs are stored once, ordered (a_id < b_id).
-- ---------------------------------------------------------------------------
create table if not exists public.relation (
  user_id      uuid not null references auth.users (id) on delete cascade,
  a_id         uuid not null references public.discovery (id) on delete cascade,
  b_id         uuid not null references public.discovery (id) on delete cascade,
  score        real,
  explanation  text,
  dismissed    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (a_id, b_id),
  constraint relation_ordered check (a_id < b_id)
);

create index if not exists relation_user_idx on public.relation (user_id);

alter table public.relation enable row level security;

drop policy if exists relation_owner on public.relation;
create policy relation_owner on public.relation
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

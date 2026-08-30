-- AI Pulse — Phase 0 schema
-- Run this once against your Neon database (SQL Editor in the Neon console).

create extension if not exists vector;

create table if not exists sources (
  id          serial primary key,
  name        text not null,
  feed_url    text not null unique,
  site_url    text,
  kind        text not null default 'rss',   -- rss | youtube | reddit
  weight      real not null default 0.5,     -- 0..1 authority score
  active      boolean not null default true,
  last_ok_at  timestamptz,
  last_error  text,
  created_at  timestamptz not null default now()
);

create table if not exists articles (
  id            bigserial primary key,
  source_id     integer not null references sources(id) on delete cascade,
  url           text not null unique,        -- dedupe backstop
  title         text not null,
  author        text,
  summary       text,
  body          text,
  -- feeds lie about published_at constantly; keep fetched_at separately
  published_at  timestamptz,
  fetched_at    timestamptz not null default now(),
  embedding     vector(384),                 -- all-MiniLM-L6-v2, filled in phase 1
  story_id      bigint,                      -- filled in phase 1
  search_tsv    tsvector generated always as (
                  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,''))
                ) stored
);

create index if not exists articles_published_idx on articles (published_at desc nulls last);
create index if not exists articles_fetched_idx   on articles (fetched_at desc);
create index if not exists articles_source_idx    on articles (source_id);
create index if not exists articles_search_idx    on articles using gin (search_tsv);

-- Vector index is added in phase 1, once there are enough rows for it to help.
-- create index articles_embedding_idx on articles
--   using hnsw (embedding vector_cosine_ops);

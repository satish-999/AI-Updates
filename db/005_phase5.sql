-- AI Pulse — Phase 4/5: search, read state, model board, saved questions.
-- Additive and idempotent.

-- Full-text over the whole article, not just title+summary. The phase 0 column
-- indexed only title and summary; body carries the detail that "searchable
-- down to minor details" actually needs.
alter table articles add column if not exists search_full tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(left(body, 20000), ''))
  ) stored;

create index if not exists articles_search_full_idx on articles using gin (search_full);

-- Stories get their own searchable text so the Pulse and Ask can rank whole
-- events rather than individual articles.
alter table stories add column if not exists search_tsv tsvector;

create index if not exists stories_search_idx on stories using gin (search_tsv);

-- What has been seen. Powers Catch-up: "the six things that mattered", not
-- four hundred unread items.
create table if not exists read_state (
  story_id bigint primary key references stories(id) on delete cascade,
  read_at  timestamptz not null default now()
);

create index if not exists read_state_time_idx on read_state (read_at desc);

-- Model Board rows. Benchmarks stay jsonb because every lab reports a
-- different set and a fixed schema would be wrong within a month.
create table if not exists models (
  id           bigserial primary key,
  name         text not null unique,
  slug         text not null unique,
  vendor       text,
  released_at  date,
  context      integer,
  benchmarks   jsonb not null default '{}'::jsonb,
  notes        text,
  story_id     bigint references stories(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists models_released_idx on models (released_at desc nulls last);

-- A saved query re-runs each cycle and pushes on a hit, which turns the agent
-- from something you visit into something that watches.
create table if not exists saved_questions (
  id           bigserial primary key,
  question     text not null,
  active       boolean not null default true,
  last_run_at  timestamptz,
  last_hit_at  timestamptz,
  hits         integer not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists saved_question_hits (
  question_id bigint not null references saved_questions(id) on delete cascade,
  story_id    bigint not null references stories(id) on delete cascade,
  found_at    timestamptz not null default now(),
  primary key (question_id, story_id)
);

-- Web Push endpoints. iOS only delivers to an installed PWA, so this fills up
-- only after the app is added to the home screen.
create table if not exists push_subscriptions (
  id         bigserial primary key,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- Entity aliases are what stop "QWEN", "Qwen 3.8 27B" and "Qwen3.8-27B-FP8"
-- becoming three entity pages for one thing.
create index if not exists entities_aliases_idx on entities using gin (aliases);

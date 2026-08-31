-- AI Pulse — Phase 3: enrichment.
-- Additive and idempotent.

-- The quota fuse. One row per provider per UTC day.
--
-- Guards one specific failure: a clustering regression that stops merging
-- produces hundreds of single-article stories, each looking novel and
-- important, which would drain the day's free tier overnight.
create table if not exists llm_calls (
  day      date not null,
  provider text not null,
  calls    integer not null default 0,
  primary key (day, provider)
);

-- Companies, people and models. `aliases` lets "Google DeepMind", "DeepMind"
-- and "GDM" resolve to one entity page.
create table if not exists entities (
  id         bigserial primary key,
  name       text not null,
  slug       text not null unique,
  kind       text not null,              -- company | person | model
  aliases    text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists entities_kind_idx on entities (kind);

create table if not exists story_entities (
  story_id  bigint not null references stories(id)  on delete cascade,
  entity_id bigint not null references entities(id) on delete cascade,
  primary key (story_id, entity_id)
);

create index if not exists story_entities_entity_idx on story_entities (entity_id);

-- An ongoing narrative, keyed on (primary entity, category). That pair is a
-- stable narrative key, so no graph algorithm is needed: the thread timeline
-- is just the stories sharing a thread_id, ordered by first_seen_at.
create table if not exists threads (
  id           bigserial primary key,
  entity_id    bigint references entities(id) on delete set null,
  category     text not null,
  title        text not null,
  created_at   timestamptz not null default now(),
  unique (entity_id, category)
);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'stories_thread_id_fkey'
  ) then
    alter table stories
      add constraint stories_thread_id_fkey
      foreign key (thread_id) references threads(id) on delete set null;
  end if;
end $$;

create index if not exists stories_thread_idx on stories (thread_id, first_seen_at);

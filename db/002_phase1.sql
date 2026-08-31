-- AI Pulse — Phase 1 schema: embeddings and clustering.
-- Additive and idempotent; safe to run more than once.

-- ---------------------------------------------------------------- stories --
-- The atom. One real-world event, however many articles cover it.
create table if not exists stories (
  id                bigserial primary key,
  -- running mean of member embeddings. Comparing a new article against this
  -- is one indexed lookup instead of a scan over every member article.
  centroid          vector(384) not null,
  article_count     integer not null default 1,
  -- denormalised so ranking never needs to join back to sources
  max_source_weight real not null default 0,
  -- earliest and latest published_at across members. last_seen_at drives the
  -- 72h candidate window, so it must track the newest article, not now().
  first_seen_at     timestamptz not null,
  last_seen_at      timestamptz not null,
  -- phase 2
  importance        real,
  scored_at         timestamptz,
  -- phase 3
  one_liner         text,
  category          text,
  thread_id         bigint,
  enriched_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists stories_window_idx     on stories (last_seen_at desc);
create index if not exists stories_importance_idx on stories (importance desc nulls last);
create index if not exists stories_unenriched_idx on stories (importance desc) where enriched_at is null;

-- The forty-to-one link.
create table if not exists story_articles (
  story_id   bigint not null references stories(id)  on delete cascade,
  article_id bigint not null references articles(id) on delete cascade,
  primary key (story_id, article_id)
);

create index if not exists story_articles_article_idx on story_articles (article_id);

-- --------------------------------------------------------------- articles --
-- Stage 3 marks every article it has considered, whether or not it joined a
-- story. Without this the predicate would be `story_id is null`, and the
-- ~2,200 archive articles too old to cluster would be retried every cycle
-- forever — and would each become a singleton story if they were not skipped.
alter table articles add column if not exists clustered_at timestamptz;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'articles_story_id_fkey'
  ) then
    alter table articles
      add constraint articles_story_id_fkey
      foreign key (story_id) references stories(id) on delete set null;
  end if;
end $$;

-- Partial indexes matching the stage predicates exactly, so "find my work"
-- stays cheap as the table grows.
create index if not exists articles_unembedded_idx  on articles (id)
  where embedding is null;
create index if not exists articles_unclustered_idx on articles (published_at desc)
  where clustered_at is null;

-- ---------------------------------------------------------- cluster_debug --
-- The 0.82 threshold cannot be validated on test data — it depends on this
-- exact mix of feeds. Log every near-miss so the boundary can be read off
-- real news after a few days instead of guessed at.
create table if not exists cluster_debug (
  id            bigserial primary key,
  article_id    bigint not null,
  story_id      bigint,
  similarity    real not null,
  decision      text  not null,   -- attached | new_story
  article_title text,
  story_title   text,
  created_at    timestamptz not null default now()
);

create index if not exists cluster_debug_sim_idx on cluster_debug (similarity);

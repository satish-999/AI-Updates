-- Not every source produces "events that many outlets cover".
--
-- Measured on real embeddings: every false-positive pair above the news
-- threshold was arXiv-to-arXiv. Paper titles share so much vocabulary that
-- unrelated papers sit at 0.762 while genuinely identical news stories sit at
-- 0.767 — no single threshold separates them while research shares the pool.
--
-- Research articles are still embedded and searchable; they just do not form
-- or join Pulse stories. When a paper actually matters, the press coverage of
-- it clusters on its own.
alter table sources add column if not exists clusterable boolean not null default true;

update sources set clusterable = false
where feed_url like '%arxiv.org%';

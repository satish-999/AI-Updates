-- Observed dates must not be presented as release dates or benchmark ranks.
alter table models add column if not exists observed_at timestamptz;
alter table models add column if not exists source_url text;
create index if not exists models_observed_idx on models(observed_at desc nulls last);

-- Browser-scoped pilot monitors. These are not paid customer accounts.
alter table saved_questions add column if not exists viewer_id text;
alter table saved_questions add column if not exists slot smallint check (slot between 1 and 20);
create unique index if not exists saved_questions_viewer_slot on saved_questions(viewer_id, slot);
create index if not exists saved_questions_due on saved_questions(last_run_at) where active;

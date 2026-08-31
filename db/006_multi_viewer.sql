-- Multiple people, one app.
--
-- read_state was keyed on story_id alone, which was correct for a single user
-- and silently wrong for a team: the first person to open a story marked it
-- read for everyone, so Catch-up emptied itself for colleagues who had not
-- seen anything. Reads are now per viewer.
--
-- A viewer is an anonymous id in a cookie, not an account. Everyone still
-- shares one password; this only separates "what have I seen" so Catch-up
-- means something per person.

alter table read_state add column if not exists viewer_id text not null default 'legacy';

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_name = 'read_state' and constraint_type = 'PRIMARY KEY'
      and constraint_name = 'read_state_pkey'
  ) then
    -- Only swap the key if it is still the single-column one.
    if (
      select count(*) from information_schema.key_column_usage
      where constraint_name = 'read_state_pkey' and table_name = 'read_state'
    ) = 1 then
      alter table read_state drop constraint read_state_pkey;
      alter table read_state add primary key (viewer_id, story_id);
    end if;
  end if;
end $$;

create index if not exists read_state_viewer_idx on read_state (viewer_id, read_at desc);

-- Customer accounts are separate from legacy anonymous read-state.
-- Additive and idempotent; never converts an unsigned viewer cookie into an account.
create table if not exists app_users (
  id uuid primary key,
  username text not null unique check (username ~ '^[a-z][a-z0-9_]{2,29}$'),
  password_hash text not null,
  auth_version integer not null default 1,
  recovery_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists app_sessions (
  token_hash text primary key,
  auth_version integer not null,
  user_id uuid not null references app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists app_sessions_user_idx on app_sessions(user_id);
create index if not exists app_sessions_expiry_idx on app_sessions(expires_at);
create table if not exists app_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (bucket, window_start)
);
create index if not exists app_rate_limits_window_idx on app_rate_limits(window_start);
create table if not exists user_projects (
  id uuid primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  goal text not null check (char_length(goal) between 1 and 1200),
  requirements jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_projects_owner_idx on user_projects(user_id, updated_at desc);

alter table app_users add column if not exists auth_version integer not null default 1;
alter table app_sessions add column if not exists auth_version integer not null default 1;

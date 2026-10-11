-- Auth identity comes only from Supabase's verified user, not client input.
-- Application data remains in Neon; no auth password is stored here.
create table if not exists account_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  slot smallint not null check (slot between 1 and 100),
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  created_at timestamptz not null default now(),
  unique(owner_id, slot)
);
create table if not exists billing_accounts (
  owner_id uuid primary key,
  intent_id uuid not null unique default gen_random_uuid(),
  subscription_id text unique,
  plan_id text,
  status text not null default 'creating',
  checkout_url text,
  paid_until timestamptz,
  cancel_requested boolean not null default false,
  sync_version bigint not null default 0,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);
create sequence if not exists billing_sync_sequence;
create table if not exists billing_events (
  event_id text primary key,
  subscription_id text not null,
  processed_at timestamptz not null default now()
);
create table if not exists account_usage (
  owner_id uuid not null,
  day date not null default (now() at time zone 'UTC')::date,
  attempts int not null check(attempts > 0),
  primary key(owner_id, day)
);
create table if not exists billing_history (
  subscription_id text primary key,
  owner_id uuid not null,
  intent_id uuid not null,
  plan_id text not null,
  status text not null,
  paid_until timestamptz,
  archived_at timestamptz not null default now()
);

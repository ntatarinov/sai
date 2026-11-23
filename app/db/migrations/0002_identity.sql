-- 0002_identity (REQ-114, REQ-115; the code design M2AUTH, 4.2): the accounts and the tenancy tables.
-- Expand-only. Global tables have no org_id and no row-level security; the tenant tables orgs, org_members,
-- invites and audit_log have row-level security enabled and forced. Times that a rule reads come from the
-- app's clock as parameters, never from now(); now() is only the default of created_at columns no rule
-- reads. The privileges of the app roles are not set here: they stand in app/db/grants.sql (decisions/0137, O1).

-- Global tables.

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~ '^[!-~]{1,64}@[!-~]{1,189}$'),
  email_norm text not null unique check (email_norm = lower(email_norm) and email_norm ~ '^[!-~]{1,64}@[!-~]{1,189}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  password_hash text not null check (char_length(password_hash) <= 200 and password_hash ~ '^scrypt[$]17[$]8[$]1[$]'),
  is_platform_admin boolean not null default false,
  is_owner_identity boolean not null default false,
  totp_secret_enc text check (char_length(totp_secret_enc) <= 200),
  totp_enabled_at timestamptz,
  totp_last_step bigint,
  totp_recovery text[] not null default '{}' check (cardinality(totp_recovery) <= 10 and array_to_string(totp_recovery, ',') ~ '^([0-9a-f]{64}(,[0-9a-f]{64})*)?$'),
  language text not null default 'ru' check (language in ('ru', 'kk', 'en')),
  status text not null default 'active' check (status in ('active', 'disabled', 'deleted')),
  failed_logins integer not null default 0 check (failed_logins >= 0),
  failed_since timestamptz,
  locked_until timestamptz,
  reauth_failures integer not null default 0 check (reauth_failures >= 0),
  reauth_failed_since timestamptz,
  reauth_locked_until timestamptz,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  check (totp_enabled_at is null or totp_secret_enc is not null)
);

-- At most one platform admin.
create unique index users_one_platform_admin on users ((true)) where is_platform_admin;

create table auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  csrf_hash text not null check (csrf_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  last_seen_at timestamptz not null,
  abs_expires_at timestamptz not null,
  ip_hmac text check (ip_hmac ~ '^[0-9a-f]{64}$')
);

create index auth_sessions_user_id on auth_sessions (user_id);

create table reauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  auth_session_id uuid not null references auth_sessions (id) on delete cascade,
  purpose text not null check (purpose in ('reset_link', 'totp_enrol', 'totp_off', 'dev_start', 'dev_resume', 'worker_token', 'settings', 'kill_switch_off', 'ai_allow', 'codes', 'owner_identity')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index reauth_tokens_auth_session_id on reauth_tokens (auth_session_id);

create table password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references users (id),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index password_resets_user_id on password_resets (user_id);

create table rate_limits (
  key text not null check (key ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  count integer not null check (count >= 1),
  primary key (key, window_start)
);

-- The admin delay per client address (REQ-114 criterion 5): the row is inserted with 0 before it is locked.
create table login_delays (
  key text primary key check (key ~ '^[0-9a-f]{64}$'),
  fails integer not null check (fails >= 0),
  next_at timestamptz not null,
  updated_at timestamptz not null
);

-- The login counter of an e-mail with no active account (unknown, disabled, deleted), keyed by the e-mail's
-- HMAC, with the same rule as the counter columns of users (decisions/0137 Addition B7a, N2c).
create table login_failures (
  key text primary key check (key ~ '^[0-9a-f]{64}$'),
  fails integer not null check (fails >= 0),
  failed_since timestamptz,
  locked_until timestamptz,
  updated_at timestamptz not null
);

-- Tenant tables.

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('owner', 'customer')),
  ai_allowed boolean not null default false,
  created_by uuid references users (id),
  created_at timestamptz not null default now()
);

-- At most one owner organisation.
create unique index orgs_one_owner on orgs (kind) where kind = 'owner';

create table org_members (
  org_id uuid not null references orgs (id),
  user_id uuid not null references users (id),
  role text not null check (role in ('org_owner', 'org_admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id),
  unique (user_id)
);

-- A member of the owner organisation must be an owner identity (ARCH §4).
create function org_members_owner_identity() returns trigger language plpgsql as $f$
begin
  if exists (select 1 from orgs where id = new.org_id and kind = 'owner')
    and not exists (select 1 from users where id = new.user_id and is_owner_identity) then
    raise exception 'sai: a member of the owner organisation must be an owner identity' using errcode = 'P0001';
  end if;
  return new;
end
$f$;

create trigger org_members_owner_identity before insert or update on org_members
  for each row execute function org_members_owner_identity();

create table invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs (id),
  email_norm text not null check (email_norm = lower(email_norm) and email_norm ~ '^[!-~]{1,64}@[!-~]{1,189}$'),
  role text not null check (role in ('org_owner', 'org_admin', 'member', 'viewer')),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references users (id),
  created_by uuid not null references users (id),
  created_at timestamptz not null default now()
);

create index invites_org_id on invites (org_id);

-- The audit log (REQ-115 criterion 10): the writer takes the id from the sequence and chains the hash.
create sequence audit_log_id_seq;

create table audit_log (
  id bigint primary key,
  org_id uuid references orgs (id),
  actor_kind text not null check (actor_kind in ('user', 'admin', 'worker', 'system')),
  actor_id uuid,
  action text not null check (action in ('auth.setup', 'auth.login', 'auth.login_failed', 'auth.logout', 'auth.password_change', 'auth.reauth', 'auth.reauth_failed', 'auth.reset_link_issued', 'auth.reset_used', 'auth.reset_failed', 'auth.totp_enrol', 'auth.totp_confirm', 'auth.totp_recovery_used', 'auth.totp_off')),
  target_kind text check (char_length(target_kind) <= 32),
  target_id text check (char_length(target_id) <= 64),
  ip_hmac text check (ip_hmac ~ '^[0-9a-f]{64}$'),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  prev_hash text not null check (prev_hash ~ '^[0-9a-f]{64}$'),
  hash text not null unique check (hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null
);

alter sequence audit_log_id_seq owned by audit_log.id;

create index audit_log_org_id_id on audit_log (org_id, id);

-- Append-only for every role, the owner included: UPDATE and DELETE (each row) and TRUNCATE (each statement).
create function audit_log_append_only() returns trigger language plpgsql as $f$
begin
  raise exception 'sai: audit_log is append-only' using errcode = 'P0001';
end
$f$;

create trigger audit_log_no_change before update or delete on audit_log
  for each row execute function audit_log_append_only();

create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function audit_log_append_only();

-- Row-level security (ARCH §4; REQ-115 criteria 1-3): enabled and forced, one policy for sai_app.

alter table orgs enable row level security;
alter table orgs force row level security;
create policy orgs_tenant on orgs for all to sai_app
  using (id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform', 'worker'))
  with check (id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform', 'worker'));

alter table org_members enable row level security;
alter table org_members force row level security;
create policy org_members_tenant on org_members for all to sai_app
  using (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform', 'worker'))
  with check (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform', 'worker'));

alter table invites enable row level security;
alter table invites force row level security;
create policy invites_tenant on invites for all to sai_app
  using (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform', 'worker'))
  with check (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform', 'worker'));

alter table audit_log enable row level security;
alter table audit_log force row level security;
create policy audit_log_insert on audit_log for insert to sai_app with check (true);
create policy audit_log_select on audit_log for select to sai_app
  using (current_setting('app.role', true) = 'platform');

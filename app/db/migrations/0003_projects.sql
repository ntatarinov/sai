-- 0003_projects (REQ-116, REQ-117; the code design M2PROJ, 4.2): organisations and invitations, the consent and
-- deletion tables, projects and their idea versions. Expand-only. The two tenant tables projects and
-- idea_versions have row-level security enabled and forced; user_consents and deletion_requests are global
-- tables (no org_id, no row-level security). Times that a rule reads come from the app's clock as parameters,
-- never from now(): no column of this file has now() as a default. The privileges of the app roles are not set
-- here: they stand in app/db/grants.sql (decisions/0137, O1).

-- Changes of the objects of 0002 (the code design M2PROJ, 4.2.1).

-- An invite names its organisation (a new customer organisation: the owner types the name) and says whether
-- the invited person becomes an owner identity.
alter table invites add column owner_identity boolean not null default false;
alter table invites add column org_name text check (char_length(org_name) between 1 and 120);
alter table invites add constraint invites_org_name_rule check ((org_id is null) = (org_name is not null));

-- The closed audit actions of 0002 and the eight of this work.
alter table audit_log drop constraint audit_log_action_check;
alter table audit_log add constraint audit_log_action_check check (action in ('auth.setup', 'auth.login', 'auth.login_failed', 'auth.logout', 'auth.password_change', 'auth.reauth', 'auth.reauth_failed', 'auth.reset_link_issued', 'auth.reset_used', 'auth.reset_failed', 'auth.totp_enrol', 'auth.totp_confirm', 'auth.totp_recovery_used', 'auth.totp_off', 'invite.create', 'invite.accept', 'account.deletion_request', 'account.delete', 'project.create', 'project.idea_version', 'project.stage', 'admin_read'));

-- The re-auth purposes of 0002 and user_delete.
alter table reauth_tokens drop constraint reauth_tokens_purpose_check;
alter table reauth_tokens add constraint reauth_tokens_purpose_check check (purpose in ('reset_link', 'totp_enrol', 'totp_off', 'dev_start', 'dev_resume', 'worker_token', 'settings', 'kill_switch_off', 'ai_allow', 'codes', 'owner_identity', 'user_delete'));

-- The other half of the owner-organisation rule: the flag of a member of the owner organisation cannot be set
-- to false (the trigger of 0002 on org_members guards the membership side).
create function users_owner_identity_guard() returns trigger language plpgsql as $f$
begin
  if not new.is_owner_identity and exists (select 1 from org_members m join orgs o on o.id = m.org_id where m.user_id = new.id and o.kind = 'owner') then
    raise exception 'sai: a member of the owner organisation must be an owner identity' using errcode = 'P0001';
  end if;
  return new;
end
$f$;

create trigger users_owner_identity_guard before update of is_owner_identity on users
  for each row execute function users_owner_identity_guard();

-- Global tables.

-- The consent record: the digest of the exact sentence shown, its language and the time; no personal value.
create table user_consents (
  user_id uuid primary key references users (id),
  text_sha256 text not null check (text_sha256 ~ '^[0-9a-f]{64}$'),
  lang text not null check (lang in ('ru', 'kk', 'en')),
  accepted_at timestamptz not null
);

-- The deletion requests of users; one open request per user.
create table deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  requested_at timestamptz not null,
  closed_at timestamptz
);

create unique index deletion_requests_one_open on deletion_requests (user_id) where closed_at is null;

-- Tenant tables.

create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id),
  title text not null check (char_length(title) between 1 and 120),
  language text not null check (language in ('ru', 'en')),
  stage text not null default 'draft' check (stage in ('draft', 'interview', 'spec', 'approved', 'dev_requested', 'in_development', 'built', 'delivered', 'accepted', 'returned', 'archived')),
  created_by uuid not null references users (id),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (org_id, id)
);

create index projects_org_stage on projects (org_id, stage);
create index projects_stage_updated on projects (stage, updated_at);

-- Version 1 is the idea as first typed (no reason); every later version has a reason. A version never points
-- into another organisation's project (the composite key).
create table idea_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id),
  project_id uuid not null,
  version integer not null check (version >= 1),
  text text not null check (char_length(text) between 1 and 8000),
  quick_facts jsonb not null check (jsonb_typeof(quick_facts) = 'object'),
  reason text check (char_length(reason) between 1 and 2000),
  created_by uuid not null references users (id),
  created_at timestamptz not null,
  unique (project_id, version),
  foreign key (org_id, project_id) references projects (org_id, id),
  check ((version = 1) = (reason is null))
);

create index idea_versions_org_project on idea_versions (org_id, project_id);

-- Insert-only for every role, the owner included: UPDATE and TRUNCATE are always refused; a DELETE passes only
-- when the transaction-local setting app.purge_org equals the row's organisation (the purge of a deleted
-- organisation's projects, app/server/db/project-store.js purgeOrg; the one exception).
create function idea_versions_insert_only() returns trigger language plpgsql as $f$
begin
  if tg_op = 'DELETE' then
    if current_setting('app.purge_org', true) = old.org_id::text then
      return old;
    end if;
  end if;
  raise exception 'sai: idea_versions is insert-only' using errcode = 'P0001';
end
$f$;

create trigger idea_versions_no_change before update or delete on idea_versions
  for each row execute function idea_versions_insert_only();

create trigger idea_versions_no_truncate before truncate on idea_versions
  for each statement execute function idea_versions_insert_only();

-- Row-level security (the form of org_members, 0002): enabled and forced, one policy for sai_app.

alter table projects enable row level security;
alter table projects force row level security;
create policy projects_tenant on projects for all to sai_app
  using (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform', 'worker'))
  with check (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform', 'worker'));

alter table idea_versions enable row level security;
alter table idea_versions force row level security;
create policy idea_versions_tenant on idea_versions for all to sai_app
  using (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform', 'worker'))
  with check (org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform', 'worker'));

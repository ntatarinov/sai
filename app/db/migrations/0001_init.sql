-- 0001_init (REQ-108): the tables schema_migrations and platform_settings, the group roles sai_app and
-- sai_preview and the login role sai_app_login. Roles belong to the whole server: an existing role is
-- kept as it is (a second database of the same server, decisions/0116 F12). No password here: the
-- runner sets it from APP_DB_PASSWORD (decisions/0116 О24).

create table schema_migrations (
  name text primary key check (name ~ '^[0-9]{4}_[a-z0-9_]+[.]sql$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz not null default now()
);

create table platform_settings (
  key text primary key check (key in ('kill_switch', 'test_mode', 'registration_mode', 'caps', 'timers', 'max_concurrent_builds', 'read_only', 'setup_done')),
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

do $$
begin
  begin
    create role sai_app nologin nosuperuser nobypassrls;
  exception when duplicate_object or unique_violation then null;
  end;
  begin
    create role sai_preview nologin nosuperuser nobypassrls;
  exception when duplicate_object or unique_violation then null;
  end;
  begin
    create role sai_app_login login nosuperuser nobypassrls;
  exception when duplicate_object or unique_violation then null;
  end;
end
$$;

grant sai_app to sai_app_login;
grant sai_preview to sai_app_login;
grant usage on schema public to sai_app, sai_preview;
grant select on schema_migrations to sai_app;

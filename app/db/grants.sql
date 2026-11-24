-- The privileges of the app roles on schema objects (decisions/0137 O1; REQ-115; the code design M2AUTH,
-- 4.2.3 and 4.2.4). app/server/db/migrate.js applies this file after the migration files on every run, in its
-- own transaction, so a restored copy (pg_dump --no-acl) or a moved database gets them back. The privileges of
-- each table stand in one block that runs only when the table exists, so a database built from an older
-- prefix of the migrations gets exactly those of its own tables. Static statements only, no dynamic SQL.

grant usage on schema public to sai_app, sai_preview;
grant select on schema_migrations to sai_app;

do $$ begin
  if to_regclass('public.users') is not null then
    grant select, insert, update on public.users to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.orgs') is not null then
    grant select, insert on public.orgs to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.org_members') is not null then
    grant select, insert, delete on public.org_members to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.invites') is not null then
    grant select, insert, update, delete on public.invites to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.auth_sessions') is not null then
    grant select, insert, update, delete on public.auth_sessions to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.reauth_tokens') is not null then
    grant select, insert, update, delete on public.reauth_tokens to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.password_resets') is not null then
    grant select, insert, update, delete on public.password_resets to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.rate_limits') is not null then
    grant select, insert, update, delete on public.rate_limits to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.login_delays') is not null then
    grant select, insert, update, delete on public.login_delays to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.login_failures') is not null then
    grant select, insert, update, delete on public.login_failures to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.audit_log') is not null then
    grant select, insert on public.audit_log to sai_app;
    grant usage on sequence public.audit_log_id_seq to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.platform_settings') is not null then
    grant select, insert on public.platform_settings to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.projects') is not null then
    grant select, insert, update, delete on public.projects to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.idea_versions') is not null then
    grant select, insert, delete on public.idea_versions to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.deletion_requests') is not null then
    grant select, insert, update on public.deletion_requests to sai_app;
  end if;
end $$;

do $$ begin
  if to_regclass('public.user_consents') is not null then
    grant select, insert on public.user_consents to sai_app;
  end if;
end $$;

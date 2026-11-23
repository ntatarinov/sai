-- The rehearsal seed of 0002_identity.sql (REQ-120 criterion 2; the code design M2AUTH, 6.2): fixed test values
-- in every table this migration creates, at least one row each. Hash-like columns hold 64-hex test values;
-- the two audit rows carry the hashes of the writer's canonical form (app/server/services/audit.js), so the
-- chain of the seeded database verifies.
insert into users (id, email, email_norm, display_name, password_hash, is_platform_admin, is_owner_identity, language, created_at)
values
  ('0a000000-0000-4000-8000-000000000001', 'owner@example.test', 'owner@example.test', 'Seed owner', 'scrypt$17$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', true, true, 'ru', '2026-11-23T09:00:00Z'),
  ('0a000000-0000-4000-8000-000000000002', 'Client@example.test', 'client@example.test', 'Seed client', 'scrypt$17$8$1$BBBBBBBBBBBBBBBBBBBBBB$BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', false, false, 'kk', '2026-11-23T09:00:00Z');

insert into orgs (id, name, kind, ai_allowed, created_by, created_at)
values
  ('0b000000-0000-4000-8000-000000000001', 'Seed owner organisation', 'owner', true, '0a000000-0000-4000-8000-000000000001', '2026-11-23T09:00:00Z'),
  ('0b000000-0000-4000-8000-000000000002', 'Seed client organisation', 'customer', false, '0a000000-0000-4000-8000-000000000001', '2026-11-23T09:00:00Z');

insert into org_members (org_id, user_id, role, created_at)
values
  ('0b000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', 'org_owner', '2026-11-23T09:00:00Z'),
  ('0b000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000002', 'member', '2026-11-23T09:00:00Z');

insert into auth_sessions (id, user_id, token_hash, csrf_hash, created_at, last_seen_at, abs_expires_at, ip_hmac)
values ('0c000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', repeat('1', 64), repeat('2', 64), '2026-11-23T10:01:00Z', '2026-11-23T10:01:00Z', '2026-11-30T10:01:00Z', repeat('c', 64));

insert into reauth_tokens (id, user_id, auth_session_id, purpose, token_hash, created_at, expires_at)
values ('0d000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001', 'reset_link', repeat('3', 64), '2026-11-23T10:02:00Z', '2026-11-23T10:07:00Z');

insert into password_resets (id, user_id, code_hash, created_by, created_at, expires_at)
values ('0e000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000002', repeat('4', 64), '0a000000-0000-4000-8000-000000000001', '2026-11-23T10:03:00Z', '2026-11-23T10:33:00Z');

insert into invites (id, org_id, email_norm, role, code_hash, expires_at, created_by, created_at)
values ('0f000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000002', 'invited@example.test', 'viewer', repeat('5', 64), '2026-11-30T10:00:00Z', '0a000000-0000-4000-8000-000000000001', '2026-11-23T10:04:00Z');

insert into rate_limits (key, window_start, count) values (repeat('6', 64), '2026-11-23T10:00:00Z', 1);

insert into login_delays (key, fails, next_at, updated_at) values (repeat('7', 64), 1, '2026-11-23T10:05:01Z', '2026-11-23T10:05:00Z');

insert into login_failures (key, fails, failed_since, locked_until, updated_at) values (repeat('8', 64), 1, '2026-11-23T10:06:00Z', null, '2026-11-23T10:06:00Z');

select setval('audit_log_id_seq', 2);

insert into audit_log (id, org_id, actor_kind, actor_id, action, target_kind, target_id, ip_hmac, details, prev_hash, hash, created_at)
values
  (1, null, 'admin', '0a000000-0000-4000-8000-000000000001', 'auth.setup', 'user', '0a000000-0000-4000-8000-000000000001', null, '{}'::jsonb, repeat('0', 64), '872bfba11dcfa1957cd1e9ddc9f67ebf3f0afdc2860a7eeb57bdac1337f9dd34', '2026-11-23T10:00:00.000Z'),
  (2, null, 'admin', '0a000000-0000-4000-8000-000000000001', 'auth.login', 'user', '0a000000-0000-4000-8000-000000000001', repeat('c', 64), '{"method": "password", "session_id": "0c000000-0000-4000-8000-000000000001"}'::jsonb, '872bfba11dcfa1957cd1e9ddc9f67ebf3f0afdc2860a7eeb57bdac1337f9dd34', '4c948015ab4816da676f7ba788d598f54d5600c211286871c0e5d6138e7b7a23', '2026-11-23T10:01:00.000Z');

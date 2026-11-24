-- The rehearsal seed of 0003_projects.sql (REQ-120 criterion 2; the code design M2PROJ, 4.2.5): fixed test values
-- in every table this migration creates, at least one row each. It touches no table of 0002, so the counts and
-- the contents of the earlier tables stay as the seed of 0002 left them. Hash-like columns hold 64-hex test
-- values; no e-mail or name of a person.
insert into user_consents (user_id, text_sha256, lang, accepted_at)
values ('0a000000-0000-4000-8000-000000000002', repeat('9', 64), 'ru', '2026-11-24T09:00:00Z');

insert into deletion_requests (id, user_id, requested_at, closed_at)
values ('10000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000002', '2026-11-24T09:30:00Z', null);

insert into projects (id, org_id, title, language, stage, created_by, created_at, updated_at)
values
  ('11000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000001', 'Seed owner project', 'ru', 'draft', '0a000000-0000-4000-8000-000000000001', '2026-11-24T10:00:00Z', '2026-11-24T10:00:00Z'),
  ('11000000-0000-4000-8000-000000000002', '0b000000-0000-4000-8000-000000000002', 'Seed client project', 'en', 'interview', '0a000000-0000-4000-8000-000000000002', '2026-11-24T10:05:00Z', '2026-11-24T10:10:00Z');

insert into idea_versions (id, org_id, project_id, version, text, quick_facts, reason, created_by, created_at)
values
  ('12000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 1, 'Seed owner idea', '{"what": "site", "whom": "customers", "lang": "ru"}'::jsonb, null, '0a000000-0000-4000-8000-000000000001', '2026-11-24T10:00:00Z'),
  ('12000000-0000-4000-8000-000000000002', '0b000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002', 1, 'Seed client idea', '{"what": "app", "whom": "team", "lang": "en"}'::jsonb, null, '0a000000-0000-4000-8000-000000000002', '2026-11-24T10:05:00Z'),
  ('12000000-0000-4000-8000-000000000003', '0b000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002', 2, 'Seed client idea, second version', '{"what": "app", "whom": "team", "lang": "en"}'::jsonb, 'Seed reason', '0a000000-0000-4000-8000-000000000002', '2026-11-24T10:10:00Z');

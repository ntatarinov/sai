-- The rehearsal seed of 0001_init.sql (REQ-120 criterion 2; the code design M2AUTH, 6.2): fixed test values
-- in the tables this migration creates only (schema_migrations is filled by the migration runner).
insert into platform_settings (key, value, updated_at) values ('test_mode', 'true'::jsonb, '2026-11-23T09:00:00Z');

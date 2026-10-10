\set ON_ERROR_STOP on

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '025_convert_automation_resource_ids_to_uuid') THEN
    RAISE EXCEPTION 'migration 025_convert_automation_resource_ids_to_uuid is already applied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '024_add_pub_types') THEN
    RAISE EXCEPTION 'migration 024_add_pub_types must be applied first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_idempotency_keys'
      AND column_name = 'resource_id' AND data_type <> 'text'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_audit_logs'
      AND column_name = 'resource_id' AND data_type <> 'text'
  ) THEN
    RAISE EXCEPTION 'automation resource_id columns must be TEXT before conversion';
  END IF;
  IF EXISTS (
    SELECT 1 FROM automation_idempotency_keys
    WHERE resource_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) OR EXISTS (
    SELECT 1 FROM automation_audit_logs
    WHERE resource_id IS NOT NULL
      AND resource_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'automation resource_id contains a non-UUID value';
  END IF;
END
$migration$;

ALTER TABLE automation_idempotency_keys
  ALTER COLUMN resource_id TYPE UUID USING resource_id::uuid;
ALTER TABLE automation_audit_logs
  ALTER COLUMN resource_id TYPE UUID USING resource_id::uuid;

INSERT INTO schema_migrations (version) VALUES ('025_convert_automation_resource_ids_to_uuid');

COMMIT;

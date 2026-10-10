\set ON_ERROR_STOP on

DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '025_convert_automation_resource_ids_to_uuid') THEN
    RAISE EXCEPTION 'migration 025_convert_automation_resource_ids_to_uuid history is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_idempotency_keys'
      AND column_name = 'resource_id' AND data_type = 'uuid' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'automation_idempotency_keys.resource_id must be UUID NOT NULL';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_audit_logs'
      AND column_name = 'resource_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'automation_audit_logs.resource_id must be nullable UUID';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid IN ('public.automation_idempotency_keys'::regclass, 'public.automation_audit_logs'::regclass)
      AND contype = 'f' AND pg_get_constraintdef(oid) LIKE '%resource_id%'
  ) THEN
    RAISE EXCEPTION 'automation resource_id columns must not reference Resources with foreign keys';
  END IF;
END
$verify$;

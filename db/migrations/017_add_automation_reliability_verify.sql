DO $verify$
BEGIN
  IF to_regclass('public.automation_idempotency_keys') IS NULL
    OR to_regclass('public.automation_audit_logs') IS NULL THEN
    RAISE EXCEPTION 'automation reliability tables are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_idempotency_keys'
      AND column_name = 'resource_id' AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_audit_logs'
      AND column_name = 'resource_id' AND data_type = 'text'
  ) THEN RAISE EXCEPTION 'automation resource ID columns must support quiz IDs'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_idempotency_keys_key_hash_key' AND contype = 'u'
  ) THEN RAISE EXCEPTION 'idempotency unique constraint is missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'automation_idempotency_keys_expires_at_idx'
  ) THEN RAISE EXCEPTION 'idempotency expiry index is missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'automation_audit_logs_resource_idx'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'automation_audit_logs_request_id_idx'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'automation_audit_logs_created_at_idx'
  ) THEN RAISE EXCEPTION 'audit indexes are missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '017_add_automation_reliability') THEN
    RAISE EXCEPTION 'automation reliability migration version is missing';
  END IF;
END
$verify$;

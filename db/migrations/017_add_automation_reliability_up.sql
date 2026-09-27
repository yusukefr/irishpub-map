\set ON_ERROR_STOP on

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '017_add_automation_reliability') THEN
    RAISE EXCEPTION 'migration 017_add_automation_reliability is already applied';
  END IF;
END
$migration$;

CREATE TABLE automation_idempotency_keys (
  id UUID PRIMARY KEY,
  key_hash CHAR(64) NOT NULL UNIQUE,
  request_hash CHAR(64) NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('content', 'quiz', 'pub', 'tag')),
  resource_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  status_code INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  CONSTRAINT automation_idempotency_response_check CHECK (
    (status = 'pending' AND status_code IS NULL AND response_body IS NULL)
    OR (status = 'completed' AND status_code BETWEEN 200 AND 299 AND response_body IS NOT NULL)
  )
);

CREATE INDEX automation_idempotency_keys_expires_at_idx
  ON automation_idempotency_keys (expires_at) WHERE status = 'completed';

CREATE TABLE automation_audit_logs (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL,
  scope TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('content', 'quiz', 'pub', 'tag')),
  resource_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'publish', 'unpublish')),
  result TEXT NOT NULL CHECK (result IN ('success', 'failure')),
  status_code INTEGER NOT NULL CHECK (status_code BETWEEN 100 AND 599),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX automation_audit_logs_created_at_idx ON automation_audit_logs (created_at DESC);
CREATE INDEX automation_audit_logs_resource_idx ON automation_audit_logs (resource_type, resource_id);
CREATE INDEX automation_audit_logs_request_id_idx ON automation_audit_logs (request_id);

INSERT INTO schema_migrations (version) VALUES ('017_add_automation_reliability');

COMMIT;

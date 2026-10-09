\set ON_ERROR_STOP on

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '024_add_pub_types') THEN
    RAISE EXCEPTION 'migration 024_add_pub_types is already applied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '023_remove_resource_uuid_defaults') THEN
    RAISE EXCEPTION 'migration 023_remove_resource_uuid_defaults must be applied first';
  END IF;
  IF to_regclass('public.pub_types') IS NOT NULL
    OR to_regclass('public.pub_type_translations') IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pubs' AND column_name = 'pub_type_code'
    ) THEN
    RAISE EXCEPTION 'Pub Type schema already exists without migration history';
  END IF;
END
$migration$;

CREATE TABLE pub_types (
  code SMALLINT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE CHECK (key IN ('irish', 'british', 'other', 'unclassified'))
);

CREATE TABLE pub_type_translations (
  pub_type_code SMALLINT NOT NULL REFERENCES pub_types(code) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('ja', 'en')),
  display_name TEXT NOT NULL CHECK (btrim(display_name) <> ''),
  PRIMARY KEY (pub_type_code, locale)
);

INSERT INTO pub_types (code, key) VALUES
  (1, 'irish'), (2, 'british'), (3, 'other'), (4, 'unclassified');

INSERT INTO pub_type_translations (pub_type_code, locale, display_name) VALUES
  (1, 'ja', 'アイリッシュパブ'), (1, 'en', 'Irish Pub'),
  (2, 'ja', 'ブリティッシュパブ'), (2, 'en', 'British Pub'),
  (3, 'ja', 'その他のパブ'), (3, 'en', 'Other Pub'),
  (4, 'ja', '未分類'), (4, 'en', 'Unclassified');

ALTER TABLE pubs ADD COLUMN pub_type_code SMALLINT;
UPDATE pubs SET pub_type_code = 4;
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pubs WHERE pub_type_code IS DISTINCT FROM 4) THEN
    RAISE EXCEPTION 'Existing pubs were not initialized as unclassified';
  END IF;
END
$migration$;
ALTER TABLE pubs ADD CONSTRAINT pubs_pub_type_code_fkey FOREIGN KEY (pub_type_code) REFERENCES pub_types(code);
CREATE INDEX pubs_pub_type_code_idx ON pubs (pub_type_code);

INSERT INTO tags (id, key) VALUES (gen_random_uuid(), 'gastropub') ON CONFLICT (key) DO NOTHING;
INSERT INTO tag_translations (tag_id, locale, name)
SELECT id, locale, display_name
FROM tags CROSS JOIN (VALUES ('ja', 'ガストロパブ'), ('en', 'Gastropub')) AS translation(locale, display_name)
WHERE tags.key = 'gastropub'
ON CONFLICT (tag_id, locale) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO schema_migrations (version) VALUES ('024_add_pub_types');

COMMIT;

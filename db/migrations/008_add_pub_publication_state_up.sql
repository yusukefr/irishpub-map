\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM schema_migrations
    WHERE version = '007_finalize_localization'
  ) THEN
    RAISE EXCEPTION 'final localization migration is not applied';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM schema_migrations
    WHERE version = '008_add_pub_publication_state'
  ) THEN
    RAISE EXCEPTION 'migration 008_add_pub_publication_state is already applied';
  END IF;

  -- 現在公開中の全店舗を維持するため、不完全な店舗があればDDL適用前に停止します。
  IF EXISTS (
    SELECT 1
    FROM pubs AS pub
    LEFT JOIN pub_translations AS pub_ja
      ON pub_ja.pub_id = pub.id
      AND pub_ja.locale = 'ja'
    LEFT JOIN prefectures AS prefecture
      ON prefecture.code = pub.prefecture_code
    LEFT JOIN prefecture_translations AS prefecture_ja
      ON prefecture_ja.prefecture_code = prefecture.code
      AND prefecture_ja.locale = 'ja'
    LEFT JOIN municipality_codes AS municipality
      ON municipality.code = pub.municipality_code
      AND municipality.prefecture_code = pub.prefecture_code
    LEFT JOIN municipality_translations AS municipality_ja
      ON municipality_ja.municipality_code = municipality.code
      AND municipality_ja.locale = 'ja'
    LEFT JOIN pub_statuses AS status
      ON status.code = pub.status_code
    LEFT JOIN pub_status_translations AS status_ja
      ON status_ja.status_code = status.code
      AND status_ja.locale = 'ja'
    WHERE NULLIF(btrim(pub_ja.name), '') IS NULL
      OR NULLIF(btrim(pub_ja.address), '') IS NULL
      OR prefecture.code IS NULL
      OR NULLIF(btrim(prefecture_ja.name), '') IS NULL
      OR municipality.code IS NULL
      OR NULLIF(btrim(municipality_ja.name), '') IS NULL
      OR pub.latitude IS NULL
      OR pub.latitude NOT BETWEEN -90 AND 90
      OR pub.longitude IS NULL
      OR pub.longitude NOT BETWEEN -180 AND 180
      OR status.code IS NULL
      OR NULLIF(btrim(status_ja.display_name), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'existing pubs do not satisfy publication requirements';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pub_tags AS pub_tag
    LEFT JOIN tag_translations AS tag_ja
      ON tag_ja.tag_id = pub_tag.tag_id
      AND tag_ja.locale = 'ja'
    WHERE NULLIF(btrim(tag_ja.name), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'assigned tags require Japanese display names before publication';
  END IF;
END $$;

ALTER TABLE pubs
  ADD COLUMN is_published BOOLEAN;

UPDATE pubs
SET is_published = TRUE;

ALTER TABLE pubs
  ALTER COLUMN is_published SET DEFAULT FALSE,
  ALTER COLUMN is_published SET NOT NULL;

INSERT INTO schema_migrations (version)
VALUES ('008_add_pub_publication_state');

COMMIT;

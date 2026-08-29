SELECT
  'draft_nullable_columns' AS check_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pubs'
  AND column_name IN ('prefecture_code', 'municipality_code', 'latitude', 'longitude', 'status_code')
ORDER BY column_name;

SELECT
  'translation_address_column' AS check_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pub_translations'
  AND column_name = 'address';

SELECT
  'translation_address_constraint' AS check_name,
  pg_get_constraintdef(constraint.oid) AS definition
FROM pg_constraint AS constraint
JOIN pg_class AS relation
  ON relation.oid = constraint.conrelid
WHERE relation.relname = 'pub_translations'
  AND constraint.conname = 'pub_translations_address_check';

-- 制約緩和後も、公開中の店舗に下書き相当の欠損が生じていないことを確認します。
SELECT
  'published_drafts' AS check_name,
  COUNT(*) AS count
FROM pubs AS pub
LEFT JOIN pub_translations AS pub_ja
  ON pub_ja.pub_id = pub.id
  AND pub_ja.locale = 'ja'
WHERE pub.is_published
  AND (
    pub.prefecture_code IS NULL
    OR pub.municipality_code IS NULL
    OR pub.latitude IS NULL
    OR pub.longitude IS NULL
    OR pub.status_code IS NULL
    OR NULLIF(btrim(pub_ja.name), '') IS NULL
    OR NULLIF(btrim(pub_ja.address), '') IS NULL
  );

SELECT
  'draft_migration_recorded' AS check_name,
  COUNT(*) AS count
FROM schema_migrations
WHERE version = '009_allow_pub_drafts';

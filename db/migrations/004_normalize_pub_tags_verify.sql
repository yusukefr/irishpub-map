-- 004_normalize_pub_tags_up.sql 適用後に対象 DB で実行する。
SELECT 'tag_count' AS check_name, COUNT(*) AS count FROM tags;
SELECT 'pub_tag_count' AS check_name, COUNT(*) AS count FROM pub_tags;
SELECT 'migration_source_pub_tag_count' AS check_name, source_pub_tag_count AS count
FROM pub_tag_normalization_migration_20260816 WHERE id;
SELECT 'migration_expected_tag_count' AS check_name, distinct_tag_count AS count
FROM pub_tag_normalization_migration_20260816 WHERE id;
SELECT 'migration_expected_pub_tag_count' AS check_name, distinct_pub_tag_count AS count
FROM pub_tag_normalization_migration_20260816 WHERE id;

SELECT 'orphan_pub_tags' AS check_name, COUNT(*) AS count
FROM pub_tags AS pub_tags
LEFT JOIN pubs AS pubs ON pubs.id = pub_tags.pub_id
WHERE pubs.id IS NULL;

SELECT 'orphan_tag_references' AS check_name, COUNT(*) AS count
FROM pub_tags AS pub_tags
LEFT JOIN tags AS tags ON tags.id = pub_tags.tag_id
WHERE tags.id IS NULL;

SELECT 'duplicate_tag_names' AS check_name, COUNT(*) AS count
FROM (SELECT name FROM tags GROUP BY name HAVING COUNT(*) > 1) AS duplicates;

SELECT 'duplicate_pub_tags' AS check_name, COUNT(*) AS count
FROM (SELECT pub_id, tag_id FROM pub_tags GROUP BY pub_id, tag_id HAVING COUNT(*) > 1) AS duplicates;

SELECT 'legacy_tag_column_remaining' AS check_name, COUNT(*) AS count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pub_tags' AND column_name = 'tag';

SELECT 'legacy_pub_tags_backup_count' AS check_name, COUNT(*) AS count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'pub_tags_legacy_20260816';

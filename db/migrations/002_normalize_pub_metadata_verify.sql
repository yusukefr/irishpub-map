-- 002_normalize_pub_metadata_up.sql 適用後に対象 DB で実行する。
SELECT 'prefecture_master_count' AS check_name, COUNT(*) AS count FROM prefectures;
SELECT 'status_master_count' AS check_name, COUNT(*) AS count FROM pub_statuses;
SELECT 'pub_count' AS check_name, COUNT(*) AS count FROM pubs;
SELECT 'pub_tag_count' AS check_name, COUNT(*) AS count FROM pub_tags;
SELECT 'migration_expected_pub_count' AS check_name, pub_count AS count FROM pub_normalization_migration_20260815 WHERE id;
SELECT 'migration_expected_tag_count' AS check_name, distinct_tag_count AS count FROM pub_normalization_migration_20260815 WHERE id;

SELECT 'missing_prefecture_master_rows' AS check_name, COUNT(*) AS count
FROM pubs AS p
LEFT JOIN prefectures AS pref ON pref.code = p.prefecture_code
WHERE pref.code IS NULL;

SELECT 'missing_status_master_rows' AS check_name, COUNT(*) AS count
FROM pubs AS p
LEFT JOIN pub_statuses AS status ON status.code = p.status_code
WHERE status.code IS NULL;

SELECT 'orphan_pub_tags' AS check_name, COUNT(*) AS count
FROM pub_tags AS tags
LEFT JOIN pubs AS p ON p.id = tags.pub_id
WHERE p.id IS NULL;

SELECT 'duplicate_pub_tags' AS check_name, COUNT(*) AS count
FROM (SELECT pub_id, tag FROM pub_tags GROUP BY pub_id, tag HAVING COUNT(*) > 1) AS duplicates;

SELECT 'legacy_columns_remaining' AS check_name, COUNT(*) AS count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pubs' AND column_name IN ('prefecture', 'tags', 'status');

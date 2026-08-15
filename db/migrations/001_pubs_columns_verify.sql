-- 移行後に対象 DB で実行し、件数・ID・主要属性の一致を確認する。
SELECT 'row_count' AS check_name, (SELECT COUNT(*) FROM pubs) AS new_count, (SELECT COUNT(*) FROM pubs_jsonb_legacy_20260815) AS legacy_count;
SELECT 'id_map_count' AS check_name, COUNT(*) AS mapped_count FROM pub_id_migration_map;
SELECT l.id AS legacy_id, m.new_id, p.name, p.prefecture, p.city, p.address, p.latitude, p.longitude, p.status
FROM pubs_jsonb_legacy_20260815 AS l
JOIN pub_id_migration_map AS m ON m.legacy_id = l.id
JOIN pubs AS p ON p.id = m.new_id
ORDER BY l.id;
SELECT 'missing_migrated_rows' AS check_name, COUNT(*) AS count
FROM pubs_jsonb_legacy_20260815 AS l
LEFT JOIN pub_id_migration_map AS m ON m.legacy_id = l.id
LEFT JOIN pubs AS p ON p.id = m.new_id
WHERE p.id IS NULL;
SELECT 'legacy_jsonb_dependency' AS check_name, COUNT(*) AS remaining_columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pubs' AND column_name = 'data';

-- 005_normalize_tag_names_up.sql 適用後に対象DBで実行する。
SELECT 'backup_tag_count' AS check_name, COUNT(*) AS count
FROM tag_name_normalization_backup_20260817;

SELECT 'backup_pub_tag_count' AS check_name, COUNT(*) AS count
FROM tag_name_normalization_pub_tags_backup_20260817;

SELECT 'tag_count' AS check_name, COUNT(*) AS count
FROM tags;

SELECT 'pub_tag_count' AS check_name, COUNT(*) AS count
FROM pub_tags;

SELECT 'remaining_alias_names' AS check_name, COUNT(*) AS count
FROM tags
WHERE btrim(name) IN ('ギネス', '食事あり', '駅近', 'クラフトビール', 'ライブ音楽', 'ウイスキー')
   OR lower(btrim(name)) = 'whisky';

SELECT 'tag_names_with_separators' AS check_name, COUNT(*) AS count
FROM tags
WHERE name <> btrim(name) OR name ~ '[[:space:]_]';

SELECT 'orphan_pub_tags' AS check_name, COUNT(*) AS count
FROM pub_tags
LEFT JOIN pubs ON pubs.id = pub_tags.pub_id
WHERE pubs.id IS NULL;

SELECT 'orphan_tag_references' AS check_name, COUNT(*) AS count
FROM pub_tags
LEFT JOIN tags ON tags.id = pub_tags.tag_id
WHERE tags.id IS NULL;

SELECT 'duplicate_tag_names' AS check_name, COUNT(*) AS count
FROM (SELECT name FROM tags GROUP BY name HAVING COUNT(*) > 1) AS duplicates;

SELECT 'duplicate_pub_tag_names' AS check_name, COUNT(*) AS count
FROM (
  SELECT pub_tags.pub_id, tags.name
  FROM pub_tags
  JOIN tags ON tags.id = pub_tags.tag_id
  GROUP BY pub_tags.pub_id, tags.name
  HAVING COUNT(*) > 1
) AS duplicates;

SELECT 'source_to_current_relation_delta' AS check_name,
  (SELECT COUNT(*) FROM tag_name_normalization_pub_tags_backup_20260817) - (SELECT COUNT(*) FROM pub_tags) AS count;

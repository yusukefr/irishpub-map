SELECT 'pubs_without_ja_translation' AS check_name, COUNT(*) AS count FROM pubs p LEFT JOIN pub_translations pt ON pt.pub_id=p.id AND pt.locale='ja' WHERE pt.pub_id IS NULL;
SELECT 'prefecture_ja_translation_count' AS check_name, COUNT(*) AS count FROM prefecture_translations WHERE locale='ja';
SELECT 'municipality_ja_translation_count' AS check_name, COUNT(*) AS count FROM municipality_translations WHERE locale='ja';
SELECT 'tags_without_ja_translation' AS check_name, COUNT(*) AS count FROM tags t LEFT JOIN tag_translations tt ON tt.tag_id=t.id AND tt.locale='ja' WHERE tt.tag_id IS NULL;
SELECT 'pubs_without_municipality_code' AS check_name, COUNT(*) AS count FROM pubs WHERE municipality_code IS NULL;

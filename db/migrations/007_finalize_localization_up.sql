BEGIN;
INSERT INTO municipality_translations (municipality_code, locale, name)
SELECT m.code, 'ja', pt.name
FROM municipality_codes m
JOIN prefecture_translations pt ON pt.prefecture_code = m.prefecture_code AND pt.locale = 'ja'
WHERE m.municipality_name IS NULL
ON CONFLICT (municipality_code, locale) DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '006_localize_display_data') THEN RAISE EXCEPTION 'localization preparation is not applied'; END IF;
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '007_finalize_localization') THEN RAISE EXCEPTION 'migration 007_finalize_localization is already applied'; END IF;
  IF EXISTS (SELECT 1 FROM pubs p LEFT JOIN pub_translations pt ON pt.pub_id = p.id AND pt.locale = 'ja' WHERE pt.pub_id IS NULL) THEN RAISE EXCEPTION 'Japanese pub translations are incomplete'; END IF;
  IF EXISTS (SELECT 1 FROM prefectures p LEFT JOIN prefecture_translations pt ON pt.prefecture_code = p.code AND pt.locale = 'ja' WHERE pt.prefecture_code IS NULL) THEN RAISE EXCEPTION 'Japanese prefecture translations are incomplete'; END IF;
  IF EXISTS (SELECT 1 FROM municipality_codes m LEFT JOIN municipality_translations mt ON mt.municipality_code = m.code AND mt.locale = 'ja' WHERE mt.municipality_code IS NULL) THEN RAISE EXCEPTION 'Japanese municipality translations are incomplete'; END IF;
  IF EXISTS (SELECT 1 FROM pub_statuses s LEFT JOIN pub_status_translations st ON st.status_code = s.code AND st.locale = 'ja' WHERE st.status_code IS NULL) THEN RAISE EXCEPTION 'Japanese pub status translations are incomplete'; END IF;
  IF EXISTS (SELECT 1 FROM tags t LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = 'ja' WHERE tt.tag_id IS NULL) THEN RAISE EXCEPTION 'Japanese tag translations are incomplete'; END IF;
  IF EXISTS (SELECT 1 FROM pubs WHERE municipality_code IS NULL) THEN RAISE EXCEPTION 'Pub municipality codes are incomplete'; END IF;
END $$;
DROP INDEX IF EXISTS pubs_prefecture_code_name_idx;
DROP INDEX IF EXISTS pubs_prefecture_name_idx;
DROP INDEX IF EXISTS pubs_city_idx;
DROP INDEX IF EXISTS pubs_kana_idx;
ALTER TABLE pubs DROP COLUMN name, DROP COLUMN kana, DROP COLUMN city, DROP COLUMN address;
ALTER TABLE prefectures DROP COLUMN name, DROP COLUMN kana;
ALTER TABLE municipality_codes DROP COLUMN municipality_name, DROP COLUMN municipality_kana;
ALTER TABLE pub_statuses DROP COLUMN value, DROP COLUMN display_name;
ALTER TABLE tags DROP COLUMN name;
CREATE INDEX IF NOT EXISTS pubs_prefecture_code_idx ON pubs (prefecture_code);
CREATE INDEX IF NOT EXISTS pubs_municipality_code_idx ON pubs (municipality_code);
INSERT INTO schema_migrations (version) VALUES ('007_finalize_localization');
COMMIT;

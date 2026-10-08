BEGIN;

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
ALTER TABLE pubs ADD CONSTRAINT pubs_pub_type_code_fkey FOREIGN KEY (pub_type_code) REFERENCES pub_types(code);
CREATE INDEX pubs_pub_type_code_idx ON pubs (pub_type_code);

INSERT INTO tags (key) VALUES ('gastropub') ON CONFLICT (key) DO NOTHING;
INSERT INTO tag_translations (tag_id, locale, name)
SELECT id, locale, display_name
FROM tags CROSS JOIN (VALUES ('ja', 'ガストロパブ'), ('en', 'Gastropub')) AS translation(locale, display_name)
WHERE tags.key = 'gastropub'
ON CONFLICT (tag_id, locale) DO UPDATE SET name = EXCLUDED.name;

COMMIT;

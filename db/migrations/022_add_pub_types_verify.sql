DO $$
DECLARE
  pub_count BIGINT;
  typed_pub_count BIGINT;
BEGIN
  IF (SELECT COUNT(*) FROM pub_types) <> 4 THEN RAISE EXCEPTION 'Pub type master count is invalid'; END IF;
  IF (SELECT COUNT(*) FROM pub_type_translations) <> 8 THEN RAISE EXCEPTION 'Pub type translation count is invalid'; END IF;
  IF EXISTS (
    SELECT 1 FROM pub_types type
    LEFT JOIN pub_type_translations translation ON translation.pub_type_code = type.code
    WHERE translation.pub_type_code IS NULL
  ) THEN RAISE EXCEPTION 'Pub type translations are incomplete'; END IF;
  SELECT COUNT(*) INTO pub_count FROM pubs;
  SELECT COUNT(*) INTO typed_pub_count FROM pubs pub JOIN pub_types type ON type.code = pub.pub_type_code;
  IF pub_count <> typed_pub_count THEN RAISE EXCEPTION 'Pub type foreign key coverage is invalid'; END IF;
  IF EXISTS (SELECT 1 FROM pubs WHERE pub_type_code <> 4) THEN RAISE EXCEPTION 'Existing pubs must remain unclassified'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tags WHERE key = 'gastropub') THEN RAISE EXCEPTION 'Gastropub tag is missing'; END IF;
END $$;

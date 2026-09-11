SELECT
  'draft_nullable_entry_columns' AS check_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'content_entries'
  AND column_name IN ('kind', 'slug', 'category')
ORDER BY column_name;

SELECT
  'content_translation_text_columns' AS check_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'content_translations'
  AND column_name IN ('title', 'summary', 'body_markdown')
ORDER BY column_name;

SELECT
  'remaining_nonempty_translation_checks' AS check_name,
  COUNT(*) AS count
FROM pg_constraint AS con
JOIN pg_class AS relation ON relation.oid = con.conrelid
WHERE relation.relname = 'content_translations'
  AND con.contype = 'c'
  AND pg_get_constraintdef(con.oid) ~ '(title|summary|body_markdown)';

SELECT
  'incomplete_published_content' AS check_name,
  COUNT(*) AS count
FROM content_entries AS entry
LEFT JOIN content_translations AS ja
  ON ja.content_id = entry.id AND ja.locale = 'ja'
LEFT JOIN content_translations AS en
  ON en.content_id = entry.id AND en.locale = 'en'
WHERE entry.status = 'published'
  AND (
    entry.kind IS NULL OR btrim(entry.kind) = ''
    OR entry.slug IS NULL OR btrim(entry.slug) = ''
    OR entry.category IS NULL OR btrim(entry.category) = ''
    OR ja.content_id IS NULL OR btrim(ja.title) = '' OR btrim(ja.summary) = '' OR btrim(ja.body_markdown) = ''
    OR en.content_id IS NULL OR btrim(en.title) = '' OR btrim(en.summary) = '' OR btrim(en.body_markdown) = ''
  );

SELECT
  'editorial_draft_migration_recorded' AS check_name,
  COUNT(*) AS count
FROM schema_migrations
WHERE version = '011_allow_editorial_content_drafts';

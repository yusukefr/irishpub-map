-- Read-only evidence for deciding whether migrations 006 and 007 are reflected
-- in the current schema and data. Run against each Neon branch independently.
-- This intentionally does not require either schema_migrations history row.
WITH checks AS (
  SELECT
    'legacy_localization_columns_absent'::TEXT AS check_name,
    NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'pubs' AND column_name IN ('name', 'kana', 'city', 'address'))
          OR (table_name = 'prefectures' AND column_name IN ('name', 'kana'))
          OR (table_name = 'municipality_codes' AND column_name IN ('municipality_name', 'municipality_kana'))
          OR (table_name = 'pub_statuses' AND column_name IN ('value', 'display_name'))
          OR (table_name = 'tags' AND column_name = 'name')
        )
    ) AS passed,
    (
      SELECT COUNT(*)::TEXT
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'pubs' AND column_name IN ('name', 'kana', 'city', 'address'))
          OR (table_name = 'prefectures' AND column_name IN ('name', 'kana'))
          OR (table_name = 'municipality_codes' AND column_name IN ('municipality_name', 'municipality_kana'))
          OR (table_name = 'pub_statuses' AND column_name IN ('value', 'display_name'))
          OR (table_name = 'tags' AND column_name = 'name')
        )
    ) AS evidence

  UNION ALL
  SELECT 'pubs_municipality_code_filled', NOT EXISTS (SELECT 1 FROM pubs WHERE municipality_code IS NULL),
         (SELECT COUNT(*)::TEXT FROM pubs WHERE municipality_code IS NULL)
  UNION ALL
  SELECT 'pubs_municipality_code_fk', EXISTS (
           SELECT 1 FROM pg_constraint c
           WHERE c.conrelid = 'public.pubs'::regclass AND c.contype = 'f'
             AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (municipality_code) REFERENCES municipality_codes(code)%'
             AND c.convalidated
         ),
         (SELECT COUNT(*)::TEXT FROM pg_constraint c
          WHERE c.conrelid = 'public.pubs'::regclass AND c.contype = 'f'
            AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (municipality_code) REFERENCES municipality_codes(code)%'
            AND c.convalidated)
  UNION ALL
  SELECT 'pubs_municipality_code_index', EXISTS (
           SELECT 1 FROM pg_index i
           WHERE i.indexrelid = to_regclass('public.pubs_municipality_code_idx')
             AND i.indisvalid AND i.indisready
             AND pg_get_indexdef(i.indexrelid) = 'CREATE INDEX pubs_municipality_code_idx ON public.pubs USING btree (municipality_code)'
         ),
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_index i
           WHERE i.indexrelid = to_regclass('public.pubs_municipality_code_idx')
             AND i.indisvalid AND i.indisready
             AND pg_get_indexdef(i.indexrelid) = 'CREATE INDEX pubs_municipality_code_idx ON public.pubs USING btree (municipality_code)'
         ) THEN 'valid btree (municipality_code)' ELSE 'missing, invalid, or definition mismatch' END

  UNION ALL
  SELECT 'pub_translation_ja_coverage', NOT EXISTS (
           SELECT 1 FROM pubs p LEFT JOIN pub_translations pt
             ON pt.pub_id = p.id AND pt.locale = 'ja' WHERE pt.pub_id IS NULL
         ),
         (SELECT COUNT(*)::TEXT FROM pubs p LEFT JOIN pub_translations pt
          ON pt.pub_id = p.id AND pt.locale = 'ja' WHERE pt.pub_id IS NULL)
  UNION ALL
  SELECT 'pub_translation_orphans_absent', NOT EXISTS (
           SELECT 1 FROM pub_translations pt LEFT JOIN pubs p ON p.id = pt.pub_id WHERE p.id IS NULL
         ),
         (SELECT COUNT(*)::TEXT FROM pub_translations pt LEFT JOIN pubs p ON p.id = pt.pub_id WHERE p.id IS NULL)
  UNION ALL
  SELECT 'prefecture_translation_ja_coverage', NOT EXISTS (
           SELECT 1 FROM prefectures p LEFT JOIN prefecture_translations pt
             ON pt.prefecture_code = p.code AND pt.locale = 'ja' WHERE pt.prefecture_code IS NULL
         ),
         (SELECT COUNT(*)::TEXT FROM prefectures p LEFT JOIN prefecture_translations pt
          ON pt.prefecture_code = p.code AND pt.locale = 'ja' WHERE pt.prefecture_code IS NULL)
  UNION ALL
  SELECT 'municipality_translation_ja_coverage', NOT EXISTS (
           SELECT 1 FROM municipality_codes m LEFT JOIN municipality_translations mt
             ON mt.municipality_code = m.code AND mt.locale = 'ja' WHERE mt.municipality_code IS NULL
         ),
         (SELECT COUNT(*)::TEXT FROM municipality_codes m LEFT JOIN municipality_translations mt
          ON mt.municipality_code = m.code AND mt.locale = 'ja' WHERE mt.municipality_code IS NULL)
  UNION ALL
  SELECT 'status_translation_ja_coverage', NOT EXISTS (
           SELECT 1 FROM pub_statuses s LEFT JOIN pub_status_translations st
             ON st.status_code = s.code AND st.locale = 'ja' WHERE st.status_code IS NULL
         ),
         (SELECT COUNT(*)::TEXT FROM pub_statuses s LEFT JOIN pub_status_translations st
          ON st.status_code = s.code AND st.locale = 'ja' WHERE st.status_code IS NULL)
  UNION ALL
  SELECT 'tag_translation_ja_coverage', NOT EXISTS (
           SELECT 1 FROM tags t LEFT JOIN tag_translations tt
             ON tt.tag_id = t.id AND tt.locale = 'ja' WHERE tt.tag_id IS NULL
         ),
         (SELECT COUNT(*)::TEXT FROM tags t LEFT JOIN tag_translations tt
          ON tt.tag_id = t.id AND tt.locale = 'ja' WHERE tt.tag_id IS NULL)
  UNION ALL
  SELECT 'tag_translation_orphans_absent', NOT EXISTS (
           SELECT 1 FROM tag_translations tt LEFT JOIN tags t ON t.id = tt.tag_id WHERE t.id IS NULL
         ),
         (SELECT COUNT(*)::TEXT FROM tag_translations tt LEFT JOIN tags t ON t.id = tt.tag_id WHERE t.id IS NULL)
  UNION ALL
  SELECT 'translation_foreign_keys_present', (
           SELECT COUNT(*) = 5
           FROM pg_constraint c
           WHERE c.contype = 'f'
             AND (c.conrelid, pg_get_constraintdef(c.oid)) IN (
               ('public.pub_translations'::regclass, 'FOREIGN KEY (pub_id) REFERENCES pubs(id) ON DELETE CASCADE'),
               ('public.prefecture_translations'::regclass, 'FOREIGN KEY (prefecture_code) REFERENCES prefectures(code) ON DELETE CASCADE'),
               ('public.municipality_translations'::regclass, 'FOREIGN KEY (municipality_code) REFERENCES municipality_codes(code) ON DELETE CASCADE'),
               ('public.pub_status_translations'::regclass, 'FOREIGN KEY (status_code) REFERENCES pub_statuses(code) ON DELETE CASCADE'),
               ('public.tag_translations'::regclass, 'FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE')
             )
             AND c.convalidated
         ),
         (SELECT COUNT(*)::TEXT
          FROM pg_constraint c
          WHERE c.contype = 'f'
            AND (c.conrelid, pg_get_constraintdef(c.oid)) IN (
              ('public.pub_translations'::regclass, 'FOREIGN KEY (pub_id) REFERENCES pubs(id) ON DELETE CASCADE'),
              ('public.prefecture_translations'::regclass, 'FOREIGN KEY (prefecture_code) REFERENCES prefectures(code) ON DELETE CASCADE'),
              ('public.municipality_translations'::regclass, 'FOREIGN KEY (municipality_code) REFERENCES municipality_codes(code) ON DELETE CASCADE'),
              ('public.pub_status_translations'::regclass, 'FOREIGN KEY (status_code) REFERENCES pub_statuses(code) ON DELETE CASCADE'),
              ('public.tag_translations'::regclass, 'FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE')
            )
            AND c.convalidated)
  UNION ALL
  SELECT 'translation_primary_keys_present', (
           SELECT COUNT(*) = 5 FROM pg_constraint c
           WHERE c.contype = 'p'
             AND (c.conrelid, pg_get_constraintdef(c.oid)) IN (
               ('public.pub_translations'::regclass, 'PRIMARY KEY (pub_id, locale)'),
               ('public.prefecture_translations'::regclass, 'PRIMARY KEY (prefecture_code, locale)'),
               ('public.municipality_translations'::regclass, 'PRIMARY KEY (municipality_code, locale)'),
               ('public.pub_status_translations'::regclass, 'PRIMARY KEY (status_code, locale)'),
               ('public.tag_translations'::regclass, 'PRIMARY KEY (tag_id, locale)')
             )
         ),
         (SELECT COUNT(*)::TEXT FROM pg_constraint c
          WHERE c.contype = 'p'
            AND (c.conrelid, pg_get_constraintdef(c.oid)) IN (
              ('public.pub_translations'::regclass, 'PRIMARY KEY (pub_id, locale)'),
              ('public.prefecture_translations'::regclass, 'PRIMARY KEY (prefecture_code, locale)'),
              ('public.municipality_translations'::regclass, 'PRIMARY KEY (municipality_code, locale)'),
              ('public.pub_status_translations'::regclass, 'PRIMARY KEY (status_code, locale)'),
              ('public.tag_translations'::regclass, 'PRIMARY KEY (tag_id, locale)')
            ))
  UNION ALL
  SELECT 'translation_locale_name_unique_constraints_present', (
           SELECT COUNT(*) = 2 FROM pg_constraint c
           WHERE c.contype = 'u'
             AND (c.conrelid, pg_get_constraintdef(c.oid)) IN (
               ('public.prefecture_translations'::regclass, 'UNIQUE (locale, name)'),
               ('public.tag_translations'::regclass, 'UNIQUE (locale, name)')
             )
         ),
         (SELECT COUNT(*)::TEXT FROM pg_constraint c
          WHERE c.contype = 'u'
            AND (c.conrelid, pg_get_constraintdef(c.oid)) IN (
              ('public.prefecture_translations'::regclass, 'UNIQUE (locale, name)'),
              ('public.tag_translations'::regclass, 'UNIQUE (locale, name)')
            ))

  UNION ALL
  SELECT 'status_key_populated_unique',
         NOT EXISTS (SELECT 1 FROM pub_statuses WHERE key IS NULL)
           AND NOT EXISTS (SELECT key FROM pub_statuses GROUP BY key HAVING COUNT(*) > 1),
         format('null=%s, duplicate_keys=%s',
           (SELECT COUNT(*) FROM pub_statuses WHERE key IS NULL),
           (SELECT COUNT(*) FROM (SELECT key FROM pub_statuses GROUP BY key HAVING COUNT(*) > 1) d))
  UNION ALL
  SELECT 'pub_statuses_key_not_null_constraint', EXISTS (
           SELECT 1 FROM pg_attribute
           WHERE attrelid = 'public.pub_statuses'::regclass AND attname = 'key'
             AND attnotnull AND NOT attisdropped
         ),
         COALESCE((SELECT attnotnull::TEXT FROM pg_attribute
                   WHERE attrelid = 'public.pub_statuses'::regclass AND attname = 'key'
                     AND NOT attisdropped), 'missing')
  UNION ALL
  SELECT 'tag_key_populated_unique',
         NOT EXISTS (SELECT 1 FROM tags WHERE key IS NULL)
           AND NOT EXISTS (SELECT key FROM tags GROUP BY key HAVING COUNT(*) > 1),
         format('null=%s, duplicate_keys=%s',
           (SELECT COUNT(*) FROM tags WHERE key IS NULL),
           (SELECT COUNT(*) FROM (SELECT key FROM tags GROUP BY key HAVING COUNT(*) > 1) d))
  UNION ALL
  SELECT 'tags_key_not_null_constraint', EXISTS (
           SELECT 1 FROM pg_attribute
           WHERE attrelid = 'public.tags'::regclass AND attname = 'key'
             AND attnotnull AND NOT attisdropped
         ),
         COALESCE((SELECT attnotnull::TEXT FROM pg_attribute
                   WHERE attrelid = 'public.tags'::regclass AND attname = 'key'
                     AND NOT attisdropped), 'missing')
  UNION ALL
  SELECT 'pub_statuses_key_unique_constraint', EXISTS (
           SELECT 1 FROM pg_constraint WHERE conrelid = 'public.pub_statuses'::regclass
             AND conname = 'pub_statuses_key_unique' AND contype = 'u'
         ),
         (SELECT COUNT(*)::TEXT FROM pg_constraint WHERE conrelid = 'public.pub_statuses'::regclass
           AND conname = 'pub_statuses_key_unique' AND contype = 'u')
  UNION ALL
  SELECT 'tags_key_unique_constraint', EXISTS (
           SELECT 1 FROM pg_constraint WHERE conrelid = 'public.tags'::regclass
             AND conname = 'tags_key_unique' AND contype = 'u'
         ),
         (SELECT COUNT(*)::TEXT FROM pg_constraint WHERE conrelid = 'public.tags'::regclass
           AND conname = 'tags_key_unique' AND contype = 'u')
  UNION ALL
  SELECT 'pubs_prefecture_code_index', EXISTS (
           SELECT 1 FROM pg_index i
           WHERE i.indexrelid = to_regclass('public.pubs_prefecture_code_idx')
             AND i.indisvalid AND i.indisready
             AND pg_get_indexdef(i.indexrelid) = 'CREATE INDEX pubs_prefecture_code_idx ON public.pubs USING btree (prefecture_code)'
         ),
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_index i
           WHERE i.indexrelid = to_regclass('public.pubs_prefecture_code_idx')
             AND i.indisvalid AND i.indisready
             AND pg_get_indexdef(i.indexrelid) = 'CREATE INDEX pubs_prefecture_code_idx ON public.pubs USING btree (prefecture_code)'
         ) THEN 'valid btree (prefecture_code)' ELSE 'missing, invalid, or definition mismatch' END

  UNION ALL
  SELECT 'migration_006_history_present', EXISTS (
           SELECT 1 FROM schema_migrations WHERE version = '006_localize_display_data'
         ),
         (SELECT COUNT(*)::TEXT FROM schema_migrations WHERE version = '006_localize_display_data')
  UNION ALL
  SELECT 'migration_007_history_present', EXISTS (
           SELECT 1 FROM schema_migrations WHERE version = '007_finalize_localization'
         ),
         (SELECT COUNT(*)::TEXT FROM schema_migrations WHERE version = '007_finalize_localization')
)
SELECT check_name, passed, evidence
FROM checks
ORDER BY check_name;

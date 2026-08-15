-- 事前確認後にのみ実行する。現在の独立カラムを退避し、旧 JSONB テーブルを pubs に戻す。
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.pubs_jsonb_legacy_20260815') IS NULL THEN
    RAISE EXCEPTION 'legacy pubs backup is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pubs' AND column_name = 'data') THEN
    RAISE EXCEPTION 'public.pubs is already the legacy schema';
  END IF;
END
$$;
ALTER TABLE pubs RENAME TO pubs_columns_rolled_back_20260815;
ALTER TABLE pubs_jsonb_legacy_20260815 RENAME TO pubs;
COMMIT;

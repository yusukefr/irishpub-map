-- 003の適用後に市区町村コードを参照するアプリを停止してから実行します。
BEGIN;

DROP TABLE IF EXISTS municipality_codes;

COMMIT;

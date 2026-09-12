# 既存GuideのContent Data Migration

Issue #380の専用CLIで、[棚卸し](../specs/editorial-guide-migration-inventory.md)済みの`sample` / `split-the-g`を日英まとめてNeonへ投入します。スキーマMigration 010 / 011の適用が前提です。公開Routeは引き続き既存MDXを使用し、取得元切替はIssue #381で実施します。

## 入力と変換

- 対象は2 Guide・4 MDXです。ファイル集合が増減した場合は停止し、再棚卸しを必要とします。
- MDXはremark-mdxで構文解析するだけで、compile、import、JavaScript評価はしません。metadataは既知キーの文字列・文字列配列リテラルだけを読み取ります。
- 全ファイルはLevel Bで、先頭のmetadata exportと直後の区切り改行だけを除きます。本文は末尾改行を含め保持し、既存リンクを変更しません。標準Markdown本文（Level A相当）の変換は不要です。
- JSX、式、追加export/import、Raw HTML、未対応Markdown要素は削除せず拒否します。現在Rendererが描画しない画像とtask listも拒否します。コードブロックやinline codeは表示用テキストとして保持し、実行しません。
- URLはRendererと同様にHTTP(S)、ルート相対（`//`を除く）、ページ内アンカーを許可します。
- localeごとのtitle / summary / bodyを同一Entryの翻訳として保存し、slug / kind / category / publishedAt / tagsの日英一致を確認します。
- 既存公開対象である`sample`も含めて`published`として投入します。`publishedAt`は日付文字列をUTC 00:00のTIMESTAMPTZへ変換し、元の日付を保持します。IDと作成・更新日時はDBのDEFAULTを使用します。
- MDXの`tags`は未使用でEditorial Contentに保存先がないため、検証後に明示的に除外します。店舗用タグには投入しません。ログにも除外を表示します。

## コマンド

Node.js 24と`npm ci`（開発依存を含む）が必要です。リポジトリルートから実行します。

```bash
# DBに接続せず、全ソースの抽出とValidation
node scripts/migrate-editorial-guides.mjs --validate

# 接続先を明示し、追加予定 / 完全一致skip / 不一致errorを確認
node scripts/migrate-editorial-guides.mjs --dry-run

# 全Guideを単一transactionで投入
node scripts/migrate-editorial-guides.mjs --apply

# DBを読み取り、移行元と全項目を照合
node scripts/migrate-editorial-guides.mjs --verify
```

DB操作には`MIGRATION_DATABASE_URL`が必須です。`DATABASE_URL`や`.env.local`への暗黙のfallbackはありません。接続先を確認したうえで、実行環境からDirect / Unpooled接続を渡してください。Pooled hostname（`-pooler`）は拒否します。接続文字列はコマンド引数やログへ出さず、承認済みの秘密情報管理方法を利用します。

## 既存Contentと再実行

`(kind, slug)`でEntryを検索し、category / status / publishedAtと日英2件のtitle / summary / 本文を照合します。完全一致は`SKIP`、未登録は`WOULD_ADD`（dry-run）または`ADDED`（apply）です。既存値に差異や翻訳不足があればエラーとなり、上書き・補完は行いません。再実行でIDやupdated_atも変わりません。作成時刻やIDは元MDXにないため、原文比較の対象外です。

applyでは比較からINSERT完了まで両テーブルの更新をロックし、同時移行や管理更新との競合を防ぎます。共有テーブルの管理更新が短時間待機するため、編集が少ない時間帯に実行してください。ロック待機上限は5秒、各statement上限は30秒です。全Guideの処理と投入直後の照合が成功したときだけcommitし、後半のGuideや英語翻訳が失敗しても全件rollbackします。dry-run / verifyは読み取り専用の一貫したsnapshotを使います。

DB例外の生データは秘密情報を含む可能性があるため表示しません。Validationエラーは対象ファイルと理由、DB不一致はslugを表示します。接続エラー時は認証・Direct接続・スキーマを確認し、ロックtimeout時は他の編集完了後にdry-runから再実行します。不一致時は管理編集済みの可能性があるため、内容を別途確認して移行方針を決めてください。CLIには強制上書きオプションを設けません。

## 非Production Branchでの検証

1. 接続先がProductionと異なるNeon Branchであることと、Direct接続であることを確認する。
2. `--validate`、`--dry-run`を実行して対象2 Guide / 日英各2件、追加予定、差分なしを確認する。
3. `--apply`、`--verify`を実行する。本文を含め4翻訳が原文と一致することを確認する。
4. `--apply`を再実行し、2件とも`SKIP`となることを確認する。
5. 明示した非Production接続で以下の統合テストを実行する。

```bash
# MIGRATION_TEST_DATABASE_URLにDirect接続を設定したプロセスで実行
npm exec -- vitest run tests/editorial-guide-migration-db.test.ts

# MIGRATION_VERIFY_DATABASE_URLに移行済みBranch接続を設定したプロセスで実行
npm exec -- vitest run tests/web/editorial-guide-migration-renderer.test.tsx
```

前者はスキーマを複製した接続専用TEMP TABLEで再実行とrollbackを検証し、実Contentを変更しません。接続終了でTEMP TABLEは消えます。後者は実際の公開Repositoryから4翻訳を読み取り、metadata・本文・日付を比較し、Safe Markdown RendererでParagraph・Heading・List・Linkを確認します。接続変数がない通常CIではDB統合部分をskipし、ソース検証とRendererテストを実行します。

## Production適用前の判断

Branchでのdry-run / apply / verify / 再実行 / rollback / Repository・Renderer確認が成功した記録と、追加予定件数、既存値との差分を確認してから別途Production適用を判断します。このIssueでProductionデータ投入は行いません。将来の適用直前にも最新MDXを検証し、Production接続に対してdry-runで競合がないことを確認してください。

既存MDXと固定loaderはRollback Sourceとして残します。公開取得元の切替やMDX削除は後続Issueに分離します。

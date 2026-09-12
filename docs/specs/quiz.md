# Today's Ireland Quiz データ仕様

## 概要

`/discover/quiz`は、移行完了まではRepository内の`apps/web/data/ireland/quiz.json`からAsia/Tokyo基準の「今日の1問」を表示します。ユーザー登録、回答履歴、長期スコアは使用しません。

マイグレーション012はQuiz Domain Schemaを定義し、Issue #390はNeonアクセスをQuiz Repositoryへ集約します。Quizデータの投入はIssue #391、Public QuizのNeon切替はIssue #393で行うため、Repository追加後も現在の画面挙動とSource of Truthは引き続きこのJSONです。

マイグレーション012のDB Schemaは入力途中のDraftを許容します。Category・正解・SourceはNULL、翻訳は未作成または空文字、Choiceは0件から保存できます。Publishedへの変更時はIssue #390のRepositoryがこのJSON仕様と同等の必須項目をDB内で再検証し、Issue #392の管理APIは入力Validationと認可を担当します。

データは`apps/web/app/lib/quiz/data.ts`で起動時に検証され、`apps/web/app/lib/quiz/queries.ts`が日次選択と採点を担当します。

## Quiz Repository

`apps/web/app/lib/quiz/repository.ts`はQuiz DomainのNeonアクセスを所有します。Public取得はSQLで`is_published = TRUE`を固定し、指定Localeの翻訳を優先して日本語へフォールバックします。回答前の`PublicQuizQuestion`はQuestion・Category・Special Date・Choiceだけを持ち、正解、解説、Source、Related Contentを含みません。

日次取得はRepositoryが検証した公開問題集合を既存Domain Logicへ渡し、Asia/Tokyoの暦日、Special Date優先、決定的選択を維持します。採点は公開Questionと送信Choiceをparameterized queryで確認した後にだけ回答情報を返します。Related Contentは公開Content Repositoryで解決し、未登録・Draft・翻訳不足・取得障害時は採点結果を維持して導線だけを省略します。

Admin取得はDraftとPublishedの両方を返します。作成・全体更新はQuestion本体、日英翻訳、Choiceと各翻訳を単一transactionで保存し、公開操作は行ロック後にCategory・正解・Source・日英翻訳・4 ChoicesをDB内で再検証します。DB行はCategory、日付、URL、UUID、Choice件数・順序を検証し、不正値をSilentにDomain Modelへ変換しません。

`DATABASE_URL`未設定時は一覧を空、ID指定取得を`null`とし、更新と採点は設定エラーにします。静的JSONへのfallbackは行いません。既存画面とServer ActionのRepository切替はIssue #393で行います。

## ルート構造

```json
{
  "schemaVersion": 1,
  "country": "IE",
  "categories": {},
  "questions": []
}
```

- `schemaVersion`: 現在は`1`固定
- `country`: `IE`固定
- `categories`: 定義済みカテゴリIDをキーに、絵文字と日英表示名を保持
- `questions`: JSON記載順の問題一覧

## 問題

```json
{
  "id": "irish-sports-gaelic-games-001",
  "category": "irish-sports",
  "specialDate": {
    "month": 3,
    "day": 17
  },
  "question": {
    "ja": "問題文",
    "en": "Question"
  },
  "choices": [
    {
      "id": "choice-id",
      "label": {
        "ja": "選択肢",
        "en": "Choice"
      }
    }
  ],
  "answer": "choice-id",
  "explanation": {
    "ja": "解説",
    "en": "Explanation"
  },
  "source": {
    "label": {
      "ja": "情報源名",
      "en": "Source name"
    },
    "url": "https://example.com/source"
  },
  "relatedGuide": {
    "slug": "guide-slug",
    "label": {
      "ja": "関連Guide",
      "en": "Related guide"
    }
  }
}
```

- `id`は全問題で一意にします。
- `category`は定義済みのLocale非依存IDを指定します。
- `question`、全選択肢の`label`、`explanation`、`source.label`は日本語と英語を必須とします。
- `choices`は4件とし、各`id`は問題内で一意にします。
- `answer`は同じ問題内に存在するchoice IDを指定します。
- `source.url`は根拠を確認できる公式・一次情報のHTTPS URLを指定します。
- `specialDate`は任意です。指定した月日に一致する問題は通常の日次ローテーションより優先されます。
- `relatedGuide`は任意です。slugは安全なkebab-case形式を必須とし、回答後は公開Guide Routeへの導線として使用します。公開可否と存在判定のSource of TruthはNeonの公開Content Repositoryであり、Static Registryには複製しません。未登録・削除・Draft・Translation不足、またはRepositoryの取得障害により公開Guideを取得できない場合、採点結果は表示して関連Guide導線だけを返しません。

## 日次選択

Asia/Tokyoの年月日をUTC上の通算日数へ変換し、問題数で剰余を取って決定します。このため、同じ問題データと日付であれば再読み込み、端末、ブラウザ、Localeにかかわらず同じ問題になります。

`specialDate`に一致する問題が1件以上ある場合は、一致した問題集合を優先して同じ方法で決定します。

通常日は、記念日の前後で同じ問題が連続しないよう、`specialDate`を持たない問題だけをローテーションします。通常問題が1件もないデータセットでは、表示不能を避けるため全問題を候補へ戻します。

## 回答情報の公開

Server ComponentからClient Componentへ渡す情報は、問題ID、カテゴリ、問題文、選択肢だけです。`answer`、`explanation`、`source`、`relatedGuide`は回答前のpropsとDOMへ含めず、Server Actionでchoice IDを検証・採点した後に返します。

回答後は選択肢を無効化し、同じ画面上で回答状態を変更できないようにします。回答履歴は永続化しないため、ページを再読み込みすると未回答状態へ戻ります。

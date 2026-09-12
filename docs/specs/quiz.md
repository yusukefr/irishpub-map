# Today's Ireland Quiz データ仕様

## 概要

`/discover/quiz`は、Repository内の`apps/web/data/ireland/quiz.json`からAsia/Tokyo基準の「今日の1問」を表示します。DB、ユーザー登録、回答履歴、長期スコアは使用しません。

データは`apps/web/app/lib/quiz/data.ts`で起動時に検証され、`apps/web/app/lib/quiz/queries.ts`が日次選択と採点を担当します。

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

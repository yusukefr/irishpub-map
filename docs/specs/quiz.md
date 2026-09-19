# Today's Ireland Quiz データ仕様

## 概要

/discover/quiz は、Quiz Repository経由でNeonのPublished QuestionからAsia/Tokyo基準の「今日の1問」を表示します。QuizのQuestionとChoiceのSource of TruthはNeon PostgreSQLです。ユーザー登録、回答履歴、長期スコアは使用しません。

Issue #391で旧JSONからNeonへの一度限りのData Migrationを実施し、Issue #393でPublic Quizの取得経路をNeonへ切り替え、Issue #394で旧JSONとMigration Artifactを削除しました。

## Domain Model

Quizは quiz_questions、quiz_question_translations、quiz_choices、quiz_choice_translations の4テーブルで管理します。QuestionはCategory、Special Date、Correct Choice、Source URL、Related Content、公開状態を持ち、各QuestionとChoiceはja/en翻訳を持ちます。

Question IDはServerが `randomUUID()` で生成し、UUID移行の完了までは既存のkebab-case IDと新しいUUIDの両方を読み書きできます。作成・更新時にClientから指定できず、作成後は不変です。Choice IDはQuestion内で一意なkebab-case識別子です。CategoryはQUIZ_CATEGORIESのAllow Listに限定し、表示用のicon・日英labelは apps/web/app/lib/quiz/categories.ts で定義します。Category MasterをDBへ複製せず、Allow Listと表示定義の全キーが一致することをTestします。

Published Questionは4 Choice、正解、日英のQuestion・Explanation・Source Label、HTTPSのSource URLを必須とします。Draftは入力途中の値を許容しますが、Public取得対象はPublishedだけです。AdminのPublish処理はRepositoryとDB内の条件で再検証します。

## Quiz Repository

apps/web/app/lib/quiz/repository.ts がQuiz DomainのNeonアクセスを所有します。Public取得は回答前DTOへ変換し、Correct Choice、Explanation、Source、Related Contentを含めません。DraftはPublicへ返しません。

日次取得はRepositoryが検証したPublished Question集合をpureなDomain Logicへ渡します。採点は公開Questionと送信Choiceの所属を確認した後にだけ回答情報を返します。Related Contentの取得障害や不完全なContentでは、採点結果を維持して導線だけを省略します。

## Category Presentation

Category IDのSource of TruthはQUIZ_CATEGORIESです。iconと日英labelはApplication CodeのQUIZ_CATEGORY_DEFINITIONSに保持し、Question DataやDBへ複製しません。全Categoryに表示定義があり、余分な定義がなく、icon・labelが空でないことをTestします。

## 日次選択

getQuizDateInTokyo()はAsia/Tokyoの年月日を返します。selectDailyQuiz(date, questions)はDBやファイルを直接参照しないpure logicで、受け取ったPublished Question集合と日付から決定的に1問を選びます。同じ集合・同じ日付であれば、Localeや再読み込みにかかわらず同じQuestion IDになります。

specialDateに一致する問題が1件以上ある場合は優先して選択します。通常日はspecialDateを持たない問題だけをローテーションし、通常問題がない場合は全Questionへfallbackします。特殊日対象が複数ある場合も日付と集合から決定的に選びます。

## 回答情報の公開

Server ComponentからClient Componentへ渡す情報は、Question ID、Category、問題文、Choiceだけです。Correct Choice、Explanation、Source、Related Contentは回答前のprops・HTML・serialized dataへ含めません。

submitQuizAnswer()はServer-sideのgradePublishedQuizAnswer()を呼び、QuestionとChoiceの所属およびPublished状態を検証した後に回答結果を返します。UUID移行の完了まではQuestion IDの既存kebab-caseとUUIDを受け付け、Choice IDはkebab-caseと最大長をServer Actionで検証します。

回答後は選択肢を無効化し、回答履歴は永続化しないため、ページを再読み込みすると未回答状態へ戻ります。

## 管理とCache

Admin Quizは /admin/quiz、/admin/quiz/new、/admin/quiz/:id で認証済みユーザーがDraftとPublishedを管理します。作成・全体更新はQuestion本体、日英翻訳、Choiceを単一transactionで保存します。PublishとUnpublishは更新成功後にPublic Quiz Cacheを失効させます。

Published Question一覧だけをLocale単位でunstable_cacheにより5分間Cacheします。Asia/Tokyoの日付決定はCacheの外で行います。Draftの変更、状態変更なし、更新失敗ではCacheを失効させません。

DATABASE_URL未設定時はPublic Quizを利用不可状態、Published Questionが0件の場合は空状態として表示します。DB障害時も別のStatic Dataへfallbackせず、利用者には一般化したエラーだけを表示します。

## E2EとMigration履歴

E2EはProduction DBを使わず、E2E_TEST_MODEのfixtureでPublic・Admin・採点を検証します。Draft QuestionはPublic fixtureからも除外します。

旧JSONからNeonへの一度限りのData MigrationはIssue #391で実施済みです。移行対象は9 Questions、36 Choicesで、PreviewとProductionのRead-only Dry Runで完全移行済みを確認しました。Migration Scriptと旧JSONはIssue #394で削除し、移行の経緯はIssue #391とGit履歴で確認できます。Question IDのUUID化と参照列の変換は、既存アプリケーションとの互換性を確認した後続Migrationで実施します。Migration適用前後のDeployment順序と既存参照の検証を分けて行い、通常のDeploymentで自動実行しません。

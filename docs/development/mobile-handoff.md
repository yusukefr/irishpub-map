# Mobile 実装引き継ぎガイド

Mobile対応Issueへ着手するときの入口です。仕様本文を複製せず、確認する順番と判断の根拠を案内します。現行動作は実装・テスト、公開契約はCurrent文書を確認し、親Issue #521と各実装Issueに書かれた将来案を現行仕様として扱わないでください。

## 最初に読む資料

1. 親Issue #521でMVPと対象外を確認します。MVPは日本語/英語、Pub一覧・地図・Marker、検索・都道府県/タグFilter、詳細、Foreground現在地、外部リンクです。Admin、Content/Quiz/Calendar/Media管理、User Account、Cloud同期、お気に入り同期、Push通知、Offline Map、Background Location、Navigationは対象外です。ここに書かれた内容が現行契約と異なる場合は、実装・Current文書を優先し、親Issueの更新を提案します。
2. [Mobile Architecture](../architecture/mobile.md)、[System Overview](../architecture/system-overview.md)、[Sequences](../architecture/sequences.md)、[API仕様](../specs/api.md)、[店舗データ仕様](../specs/data.md)、[OpenAPI](../specs/openapi/openapi.yaml)を読み、既存の責務と契約を確認します。Expo / React NativeのVersion、MapLibre、Development Buildの方針はMobile ArchitectureをSource of Truthとします。
3. [テスト戦略](testing.md)、[開発規約](conventions.md)、[ローカル開発](../setup/development.md)、[Release and CI Runbook](../runbooks/release-operations.md)で実際の開発・検証方法を確認します。
4. 位置情報と外部送信は[プライバシー・外部送信](../operations/privacy-and-external-transmission.md)、地図Tileと帰属は[Map Provider](../operations/map-provider.md)、UIの既存方針は[Design System](../design/README.md)を読みます。外部URLの検証規則は[店舗データ仕様](../specs/data.md)を参照し、外部リンクの起動・失敗時処理は #546 で決めます。
5. 個別実装Issueとその依存を確認します。Issueの説明は作業計画であり、未実装の案を採用済み仕様とみなさないでください。

## MVP Issue の進行順

推奨順は親Issue #521 に基づきます。#548 は #544 以降のNative依存を追加する段階から並行して進めます。

| 順 | Issue | 作業と依存 |
| --- | --- | --- |
| 1 | #539 Architecture | 完了。採用Version方針、MapLibreのExpo要件、Development Build、OS下限を[Mobile Architecture](../architecture/mobile.md)で確認 |
| 2 | #540 Public API | Mobileから固定Client Secretなしで読むAPIを整備。#539後 |
| 3 | #541 API Contract / Client | 公開API契約と共通Clientを整備。#540後 |
| 4 | #542 Expo基盤 | `apps/mobile`、Expo Router、workspace、CI。前提Issue完了後 |
| 5 | #543 API / Locale | Pub取得と ja/en 表示。#540〜#542後 |
| 6 | #544 Map | MapLibreとMarker。#543後。ここから #548 を開始 |
| 7 | #545 Search、#546 Detail、#547 Location | MVP機能を追加。#544後 |
| 並行 | #548 iOS Smoke Test | #544以降、Native依存の節目ごとにEAS Build / TestFlightで確認 |
| Android Release | #549 | Android MVP後 |
| iOS Release | #550 | #548の継続確認後。Android Releaseの後 |

## Platform と共有コードの境界

- `apps/web` はNext.jsのWeb UI、Route Handler、Web認証、Repositoryを担当します。React DOM、MapLibre GL JS、ブラウザAPIに依存する処理はMobileから直接再利用しません。
- 将来の `apps/mobile` はExpo / React NativeのUI、Native地図・権限・外部アプリ連携を担当します。採用VersionやNative Buildの判断は[Mobile Architecture](../architecture/mobile.md)を参照します。
- `packages/shared` はPlatform非依存の型・純粋ロジックを置く場所です。現在の [src/index.ts](../../packages/shared/src/index.ts) は `Pub` / `PubStatus` / `PubType`、`asPubs`、Locale定義・判定、都道府県名/コード、状態定義・変換、UUID検証などを公開しています。Pub型と `asPubs` は [pub.ts](../../packages/shared/src/pub.ts)、Localeは [locale.ts](../../packages/shared/src/locale.ts) を参照してください。
- Sharedに公開されるAdmin用型・Validationもありますが、Public Mobile MVPで管理操作を実装する根拠にはなりません。API取得、共通API Client、UI翻訳リソース、検索/Filterの共通化が未実装なら、必要性と置き場所を各Issueで判断します。Web専用処理を共有Packageへ移す前にPlatform依存を確認してください。

## 現行 Public Pub API とセキュリティ境界

Public APIのSource of Truthは [API仕様](../specs/api.md) と [店舗データ仕様](../specs/data.md)、実際の契約はRoute Handler・Repository・テストです。現在の読取りEndpointは `GET /api/pubs?locale=ja|en`、locale省略時は `ja` です。匿名の成功時は `{ "pubs": Pub[] }` を返し、DB未設定時は空配列です。不正locale、localeの重複、未対応Queryは `400` です。翻訳は要求localeを優先し、日本語へフォールバックします。公開店舗のみ返し、`isPublished` はDTOに含みません。共有CDNでは `s-maxage=60` と `stale-while-revalidate=60` を使います。

Public Pub APIは全環境で固定Client Secret不要のRead-only APIです。分散Rate Limitは導入しておらず、濫用対策は公開DTOの限定、Query allowlist、短時間の共有Cacheを使います。店舗公開状態の変更が共有Cacheへ反映されるまで最大約120秒の可能性があります。#541 の公開API OpenAPI収録と共通Clientは未実装です。ClientからNeonへ直接接続せず、DB Credential、Admin Session / API Credential、Automation Bearer Tokenを含めません。APIの現行契約は[API仕様](../specs/api.md)を確認してください。

## 未解決事項とBlocker

| 未解決事項 | 影響Mobile Issue | 対応Issue | 着手阻害 |
| --- | --- | --- | --- |
| SDK指定React Versionと既存WebのReact Versionが異なるため、npm workspace / Metroで重複や解決不整合がないことを実装時に検証する必要がある | #542 | #542 | Yes |
| 公開APIのOpenAPI収録と共通API Clientが未実装 | #543 | #541 | Yes |
| Tile ProviderのNative利用条件・Attribution・User-Agentを実装形態に合わせて確認し、iOS Native Buildを含む地図Smoke Testを行う必要がある | #544, #548 | #544 / #548 | Yes |
| Mobileの位置情報Permission文言・Platform別挙動、外部リンク起動失敗時のUIが未実装 | #546, #547 | #546 / #547 | No |

採用Version、Native Build、初期Route、OS下限は[Mobile Architecture](../architecture/mobile.md)を参照してください。SDK指定Reactと既存WebのReactの解決確認は#542、Native MapのTile Policy / User-Agent / Attributionは現在の[Map Provider方針](../operations/map-provider.md)を読み、MapLibre Native利用時に#544 / #548で再確認します。位置情報は利用者の明示操作後にForegroundで取得し、アプリサーバーやDBへ座標を保存しません。地図をその位置へ移動すると周辺Tile識別子がProviderへ送られ得ます。詳細は[Privacy文書](../operations/privacy-and-external-transmission.md)を参照してください。

## 開発と検証

現在のNodeは `.nvmrc` の24系です。`nvm use` を使える環境ではVersionを合わせ、使えない環境ではNode 24系を選びます。依存はrootで `npm ci`、workspace単位は `npm run <script> -w <workspace>` を使います。現在のroot `package.json` にMobile用scriptはないため、新しいコマンドは該当Issueで実装されてから案内してください。

Web / Sharedの既存検証は [開発規約](conventions.md) と [テスト戦略](testing.md) のコマンド、CI分類と実行条件は [Release and CI Runbook](../runbooks/release-operations.md) を参照します。Mobile導入後のLint / Typecheck / Test / Native Smoke Testは #542等でCI設定と合わせて追加します。Platformの画面部品を共有する前提は置かず、Pure Logicの再利用にはSharedのUnit Test、APIには契約テスト、Native画面にはComponent / Device Smoke Testを対応させます。

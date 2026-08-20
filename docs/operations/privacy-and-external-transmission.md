# 外部送信・プライバシー実態整理

## この文書の位置付け

Irish Pub Map の公開画面について、実装、通信経路、各サービスの公式資料を照合した結果と運用判断を記録します。確認日は 2026-08-20 です。

この文書は公開用プライバシーポリシーの実装や、弁護士による法律意見を代替するものではありません。サービスや法令の変更時には一次資料を再確認してください。

## 公開方針

- 対象利用者は日本国内の利用者です。英語表示は日本在住の外国人を想定しており、EU/EEAを含む日本国外へ積極的にサービスを提供する意図を示すものではありません。
- Vercel Web Analytics と Speed Insights は、公開用のプライバシー・外部送信表示が整うまで停止します。
- 言語設定 Cookie は表示言語の維持だけに使い、保存期間を30日とします。
- 現在地の生の座標はアプリのサーバーやDBへ送信・保存しません。ただし、現在地周辺の地図を表示すると、周辺タイルの識別子が OpenStreetMap へ送信されます。

## 現在利用している送信・保存

### Vercel ホスティング

| 項目 | 整理結果 |
| --- | --- |
| 発生条件 | 公開ページ、静的ファイル、APIなど、このサービスへHTTPリクエストを送ると発生する |
| 送信元 | 利用者のブラウザ |
| 送信先 | Vercel Inc. とそのインフラ・サブプロセッサ |
| 主な情報 | IPアドレス、IPから推定した国・都市、アクセス先URL、日時、HTTPヘッダー、ブラウザや端末に関する情報、応答状態、リクエストIDなど。言語設定 Cookie は同一オリジンへのリクエストヘッダーとしてVercel上のアプリにも届く |
| 目的 | Webサイト・APIの配信、障害調査、性能維持、セキュリティ、不正利用対策 |
| アプリ独自の保存 | 言語設定 Cookie や現在地座標をNeonへ保存する実装はない。Cookie値をアプリが独自にログへ出力する処理もない |
| 保持 | Runtime Logs は Hobby 1時間、Pro 1日、Enterprise 3日で、Observability Plus は30日。Build Logs はデプロイに紐づき無期限保存と案内されている。実際の期間は利用プランと設定に依存する |
| 削除 | Runtime Logs はプラン別期間の経過で閲覧対象外になる。DPAでは契約終了後のCustomer Data削除などが定められる一方、Service-Generated Dataの具体的な一律削除日は示されていない |

Vercelのプライバシー通知は、顧客サイトの利用者について、IPアドレス、IPから導く位置情報、システム構成情報などを受け取ると説明しています。Runtime Logsの画面には、ドメイン、HTTPステータス、Function種別、RequestIdなどリクエスト単位の情報が表示されます。

根拠:

- [Vercel Privacy Notice](https://vercel.com/legal/privacy-notice)
- [Vercel Runtime Logs](https://vercel.com/docs/logs/runtime)
- [Vercel Limits](https://vercel.com/docs/limits)
- [Vercel Data Processing Addendum](https://vercel.com/legal/dpa)
- [Vercel Security and Subprocessors](https://security.vercel.com/)

### OpenStreetMap 標準タイル

| 項目 | 整理結果 |
| --- | --- |
| 発生条件 | MapLibreが地図を表示・移動・拡大縮小すると発生する |
| 送信元 | 利用者のブラウザ。アプリサーバーを経由せず直接送信する |
| 送信先 | OpenStreetMap Foundation が運用する `tile.openstreetmap.org` と、そのグローバルなキャッシュサーバー |
| 主な情報 | IPアドレス、ブラウザ・端末種別、OS、参照元、日時、要求したタイルのURL。URLの `z/x/y` から表示地域と縮尺を推測できる |
| 目的 | 地図画像の配信、サービスの運用・セキュリティ・容量計画、匿名化した利用状況の調査 |
| 保持 | OSMF Privacy Policy はアクセス記録を一時的なものと説明するが、タイル要求ログの一律の保持日数は明示していない。Piwikの詳細利用情報は180日とされるが、これをタイル要求ログ全体の保持期間とは扱わない |
| 削除 | 一時的なIPアドレスや関連ログは個別アクセス・削除への対応が一般に困難と説明されている。タイル要求に関連するデータの保存地域と個別削除手順は未確認 |

現在地が得られた場合も、緯度・経度そのものをOSMへ送るAPIは呼びません。ただし、地図をその位置へ移動した結果、現在地周辺のタイル識別子が要求されるため、おおよその閲覧地域はOSM側で推測できます。

根拠:

- [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- [OSMF Privacy Policy](https://osmfoundation.org/wiki/Privacy_Policy)

標準タイルの利用条件との照合、変更時の確認、商用プロバイダーまたはセルフホストへ切り替える基準は、[OpenStreetMap 標準タイル利用方針](openstreetmap-tile-usage.md)を参照してください。

### 言語設定 Cookie

| 項目 | 値 |
| --- | --- |
| 名称 | `irishpub-map-locale` |
| 値 | `ja` または `en` |
| 目的 | 利用者が明示的に選んだ表示言語を、再読み込みやページ遷移後も維持する |
| 保存場所 | 利用者のブラウザに置くホスト限定のファーストパーティ Cookie |
| 属性 | `Path=/; Max-Age=2592000; SameSite=Lax` |
| 保存期間 | 設定または切り替えから30日 |
| 外部共有 | 広告・解析サービスへ送信せず、アプリ独自のDBにも保存しない。同一オリジンへの通常のHTTPリクエストでは、ホスティング先のVercel上にあるアプリへ送られる |
| 削除方法 | ブラウザのサイトデータ削除機能で削除できる。別の言語を選ぶと値と期限が上書きされ、操作しなければ30日後に失効する |

この Cookie は利用者を横断追跡する識別子として使用しません。未設定の場合は `Accept-Language` を参照し、英語なら英語、それ以外は日本語を初期表示します。

### 現在地

- 初回表示時には位置情報を要求せず、利用目的を説明した「現在地から探す」の明示操作後にだけブラウザのGeolocation APIを呼びます。利用者がブラウザの権限確認で許可した場合だけ緯度・経度を取得します。
- 取得した座標はReactのメモリ上の状態に置き、都道府県候補の選択、現在地マーカー、地図の表示範囲に利用します。
- 座標をアプリのAPIへ送る `fetch`、Neonへ書き込む処理、CookieやLocal Storageへ保存する処理はありません。
- ページを閉じるか再読み込みすると、アプリが保持していた座標は失われます。
- ブラウザやOSが現在地を特定するために利用する測位事業者やネットワーク処理は、アプリの実装からは確認できません。
- 現在地へ地図を移動した後のOSMタイル要求については、前項のとおり間接的な地域情報の外部送信が発生します。

## 停止している計測

### Vercel Web Analytics

Web Analyticsを組み込むと、Vercelへページビューが送信されます。公式資料では、時刻、URLまたは動的パス、参照元、フィルター後のクエリ、国・地域・都市、OS、ブラウザ、端末種別、スクリプトバージョンなどがデータポイントに含まれます。IPアドレスなどから生成する訪問者ハッシュは24時間後に破棄され、Cookieは使用しないと説明されています。

Dashboardで参照できる期間はプランに依存します。公式プラン資料では、Hobbyは1か月、Proは12か月と案内されていますが、プロジェクトの利用プランと集計済みデータの最終削除時期は未確認です。

現在は `@vercel/analytics` の依存関係と計測コンポーネントを削除し、アプリから新しいイベントを送らない状態にします。過去に送信済みのデータはVercel側の保持期間まで残る可能性があります。

根拠:

- [Vercel Web Analytics privacy and compliance](https://vercel.com/docs/analytics/privacy-policy)
- [Using Web Analytics](https://vercel.com/docs/analytics/using-web-analytics)
- [Web Analytics limits and pricing](https://vercel.com/docs/analytics/limits-and-pricing)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)

### Vercel Speed Insights

Speed Insightsを組み込むと、実利用者の端末からCore Web Vitalsなどの性能データがVercelへ送信されます。主な指標はTTFB、FCP、FID、LCP、INP、CLSで、閲覧URLまたはルート、時刻、端末・ブラウザに関する情報と関連付けて性能分析に使われます。

公式資料のDashboard参照期間はHobby 7日、Pro 30日、Enterprise 90日です。生のデータポイントの最終削除時期と、このプロジェクトの利用プランは未確認です。

現在は `@vercel/speed-insights` の依存関係と計測コンポーネントを削除し、アプリから新しい性能データを送らない状態にします。

根拠:

- [Vercel Speed Insights](https://vercel.com/docs/speed-insights)
- [Speed Insights metrics](https://vercel.com/docs/speed-insights/metrics)
- [Speed Insights package](https://vercel.com/docs/speed-insights/package)
- [Speed Insights limits and pricing](https://vercel.com/docs/speed-insights/limits-and-pricing)

## Vercelの契約・地域・保持に関する未確認事項

リポジトリだけでは次の項目を確定できません。公開用表示を実装する前と、計測を再開する前に、Vercel Dashboardと契約画面をプロジェクト所有者が確認してください。

- 現在のVercelプランがHobby、Pro、Enterpriseのどれか
- Web Analytics、Speed Insights、Observability Plus、DrainsがDashboardで有効か
- 過去に収集したAnalyticsとSpeed Insightsの残存期間と削除操作の有無
- ProまたはEnterprise向けDPAが、このプロジェクトの契約に適用されているか
- 選択中のFunction実行地域、実際に利用されるサブプロセッサと処理地域
- チーム設定のデータ利用・共有設定

Vercelの現行DPAはProとEnterpriseを対象とし、主要な処理施設は米国にあり、Vercelまたはサブプロセッサの処理拠点がある他地域でも処理され得るとしています。Hobbyの場合は、このDPAが適用される前提で公開文言を作成しないでください。

## 法令確認の作業上の整理

### 日本

電気通信事業法の外部送信規律について、このサービスがどの類型・規模で義務対象になるかは、この文書では最終判断しません。一方、OSMタイルやホスティングへの送信実態は、後続の公開表示で利用者が確認できるようにする方針です。

個人情報保護委員会のガイドラインでは、Cookie等の端末識別子を通じた閲覧履歴や個人の位置情報が「個人関連情報」の例として挙げられています。Irish Pub Mapは、言語Cookieを閲覧履歴や会員情報と結び付けず、現在地座標をサーバーへ蓄積しません。将来、アカウント、広告、行動履歴、位置履歴を追加する場合は、個人情報・個人関連情報としての取扱いを再確認します。

根拠:

- [総務省 外部送信規律に関する情報](https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/gaibusoushin_kiritsu_00002.html)
- [個人情報保護委員会 個人情報保護法ガイドライン（通則編）](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/)
- [個人情報保護委員会 Cookie等の端末識別子に関するFAQ](https://www.ppc.go.jp/all_faq_index/faq1-q8-1/)

### GDPR・ePrivacy

現時点の対象は日本国内であり、英語表示だけを理由にEU/EEAの利用者へ積極的にサービスを提供しているとは扱いません。ただし、法令の適用外を保証する判断ではありません。

次のいずれかを始める場合は、GDPRの域外適用、ePrivacyを含むCookie・端末情報の同意、EU/EEAから米国等へのデータ移転を再確認します。

- EU/EEAの国や居住者を明示して宣伝・提供する
- EU/EEA向けの店舗データ、通貨、配送、契約、広告を追加する
- アカウント、広告識別子、行動追跡、位置履歴などで利用者を継続的にモニタリングする
- Web Analytics、Speed Insights、その他の計測・広告サービスを再開または追加する

根拠:

- [EDPB Guidelines 3/2018 on the territorial scope of the GDPR](https://www.edpb.europa.eu/documents/guideline/guidelines-32018-on-the-territorial-scope-of-the-gdpr-article-3-version-adopted_en)

## 計測を再開する条件

Web AnalyticsまたはSpeed Insightsは、次の条件をすべて満たすPull Requestでのみ再開します。

1. 公開用のプライバシー・外部送信表示に、対象サービスの送信情報、送信先、目的、保持期間、停止方法を記載する。
2. Vercelプラン、DPA適用状況、Dashboard設定、保持期間を確認し、未確認事項を更新する。
3. 対象地域と利用目的に対して、通知だけで足りるか、同意取得が必要かを再確認する。
4. 収集するURLやクエリに秘密情報・個人情報が含まれないことを確認する。
5. ブラウザのNetworkで実際の送信内容を確認し、テストと運用文書を更新する。

## 後続の公開ページに載せる項目

- 運営者と問い合わせ方法
- 取得・送信する情報の種類
- 利用目的
- 送信先の名称とサービス提供者
- 保存期間、または期間を決める基準
- Cookieや位置情報の拒否・削除方法
- 現在地の生の座標はアプリサーバー・DBへ保存しないこと
- OSMタイル要求から表示地域を推測できること
- Web AnalyticsとSpeed Insightsの利用有無
- 国外処理、DPA、サブプロセッサについて確認できた内容と未確認事項
- 方針の制定日・更新日と、重要な変更時の告知方法

公開ページには「匿名」「端末内だけ」「保存しない」といった断定を単独で使わず、どの情報を、どの主体が、どこで処理・保存しないのかを具体的に記載します。

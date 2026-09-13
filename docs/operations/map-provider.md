# 地図タイル提供元の利用方針

最終確認日: 2026-08-22

この文書は、公開Web画面で利用する OpenFreeMap Bright ベクタースタイルについて、利用条件、帰属、外部送信の確認結果と将来の切替判断を記録します。OpenFreeMap が配信する OpenMapTiles スキーマの地図データを対象とし、OpenStreetMapデータ全般や他社サービスの利用条件を置き換えるものではありません。

## 現在の構成

- ブラウザ上の MapLibre GL JS が、利用者の操作で可視範囲に必要なベクタータイル、フォント、スプライトを HTTPS で直接取得します。
- スタイルURLは `https://tiles.openfreemap.org/styles/bright` です。
- アプリサーバー、プロキシ、CDNによるタイル中継・独自キャッシュ・プリフェッチ・オフラインダウンロードは実装していません。
- MapLibreの標準帰属コントロールに OpenFreeMap、OpenMapTiles、OpenStreetMap の必要な帰属を表示します。帰属は地図の外へ隠したり、別のUIで覆ったりしません。

## 利用条件・配信方式の確認

| ポリシー項目 | 実装・運用の確認結果 | 判断 |
| --- | --- | --- |
| 公開スタイルURL | OpenFreeMap Bright の HTTPS URL をそのまま指定している | 適合 |
| 可視の帰属表示 | MapLibreの標準コントロールを使い、著作権・ライセンスページへ遷移できる | 適合 |
| Referer（Web） | Next.jsの `Referrer-Policy` を上書きしていない。ブラウザ既定のクロスオリジンReferer送信に委ねる | 適合。ただしヘッダー設定変更時に再確認 |
| User-Agent相当の識別 | ブラウザが通常のUser-Agentを送る。サーバー・プロキシ経由のタイル要求はない | Web利用として適合。ネイティブ化やプロキシ追加時は固有UAを設定 |
| キャッシュ | ブラウザとOpenFreeMap/CDNのHTTPキャッシュを通常どおり利用する。`no-cache`系ヘッダーを付与しない | 適合 |
| プリフェッチ・一括取得 | 可視範囲外を取得する機能、オフライン地図、タイル収集ジョブはない | 適合 |
| 接続方式 | 利用者のブラウザがHTTP/2またはHTTP/3を選択可能なHTTPS接続を使う | ブラウザ・配信基盤に委ねる |

OpenFreeMapの公開ベクタースタイルはベストエフォートでありSLAはありません。公開画面の通常の人間による閲覧に限る現在の小規模な利用では継続利用しますが、OpenFreeMapがアクセスを予告なく制限できることを前提にします。

## 変更時の確認手順

次の変更を行うPRでは、この文書、[OpenFreeMap Terms of Service](https://openfreemap.org/tos/) および [Privacy Policy](https://openfreemap.org/privacy/) を再確認します。

- スタイルURL、MapLibreのソース設定、帰属表示、地図を覆うUIを変更する場合
- `Referrer-Policy`、リバースプロキシ、CDN、Service Worker、HTTPヘッダーを追加・変更する場合
- 地図の自動移動、事前読み込み、複数地点の一括表示、オフライン利用を追加する場合
- Web以外のクライアント、サーバーサイド取得、タイル中継を追加する場合

確認では、ブラウザの開発者ツールまたは配信ログで、HTTPS URL、Refererの有無、`Cache-Control: no-cache` / `Pragma: no-cache` を既定で送っていないこと、可視範囲外の連続要求が発生しないことを確認します。

## 切替判断と対応手順

次のいずれかに該当する場合は、OpenFreeMapの公開ベクタースタイルの継続利用を止め、商用タイルプロバイダーまたはセルフホストへ切り替える検討を開始します。

- アクセス増加により、OpenFreeMapの容量制約・ブロック・可用性低下が事業継続リスクになる場合
- 有償サービス、広告、寄付の導線など、OpenFreeMapが特に注意を求める提供形態へ変更する場合
- オフライン地図、広域プリフェッチ、バックグラウンド一括取得など、OpenFreeMapの公開ベクタースタイルで許可されない要件が必要な場合
- サーバー・CDN・ネイティブアプリ経由で、固有User-Agent、Referer、キャッシュを制御する必要がある場合
- SLA、利用量上限、サポート、地域別配信、独自スタイルなどを契約で担保する必要がある場合

切替時は以下の順に進めます。

1. 利用量、アクセス元、必要なズーム範囲、キャッシュ・オフライン要件を計測し、候補サービスの規約・料金・帰属要件を比較する。
2. スタイルURLを環境設定または切替可能な設定値へ分離し、ステージングで帰属、Referer、User-Agent、キャッシュ、地図の表示品質を確認する。
3. 公開前にプライバシー・外部送信文書と画面の帰属表示を更新し、ロールバック手順を用意する。
4. 切替後にエラー率、タイル読込時間、利用量、コスト、帰属表示を継続監視する。

## 根拠

- [OpenFreeMap Terms of Service](https://openfreemap.org/tos/)
- [OpenFreeMap Privacy Policy](https://openfreemap.org/privacy/)
- [OpenFreeMap Quick Start Guide](https://openfreemap.org/quick_start/)
- [OpenStreetMap Copyright and License](https://www.openstreetmap.org/copyright)
- [OpenFreeMap attribution information](https://openfreemap.org/)

# 日本の Irish Pub マップ

日本国内の Irish Pub を地図上で探せるサービスです。
まずは Web アプリとして公開し、利用状況や必要な機能を確認したうえで、同じデータと設計を活かしてモバイルアプリへ展開します。

## 方針

- 初期リリースは Web 版を優先する
- Pub データは構造化して管理し、Web とモバイルで共通利用できるようにする
- 地図表示、店舗詳細、検索、絞り込みを MVP の中心にする
- モバイルアプリ化を見据え、UI とデータ取得処理を分離する
- 運用コストを抑えるため、初期は静的ホスティングまたは軽量な BaaS を優先する

## 想定技術

### Web

| 項目 | 候補 |
| --- | --- |
| フレームワーク | Next.js |
| 言語 | TypeScript |
| UI | React |
| 地図 | MapLibre GL JS または Google Maps Platform |
| スタイリング | Tailwind CSS |
| ホスティング | Vercel |

### データ/API

| 項目 | 初期案 |
| --- | --- |
| 店舗データ | JSON または Supabase |
| 画像 | 外部 URL または Supabase Storage |
| API | Next.js Route Handlers |
| 管理画面 | 初期は不要。必要になった段階で追加 |

### モバイル展開

| 項目 | 候補 |
| --- | --- |
| フレームワーク | Expo / React Native |
| 言語 | TypeScript |
| 地図 | react-native-maps または MapLibre 系 |
| データ | Web 版と同じ API/DB を利用 |

## 推奨アーキテクチャ

初期は Next.js 単体で Web 公開まで進めます。
店舗データは最初から型定義し、後から API やモバイルアプリに流用しやすい形にします。

```text
irishpub-map
├── README.md
├── apps
│   └── web
│       ├── app
│       ├── components
│       ├── features
│       ├── lib
│       └── public
├── packages
│   └── shared
│       ├── pub
│       └── types
├── data
│   └── pubs.json
└── docs
    ├── architecture.md
    └── product.md
```

将来的にモバイルアプリを追加する場合は、次のように拡張します。

```text
irishpub-map
├── apps
│   ├── web
│   └── mobile
├── packages
│   └── shared
├── data
└── docs
```

## MVP 機能

- 日本国内の Irish Pub を地図上に表示する
- 店舗ピンを選択すると詳細を表示する
- 店舗名、都道府県、エリアで検索する
- 営業状況、公式サイト、Google Maps URL、SNS などのリンクを表示する
- 現在地から近い店舗を探せるようにする
- 店舗データを追加・修正しやすい形式で管理する

## 店舗データ案

```json
{
  "id": "tokyo-dubliners-shinjuku",
  "name": "The Dubliners' Irish Pub Shinjuku",
  "prefecture": "東京都",
  "city": "新宿区",
  "address": "東京都新宿区...",
  "latitude": 35.0,
  "longitude": 139.0,
  "websiteUrl": "https://example.com",
  "googleMapsUrl": "https://maps.google.com/...",
  "instagramUrl": null,
  "tags": ["guinness", "live-music", "food"],
  "status": "open"
}
```

## 開発ステップ

1. Next.js + TypeScript で Web アプリの最小構成を作る
2. `data/pubs.json` と店舗型定義を作る
3. 地図上に店舗ピンを表示する
4. 店舗詳細パネルを作る
5. 検索・絞り込みを追加する
6. Vercel にデプロイする
7. データ更新方法を整える
8. モバイルアプリ化の判断をする

## 起動方法

現時点ではアプリ本体が未作成のため、起動コマンドは未定義です。
Next.js 構成を追加した後は、以下のようなコマンドを想定します。

```bash
npm install
npm run dev
```

## テスト方法

現時点ではテスト環境は未作成です。
Web アプリ作成後は、最低限以下を用意します。

- 型チェック
- lint
- 主要コンポーネントの単体テスト
- 地図と検索の主要導線の E2E テスト

想定コマンド:

```bash
npm run typecheck
npm run lint
npm test
```

## build/lint コマンド

現時点では未定義です。
Next.js 構成を追加した後は、以下を用意します。

```bash
npm run lint
npm run build
```

## Codex に作業依頼するときの注意点

- まず Web 版を優先し、モバイルアプリは後続フェーズとして扱う
- 技術選定が未確定の箇所は、実装前に候補と理由を確認する
- 店舗データの形式は Web とモバイルで共通利用できるように維持する
- 地図 API は料金と利用制限があるため、導入前に選定理由を確認する
- 実装依頼は「地図表示」「店舗詳細」「検索」など小さな単位に分ける
- ファイル変更前に、既存構成と未コミット変更を確認する

# 日本の Irish Pub マップ

日本国内の Irish Pub を地図上で探せる Web アプリです。
まずは Web 版として公開し、店舗データや検索体験を固めたあと、同じデータ構造を使ってモバイルアプリへ展開します。

## 方針

- 初期リリースは Web 版を優先する
- Pub データは構造化して管理し、Web とモバイルで共通利用できるようにする
- 地図表示、店舗詳細、検索、絞り込みを MVP の中心にする
- モバイルアプリ化を見据え、UI とデータ取得処理を分離する
- 運用コストを抑えるため、初期は API キー不要の地図表示と静的データから始める

## 使用技術

### Web

| 項目 | 採用技術 |
| --- | --- |
| フレームワーク | Next.js 16 |
| 言語 | TypeScript |
| UI | React |
| 地図 | MapLibre GL JS |
| 地図タイル | OpenStreetMap |
| スタイリング | Tailwind CSS + global CSS |
| パッケージ管理 | npm workspaces |
| 推奨 Node.js | 22 系 |

### データ/API

| 項目 | 初期案 |
| --- | --- |
| 店舗データ | `data/pubs.json` |
| 店舗型定義 | `packages/shared` |
| API | 初期は未作成。必要になった段階で Next.js Route Handlers を追加 |
| 管理画面 | 初期は不要。必要になった段階で追加 |

### モバイル展開

| 項目 | 候補 |
| --- | --- |
| フレームワーク | Expo / React Native |
| 言語 | TypeScript |
| 地図 | react-native-maps または MapLibre 系 |
| データ | Web 版と同じ API/DB を利用 |

## ディレクトリ構成

```text
irishpub-map
├── apps
│   └── web
│       ├── app
│       │   ├── components
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── eslint.config.mjs
│       ├── next.config.mjs
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── tailwind.config.ts
│       └── tsconfig.json
├── data
│   └── pubs.json
├── packages
│   └── shared
│       ├── package.json
│       └── src
│           ├── index.ts
│           └── pub.ts
├── package.json
├── package-lock.json
└── README.md
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

## 現在できること

- サンプルの Irish Pub データを地図上に表示する
- 店舗ピンを選択すると店舗名とエリアを表示する
- 店舗一覧を表示する
- 公式サイトと Google Maps へのリンクを表示する
- 店舗データの型を `packages/shared` で共通管理する

## 今後の MVP 機能

- 店舗名、都道府県、エリアで検索する
- タグや営業状況で絞り込む
- 店舗詳細パネルを拡張する
- 現在地から近い店舗を探せるようにする
- 店舗データを追加・修正しやすい運用方法を整える
- Vercel にデプロイする

## 店舗データ形式

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
  "status": "unknown"
}
```

## 開発環境構築

Node.js は `.nvmrc` に合わせて 22 系を使います。

```bash
nvm use
npm install
```

## 起動方法

```bash
npm run dev
```

Web アプリは `apps/web` の Next.js アプリとして起動します。


## 地図表示について

地図表示にはブラウザのWebGL機能を使用します。
WebGLが無効な環境や、サンドボックス環境などでWebGLコンテキストを作成できない場合は、地図の代わりに案内メッセージを表示し、店舗一覧から情報を確認できるようにしています。

## テスト方法

単体テストは Vitest で実行します。coverage threshold は 90% 以上です。
現在の検証コマンドは以下です。

```bash
npm test
npm run typecheck
npm run lint
npm audit --omit=dev
```

## build/lint コマンド

```bash
npm run lint
npm run build
```

## Codex に作業依頼するときの注意点

- まず Web 版を優先し、モバイルアプリは後続フェーズとして扱う
- Node.js は 22 系を使う
- 店舗データの形式は Web とモバイルで共通利用できるように維持する
- 地図 API は料金と利用制限があるため、Google Maps 等へ切り替える場合は事前に選定理由を確認する
- 実装依頼は「検索」「店舗詳細」「データ追加」「デプロイ」など小さな単位に分ける
- ファイル変更前に、既存構成と未コミット変更を確認する

# ブラウザで画面を確認する

## Purpose

`agent-browser`でローカルのPublic UIを操作し、主要導線、responsive layout、Keyboard操作、console errorを確認します。一般的なCLIの機能説明ではなく、Irish Pub Mapでの確認観点を扱います。

## When to use

- Public UI、画面遷移、検索、絞り込み、管理画面などのブラウザBehaviorを変更したとき
- E2Eだけでは確認できない見た目、横overflow、focus、overlayを確認するとき

## Prerequisites

- 別terminalで`npm run dev`を起動している。
- 初回だけChrome for Testingを取得済みである。

```bash
npx agent-browser install
```

Linuxのsystem dependencyが不足する場合だけ、環境のpackage管理者権限を確認して`npx agent-browser install --with-deps`を実行します。Chromeや認証情報をRepositoryへ追加しません。

## Procedure

開発サーバーを開き、読み込み完了後にinteractive snapshotを取得します。

```bash
npx agent-browser open http://localhost:3000
npx agent-browser wait --load networkidle
npx agent-browser snapshot -i
```

`@eN`形式の参照を使って主要操作を確認します。画面更新後は参照が無効になるため、操作ごとにsnapshotを取り直します。

```bash
npx agent-browser fill @e1 "東京"
npx agent-browser press Enter
npx agent-browser snapshot -i
```

DesktopとMobileの目安としてviewportとscreenshotを指定します。

```bash
npx agent-browser set viewport 1280 900
npx agent-browser screenshot /tmp/irishpub-map-desktop.png
npx agent-browser set viewport 390 844
npx agent-browser screenshot /tmp/irishpub-map-mobile.png
```

確認後はsessionを終了します。

```bash
npx agent-browser close
```

## Validation

- Desktopと390px程度のMobileで、主要導線、横overflow、fixed / floating UIの重なりを確認する。
- Keyboard操作、visible focus、Accessible Name、状態が色だけに依存しないことを確認する。
- 日本語・英語、長いlabel / heading、console errorを確認する。

## Security notes

- `AGENT_BROWSER_EXECUTABLE_PATH`などの環境固有path、認証情報、token、Preview URLをRepositoryやscreenshotへ残さない。
- Chrome downloadやsystem dependencyの追加は、対象環境と権限を確認してから行う。

## Related docs

- [ローカル開発の開始](../setup/development.md)
- [Design System](../design/README.md)
- [Visual Regressionを更新する](visual-regression.md)

# リポジトリ設定

このディレクトリには、`yusukefr/irishpub-map` の GitHub リポジトリ設定を記録しています。

## ファイル

- [`repository-settings.json`](./repository-settings.json): GitHub API から取得した設定値。`exported_at` は取得時刻です。
- [`scripts/export-repository-settings.sh`](../../scripts/export-repository-settings.sh): 設定を再取得するスクリプト。

## 記録している設定

| 項目 | 内容 | 現在の設定 | 設定理由 |
| --- | --- | --- | --- |
| リポジトリ基本設定 | 公開／非公開、Issue、Wiki、Projects、マージ方法など | 公開、Issue／Projects／Wiki を有効化。Squash と Rebase を許可し、Merge commit は無効化 | 小規模なオープンソース開発として Issue で課題を管理し、履歴を読みやすく保つため |
| GitHub Actions | 実行可能なアクションとワークフローの既定権限 | すべてのアクションを許可。ワークフロー権限は read | CI の利用範囲を確保しつつ、ワークフローの既定権限は読み取り専用にして不要な書き込みを避けるため |
| `main` ブランチ保護 | ブランチ保護設定 | 未設定 | 変更を保護するルールは ruleset で管理するため。未設定であることも取得結果として記録する |
| Rulesets | ブランチに適用する削除・強制 push・Pull Request のルール | `main-blanch-rules` を作成済みだが、現在は無効 | 将来のブランチ運用ルールを保持し、必要なタイミングで有効化できるようにするため |

## 更新方法

Node.js と認証済みの `gh` CLI を用意し、リポジトリのルートで次を実行します。

```bash
scripts/export-repository-settings.sh
```

別のリポジトリや出力先を指定する場合は、`GH_REPO` と `--output` を利用できます。

```bash
GH_REPO=owner/repository scripts/export-repository-settings.sh --output /tmp/repository-settings.json
```

取得対象はリポジトリ基本設定、Actions 権限、`main` のブランチ保護、rulesets です。Secrets、Variables、トークンなどの秘密情報は取得対象に含めません。GitHub 側の設定を変更した場合は、取得した JSON とこの説明の「現在の設定」および「設定理由」を確認し、必要に応じて更新してください。

# リポジトリ設定

このディレクトリは、GitHub リポジトリ設定を確認・保守するための手順を管理します。個人名、アカウント名、Preview URL、ルール ID を含む設定スナップショットは追跡しません。公開用の Production URL は README に記載できます。

## 確認対象

- リポジトリ基本設定
- GitHub Actions の権限
- `main` ブランチ保護
- rulesets

Secrets、Variables、トークンは取得対象に含めません。出力にはアカウント情報や URL が含まれる可能性があるため、リポジトリ外の安全な場所に保管してください。

## 更新方法

Node.js と認証済みの `gh` CLI を用意し、リポジトリのルートで出力先を明示して実行します。

```bash
scripts/export-repository-settings.sh --output /tmp/repository-settings.json
```

対象リポジトリは現在の Git remote から取得します。別のリポジトリを明示する場合は `GH_REPO` を利用できます。

```bash
GH_REPO=owner/repository scripts/export-repository-settings.sh --output /tmp/repository-settings.json
```

出力先をこのディレクトリ内にした場合も JSON は `.gitignore` の対象です。GitHub 側の設定を変更した場合は取得結果を確認し、この手順に不足があれば更新してください。

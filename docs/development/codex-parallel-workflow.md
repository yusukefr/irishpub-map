# Git worktreeによるCodex並列開発

独立したIssueを複数のCodex taskで同時に実装するときの手順です。必須ルールはrootの[AGENTS.md](../../AGENTS.md)を優先し、通常の開発・検証・PR手順は[Development conventions](conventions.md)と既存のRunbookに従います。`.codex/config.toml` によるworktreeの強制や、worktreeの自動作成・削除はこの運用ルールの対象ではありません。

## 基本方針

並列実装では、原則 `1 Issue = 1 Branch = 1 Worktree = 1 Codex task` とします。各taskは割り当てられたworktreeだけを編集し、同じWorking Treeへ複数Agentを同時に入れません。無関係なIssueの変更を同じbranchやcommitへ混ぜず、`main` のWorking Treeは参照・統合用としてできるだけcleanに保ちます。並列数の上限は固定せず、レビュー、CI、競合解消に必要な時間を見て少数の独立Issueから始めます。

```text
main（参照用）
├── Issue A → branch A → worktree A → Codex task A → 検証 → PR A
└── Issue B → branch B → worktree B → Codex task B → 検証 → PR B
```

## 開始前に独立性を確認する

- 後続Issueが別Issueの未mergeコードやDB schemaを必要とする場合は、依存元のmerge後に着手します。stacked branchが必要なら依存関係とPRのbaseを先に明示します。現行の[AGENTS.md](../../AGENTS.md)はPRのbaseを`main`と定めているため、この標準フローで例外を暗黙に適用しません。
- 独立したIssueでも、`package.json`、lockfile、migration、生成schema、`globals.css`、共通型・Repository・Component、CI workflow、`AGENTS.md`を双方で大きく変更する見込みなら、直列実行を優先します。
- 作業開始時に `git status --short --branch` と `git worktree list` で、参照用Working Treeと既存worktreeの状態を確認します。他taskのworktree、branch、未commit変更は操作しません。

## Issue専用worktreeを作る

独立Issueは、作成直前に取得した最新の`origin/main`から始めます。ローカル`main`が最新であると仮定しません。以下は参照用Working Treeから実行する例です。worktreeは参照用Repositoryの外側に置き、Issueごとに別のpathと`ai/<short-description>` branchを使います。

```bash
git status --short --branch
git worktree list
git fetch origin main
git worktree add --no-track -b ai/issue-a ../irishpub-map-issue-a origin/main
git worktree add --no-track -b ai/issue-b ../irishpub-map-issue-b origin/main
```

各taskには自分のworktreeのpathとIssue番号を渡します。`--no-track`を指定して、作成直後のfeature branchが`origin/main`をupstreamに設定しないようにします。Gitは同じbranchを複数worktreeで同時にcheckoutできないため、branchを使い回しません。作成後は対象worktreeでbranchと作業状態を確認し、Node.jsのversionと依存関係を用意します。

```bash
cd ../irishpub-map-issue-a
git status --short --branch
nvm use
npm ci
```

## taskごとに実装・検証・PRを完結させる

Issueの設計コメント、変更、検証、commit、push、PR作成は対象worktree内で行います。別worktreeのテスト結果やビルド成果物を、自分のbranchの検証結果として扱いません。検証コマンドは変更内容に応じて[Development conventions](conventions.md)から選び、コミット前の`npm run check:sensitive-data`、PR後の`scripts/verify-pr-ci.sh`などrootの[AGENTS.md](../../AGENTS.md)にある必須手順を守ります。初回pushではremoteとupstreamを明示します。

```bash
git push -u origin HEAD
```

検証を省略した場合は理由をPR本文に記載します。

PRは原則としてIssueとworktreeごとに1件作り、baseを`main`にします。別taskの未merge PRを前提にしません。並列作業中に`main`が更新された場合は自分のworktreeで`git fetch origin main`を行い、必要な競合解消を自分のbranchに限定します。共有の参照用Working Treeや別taskのbranchをcheckout・変更しません。

## merge後に片付ける

PRがmergeされ、そのworktreeで追加作業が不要になったら、担当taskの未commit変更がないことを確認します。参照用Working Treeに戻り、対象pathを確認してからそのworktreeを削除します。作業中のworktreeや未commit変更があるworktreeを強制削除しません。

```bash
git worktree list
git -C ../irishpub-map-issue-a status --short --branch
git worktree remove ../irishpub-map-issue-a
git worktree list
```

不要になったlocal branchの削除は、merge済みの確認後に行います。worktreeの記録だけが残った場合も、別taskの作業状態を確認せずに一括cleanupしません。

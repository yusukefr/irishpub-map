# Documentation

Irish Pub Mapの仕様、設計、開発、運用文書への入口です。すべてのドキュメントを事前に読む必要はありません。現在のタスクに関係する文書だけを参照してください。

## Source of Truth

文書と他の情報が矛盾する場合は、次の順で確認します。

1. 現在のユーザー要求 / GitHub Issue
2. 現在の実装・テスト
3. Neon の現行スキーマ・データ
4. 現行ドキュメント
5. 過去の Issue / Pull Request / Migration / 設計記録

Issueは将来の変更要求を表す場合があります。現行Behaviorは実装・テスト、DB構造とデータはNeonの現行状態を優先してください。

## Document Types

- **Current**: 現在の仕様、設計、手順を保守するLiving Documentationです。
- **Generated**: SchemaなどのSource of Truthから生成される文書です。手動編集せず、生成元と生成手順を確認します。
- **Historical**: 過去の判断や変更経緯を保存する記録です。現行仕様の根拠にはせず、必要なときだけ参照します。

Living Documentationには現在の状態を記載します。実装履歴は原則としてGitHub Issue、Pull Request、Git historyをSource of Truthとし、長期的に残す設計判断だけを必要に応じてADRなどへ分離します。

## Documentation Router

| Task | Read | Type / Source of Truth |
| --- | --- | --- |
| Product仕様・画面Behavior | [Product specification](specs/product.md) | Current。現行Behaviorは実装・テストを優先 |
| Architecture | [System overview](architecture/system-overview.md)、[Sequences](architecture/sequences.md) | Current。実装とInfrastructureを優先 |
| Public API | [API specification](specs/api.md) | Current。Route Handlerとテストを優先 |
| Pub data contract | [Data specification](specs/data.md) | Current。共有型、Validation、DBを優先 |
| Database | [Database specification](specs/database.md)、[Normalization](specs/database-normalization.md) | Current。Neonの現行Schemaを優先 |
| Database columns | [Database columns](specs/database-columns.md) | Generated。Migrationと現行Schemaを優先 |
| Pub draft / publish | [Admin pub lifecycle](specs/admin-pub-lifecycle.md) | Current。管理APIとテストを優先 |
| Status management | [Status management](specs/status-management.md) | Current。実装・テストを優先 |
| Tag management / normalization | [Tag management](specs/tag-management.md)、[Tag normalization](specs/tag-normalization.md) | Current。共有型、DB、実装を優先 |
| Quiz | [Quiz specification](specs/quiz.md) | Current。実装・テストを優先 |
| Editorial content cache | [Editorial content cache](specs/editorial-content-cache.md) | Current。実装・テストを優先 |
| Public UI | [Irish Pub Map Design System](design/README.md) | Current。Token、Component、Pattern、Reference Screenの入口 |
| Development rules / GitHub / JSDoc | [Development conventions](development/conventions.md) | Current。root `AGENTS.md` のMandatory Rulesを優先 |
| Local setup | [Development setup](setup/development.md) | Current。Repository設定とScriptsを優先 |
| Deployment | [Deployment](setup/deployment.md) | Current。Vercelの現行設定と公式Documentationを優先 |
| Privacy / Analytics | [Privacy and external transmission](operations/privacy-and-external-transmission.md) | Current。実装とProduction設定を優先 |
| Map provider | [OpenStreetMap tile usage](operations/openstreetmap-tile-usage.md) | Current。Providerの現行Policyを優先 |
| Repository settings | [Repository settings](repository-settings/README.md) | Current。GitHubの現行設定を優先 |

## Read When

- コード変更では、最初に [Development conventions](development/conventions.md) と対象機能の仕様を読みます。
- `apps/web` の変更では `apps/web/AGENTS.md` も読みます。
- Public UI変更では、実装前に [Design System](design/README.md) から関係するToken、Component、Pattern、Reference Screenを確認します。
- DB変更では、Database文書とMigrationを確認し、Neonの現行Schemaを検証します。
- Framework、Library、Vercelの仕様判断では、リポジトリで使用中のVersionに対応する公式Documentationを確認します。

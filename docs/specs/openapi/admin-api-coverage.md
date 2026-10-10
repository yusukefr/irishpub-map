# Admin API OpenAPI 収録一覧

この一覧は `apps/web/app/api/admin/**/route.ts` と [OpenAPI定義](openapi.yaml) の対応状況を示します。現行のRoute HandlerとテストがContractの根拠です。Calendarは既収録で、Admin MasterはIssue #617の初回Domainとして収録しています。

| Domain            | Path                                   | Method                   | OpenAPI収録 / 作業Issue |
| ----------------- | -------------------------------------- | ------------------------ | ----------------------- |
| Calendar          | `/api/admin/calendar`                  | `GET`, `POST`            | 収録済み                |
| Calendar          | `/api/admin/calendar/{id}`             | `GET`, `PUT`, `DELETE`   | 収録済み                |
| Calendar          | `/api/admin/calendar/{id}/publication` | `PATCH`                  | 収録済み                |
| Master            | `/api/admin/master/prefectures`        | `GET`                    | 収録済み                |
| Master            | `/api/admin/master/municipalities`     | `GET`                    | 収録済み                |
| Master            | `/api/admin/master/tags`               | `GET`                    | 収録済み                |
| Master            | `/api/admin/master/statuses`           | `GET`                    | 収録済み                |
| Master            | `/api/admin/master/pub-types`          | `GET`                    | 収録済み                |
| Pub               | `/api/admin/pubs`                      | `GET`, `POST`            | 未収録・#625            |
| Pub               | `/api/admin/pubs/{id}`                 | `GET`, `PUT`, `DELETE`   | 未収録・#625            |
| Pub               | `/api/admin/pubs/{id}/publication`     | `PATCH`                  | 未収録・#625            |
| Tag               | `/api/admin/tags`                      | `GET`, `POST`            | 未収録・#626            |
| Tag               | `/api/admin/tags/{id}`                 | `GET`, `PATCH`, `DELETE` | 未収録・#626            |
| Status            | `/api/admin/statuses`                  | `GET`                    | 未収録・#627            |
| Status            | `/api/admin/statuses/{code}`           | `PATCH`                  | 未収録・#627            |
| Editorial Content | `/api/admin/content`                   | `GET`, `POST`            | 未収録・#628            |
| Editorial Content | `/api/admin/content/{id}`              | `GET`, `PUT`             | 未収録・#628            |
| Editorial Content | `/api/admin/content/{id}/publication`  | `PATCH`                  | 未収録・#628            |
| Quiz              | `/api/admin/quiz`                      | `GET`, `POST`            | 未収録・#629            |
| Quiz              | `/api/admin/quiz/{id}`                 | `GET`, `PUT`             | 未収録・#629            |
| Quiz              | `/api/admin/quiz/{id}/publication`     | `PATCH`                  | 未収録・#629            |
| Media             | `/api/admin/media`                     | `GET`, `POST`            | 未収録・#630            |
| Media             | `/api/admin/media/{id}`                | `GET`                    | 未収録・#630            |
| Authentication    | `/api/admin/login`                     | `POST`                   | 未収録・#631            |
| Authentication    | `/api/admin/logout`                    | `POST`                   | 未収録・#631            |

Public APIの `GET /api/pubs` はAdmin Routeではなく、Issue #541の対象です。Automation APIのPath・Scope・認証は [OpenAPI定義](openapi.yaml) の別tagで管理します。

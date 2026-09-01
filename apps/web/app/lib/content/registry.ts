import type { ContentRegistry } from "./types";

/**
 * 公開対象として明示的に登録したContentのAllow Listです。
 * 実コンテンツは後続Issue #309で追加し、Request値をImport Pathへ直接渡しません。
 */
export const contentRegistry = {
  story: {},
  guide: {},
} satisfies ContentRegistry;

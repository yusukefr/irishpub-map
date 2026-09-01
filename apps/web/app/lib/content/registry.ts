import type { ContentRegistry } from "./types";

/**
 * 公開対象として明示的に登録したContentのAllow Listです。
 * Request値をImport Pathへ直接渡さず、日英両方のTrusted MDXだけを公開します。
 */
export const contentRegistry = {
  story: {},
  guide: {
    sample: {
      slug: "sample",
      kind: "guide",
      loaders: {
        ja: () => import("../../../content/discover/guides/sample/ja.mdx"),
        en: () => import("../../../content/discover/guides/sample/en.mdx"),
      },
    },
  },
} satisfies ContentRegistry;

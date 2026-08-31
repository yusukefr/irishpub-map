import type { MDXComponents } from "mdx/types";

/**
 * Trusted MDXで使用できるコンポーネントのAllow Listを返します。
 * 現時点では任意HTMLや追加Componentを許可せず、標準Markdown要素だけを使用します。
 * @param {MDXComponents} components - MDXが解決した標準Component。
 * @returns {MDXComponents} 明示的に許可されたComponent。
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components };
}

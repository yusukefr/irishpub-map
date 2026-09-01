import type { MDXComponents } from "mdx/types";

/**
 * MDXで共通利用するComponent Overrideを提供します。
 * MDX自体のJSX / ESMをSandboxするものではなく、Repository内のTrusted Contentだけが対象です。
 * @param {MDXComponents} components - MDXが解決したComponent定義。
 * @returns {MDXComponents} 共通利用するComponent定義。
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components };
}

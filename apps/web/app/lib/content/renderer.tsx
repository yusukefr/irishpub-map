import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ContentRendererProps } from "./types";
const allowedElements = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
] as const;
/**
 * Markdown URLを安全なプロトコルだけに限定します。
 * @param {string} value - Markdown URL。
 * @returns {string | undefined} 安全なURL。
 */
export function sanitizeMarkdownUrl(value: string): string | undefined {
  const sanitized = defaultUrlTransform(value);
  return sanitized === "" ? undefined : sanitized;
}
/**
 * DB由来Markdownを許可済み要素だけで描画します。Raw HTML・JSX・任意スクリプトは実行しません。
 * @param {ContentRendererProps} props - Markdown本文。
 * @returns {JSX.Element} 安全に描画したMarkdown。
 */
export function SafeMarkdownRenderer({ markdown }: ContentRendererProps) {
  return (
    <Markdown allowedElements={allowedElements} remarkPlugins={[remarkGfm]} skipHtml urlTransform={sanitizeMarkdownUrl}>
      {markdown}
    </Markdown>
  );
}
/**
 * Guide本文を安全なMarkdownとして描画します。
 * @param {ContentRendererProps} props - Markdown本文。
 * @returns {JSX.Element} 本文Renderer。
 */
export function GuideRenderer(props: ContentRendererProps) {
  return <SafeMarkdownRenderer {...props} />;
}
/**
 * Story本文を安全なMarkdownとして描画します。
 * @param {ContentRendererProps} props - Markdown本文。
 * @returns {JSX.Element} Story本文。
 */
export function StoryRenderer(props: ContentRendererProps) {
  return <SafeMarkdownRenderer {...props} />;
}

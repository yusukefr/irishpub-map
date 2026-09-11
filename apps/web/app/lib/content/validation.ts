import type { AdminContentWriteInput } from "@irishpub-map/shared/admin-content";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

type MarkdownNode = {
  type?: unknown;
  url?: unknown;
  children?: unknown;
};

const markdownParser = unified().use(remarkParse).use(remarkGfm);

/**
 * Content入力の公開必須項目を列挙します。
 * @param {AdminContentWriteInput} input - Draft Validation済みの入力。
 * @returns {string[]} 公開に不足しているフィールドパス。
 */
export function getContentPublicationMissingFields(input: AdminContentWriteInput): string[] {
  const missing: string[] = [];
  if (!input.kind) missing.push("kind");
  if (!input.slug) missing.push("slug");
  if (!input.category) missing.push("category");
  for (const locale of ["ja", "en"] as const) {
    const translation = input.translations[locale];
    if (!translation.title) missing.push(`translations.${locale}.title`);
    if (!translation.summary) missing.push(`translations.${locale}.summary`);
    if (!translation.bodyMarkdown.trim()) missing.push(`translations.${locale}.bodyMarkdown`);
  }
  return missing;
}

/**
 * MarkdownをRendererと同じCommonMark・GFM Parserで解析し、リンク先を検証します。
 * @param {string} markdown - 検証するMarkdown本文。
 * @returns {boolean} すべてのlink・image・definitionが許可済みURLならtrue。
 */
export function hasOnlySafeMarkdownUrls(markdown: string): boolean {
  try {
    const pending: unknown[] = [markdownParser.parse(markdown)];
    while (pending.length > 0) {
      const node = pending.pop();
      if (!isMarkdownNode(node)) return false;
      if (isUrlNode(node) && (typeof node.url !== "string" || !isAllowedMarkdownUrl(node.url))) return false;
      if (Array.isArray(node.children)) pending.push(...node.children);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Markdownリンクとして許可するURLかを判定します。
 * @param {string} value - Parserが解決したURL。
 * @returns {boolean} HTTP(S)、ルート相対、ページ内アンカーの場合はtrue。
 */
export function isAllowedMarkdownUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  if (value.startsWith("#")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isMarkdownNode(value: unknown): value is MarkdownNode {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isUrlNode(node: MarkdownNode) {
  return node.type === "link" || node.type === "image" || node.type === "definition";
}

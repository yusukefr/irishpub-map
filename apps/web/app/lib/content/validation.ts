import type { AdminContentWriteInput } from "@irishpub-map/shared/admin-content";

const INLINE_DESTINATION = /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g;
const REFERENCE_DESTINATION = /^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|([^\s]+))/gm;
const AUTOLINK_DESTINATION = /<((?:[a-z][a-z0-9+.-]*:|\/|#)[^<>]*)>/gi;

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
    if (!translation.bodyMarkdown) missing.push(`translations.${locale}.bodyMarkdown`);
  }
  return missing;
}

/**
 * Markdown内のリンク・画像・参照定義・autolinkが許可済みURLだけかを検証します。
 * @param {string} markdown - 検証するMarkdown本文。
 * @returns {boolean} HTTP(S)、ルート相対、ページ内アンカーだけならtrue。
 */
export function hasOnlySafeMarkdownUrls(markdown: string): boolean {
  const destinations = [
    ...extractDestinations(markdown, INLINE_DESTINATION),
    ...extractDestinations(markdown, REFERENCE_DESTINATION),
    ...extractDestinations(markdown, AUTOLINK_DESTINATION),
  ];
  return destinations.every(isAllowedDestination);
}

function extractDestinations(markdown: string, pattern: RegExp) {
  return [...markdown.matchAll(pattern)].map((match) => match[1] ?? match[2] ?? "");
}

function isAllowedDestination(value: string) {
  const normalized = decodeNumericEntities(value.trim()).replace(/[\u0000-\u001f\u007f\s]/g, "");
  if (normalized.startsWith("/") && !normalized.startsWith("//")) return true;
  if (normalized.startsWith("#")) return true;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function decodeNumericEntities(value: string) {
  return value
    .replace(/&#(\d+);?/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([\da-f]+);?/gi, (_, hexadecimal: string) => String.fromCodePoint(Number.parseInt(hexadecimal, 16)));
}

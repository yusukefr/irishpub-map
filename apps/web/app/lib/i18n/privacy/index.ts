import en from "./en.json";
import ja from "./ja.json";
import type { Locale } from "..";

/** プライバシーポリシー本文から参照する外部リソースです。 */
export type PrivacyPolicyLink = {
  href: string;
  label: string;
};

/** プライバシーポリシーを構成する見出し単位のコンテンツです。 */
export type PrivacyPolicySection = {
  title: string;
  paragraphs: string[];
  items?: string[];
  links?: PrivacyPolicyLink[];
};

/** ロケールごとのプライバシーポリシー本文です。 */
export type PrivacyPolicy = {
  sections: PrivacyPolicySection[];
};

const policies: Record<Locale, PrivacyPolicy> = { ja, en };

/**
 * 指定ロケールに対応する静的なプライバシーポリシー本文を返します。
 * @param {Locale} locale - 表示するロケール。
 * @returns {PrivacyPolicy} 画面表示用のプライバシーポリシー本文。
 */
export function getPrivacyPolicy(locale: Locale): PrivacyPolicy {
  return policies[locale];
}

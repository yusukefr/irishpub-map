import Link from "next/link";
import { ContentCard } from "../../components/ui/content-card";

type BreadcrumbItem = Readonly<{ label: string; href?: string }>;

type DiscoverBreadcrumbsProps = Readonly<{
  label: string;
  items: readonly BreadcrumbItem[];
}>;

/** Discover関連カード1件の翻訳済み表示内容と遷移先です。 */
export type RelatedContentItem = Readonly<{
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}>;

type RelatedContentProps = Readonly<{
  heading: string;
  items: readonly RelatedContentItem[];
}>;

/**
 * 現在位置を最後の要素として示す、Discoverページ共通のパンくずです。
 * @param {DiscoverBreadcrumbsProps} props 読み上げラベルと順序付きの階層。
 * @returns Discover内の現在位置を示すナビゲーション。
 */
export function DiscoverBreadcrumbs({ label, items }: DiscoverBreadcrumbsProps) {
  return (
    <nav className="discover-breadcrumbs" aria-label={label}>
      <ol>
        {items.map((item) => (
          <li key={item.href ?? item.label}>
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Discover各ページの末尾で、次に読む内容と地図への導線を同じ形式で表示します。
 * @param {RelatedContentProps} props セクション見出しと3件の関連導線。
 * @returns compactなContentCardによる関連コンテンツ一覧。
 */
export function RelatedContent({ heading, items }: RelatedContentProps) {
  return (
    <section className="discover-related" aria-labelledby="discover-related-heading">
      <h2 id="discover-related-heading">{heading}</h2>
      <div className="discover-related-grid">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            titleId={"related-" + item.id + "-heading"}
            title={item.title}
            description={item.description}
            headingLevel={3}
            variant="compact"
            action={
              <Link href={item.href} aria-label={item.actionLabel + ": " + item.title}>
                {item.actionLabel}
              </Link>
            }
          />
        ))}
      </div>
    </section>
  );
}

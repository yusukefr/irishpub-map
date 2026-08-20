import { AppVersionFooter } from "../components/app-version-footer";
import { LanguageSwitcher } from "../components/language-switcher";
import { getRequestLocale } from "../lib/i18n/server";

const policySections = [
  {
    title: "1. 本サービスで取り扱う情報",
    paragraphs: [
      "本サービスにはユーザー登録機能がなく、氏名、住所、電話番号、メールアドレスなどの個人情報の入力を求める機能はありません。",
      "現在地周辺のアイリッシュパブを検索・表示するため、利用者が位置情報の利用を許可した場合にのみ、端末から位置情報を取得します。取得した位置情報はブラウザ内で店舗と地図を表示するためだけに利用し、本サービスのサーバーへ緯度・経度を送信したり、データベースへ保存したりしません。",
      "地図の表示時には、ブラウザからOpenStreetMapのサーバーへ直接通信が行われます。IPアドレス、ブラウザ・端末情報、アクセス日時、参照元、地図表示に必要なリクエスト情報などがOpenStreetMap側へ送信される場合があります。",
    ],
    links: [
      {
        href: "https://osmfoundation.org/wiki/Privacy_Policy",
        label: "OpenStreetMap Foundationのプライバシーポリシー",
      },
    ],
  },
  {
    title: "2. Cookieの利用",
    paragraphs: [
      "本サービスでは、利用者が選択した表示言語を保持するため、ファーストパーティCookieを使用します。このCookieを広告配信、アクセス解析、サイトをまたいだ追跡、または利用者を識別する目的では使用しません。",
      "Cookieの内容を本サービス独自のデータベースへ保存することはありません。同一サイトへの通常のアクセス時には、ブラウザの仕組みによりこのCookieがリクエストに含まれ、ホスティング環境であるVercel上の本サービスへ送信されます。ブラウザの設定でCookieを削除または無効にできますが、その場合は表示言語の設定が保持されないことがあります。",
    ],
    items: [
      "Cookie名: irishpub-map-locale",
      "保存する値: ja または en",
      "目的: 日本語・英語の表示設定を、ページ遷移や再読み込み後も維持するため",
      "保存期間: 設定または変更から30日",
      "保存場所: 利用者のブラウザ",
      "主な属性: Path=/; Max-Age=2592000; SameSite=Lax",
    ],
  },
  {
    title: "3. アクセス時に処理される情報",
    paragraphs: [
      "本サービスは、Vercel Inc.が提供するVercelを利用して提供されています。サービス提供、通信、セキュリティ確保、不具合調査およびサービス運用のため、アクセスに伴う情報がVercelのシステムで処理される場合があります。",
    ],
    items: [
      "IPアドレス",
      "User-Agentなどのブラウザ・端末情報",
      "アクセス日時、リクエスト先のURLやパス、HTTPステータスなどの通信情報",
    ],
  },
  {
    title: "4. 外部サービスへの情報送信",
    paragraphs: [
      "本サービスでは、サービスの提供および改善に必要な範囲でOpenStreetMapとVercelを利用しています。OpenStreetMapは地図表示のために利用し、地図表示時には利用者のブラウザから直接通信します。Vercelはホスティング、コンテンツ配信、セキュリティ、障害調査、利用状況および性能の把握に利用します。",
      "本サービスの運営者が、OpenStreetMap側で取得された情報を独自に取得または保存することはありません。",
    ],
    links: [{ href: "https://vercel.com/legal/privacy-notice", label: "Vercelのプライバシーポリシー" }],
  },
  {
    title: "5. アクセス解析および性能測定",
    paragraphs: [
      "本サービスでは、Vercel Web Analyticsを利用してページビューなどの利用状況を集計・分析し、Vercel Speed Insightsを利用して実際の利用環境における表示速度、応答性、視覚的な安定性などを測定します。これらの情報は、サービスの利用状況の把握、障害や性能劣化の把握、表示速度や機能の改善、アクセス量に応じた運用構成の検討に利用します。",
      "Web Analyticsではアクセス日時、閲覧したURLやルート、参照元、一部のクエリパラメータ、国・地域などのおおまかな位置情報、OS、ブラウザ、端末種別がVercelへ送信される場合があります。Speed Insightsでは閲覧したURLやルート、ネットワーク速度、ブラウザ、端末種別、OS、国、Web Vitalsなどの測定値、測定日時がVercelへ送信される場合があります。",
      "Web AnalyticsはデフォルトでCookieを使用しません。本サービスではGoogle Analyticsを利用しておらず、広告を掲載していません。取得した情報を広告配信、広告のパーソナライズ、プロファイリングまたはサイトをまたいだ追跡のために利用しません。",
    ],
    links: [
      { href: "https://vercel.com/docs/analytics/privacy-policy", label: "Vercel Web Analyticsのプライバシー説明" },
      { href: "https://vercel.com/docs/speed-insights", label: "Vercel Speed Insightsの説明" },
    ],
  },
  {
    title: "6. 第三者への提供",
    paragraphs: [
      "本サービスの運営者は、利用者に関する情報を販売しません。法令に基づく場合を除き、本サービスが取得した利用者に関する情報を、利用者の同意なく第三者へ提供しません。",
      "ただし、サービスの提供および改善に必要な通信として、このページに記載した外部サービスへ情報が送信される場合があります。",
    ],
  },
  {
    title: "7. 情報の安全管理",
    paragraphs: [
      "本サービスでは、不正アクセス、漏えい、改ざんなどを防止するため、サービスの性質および取り扱う情報に応じた合理的な安全管理措置を講じるよう努めます。現在位置を示す緯度・経度を本サービスのサーバーおよびデータベースへ保存しない設計を採用しています。",
    ],
  },
  {
    title: "8. プライバシーポリシーの変更",
    paragraphs: [
      "本サービスの機能、利用する外部サービスまたは法令などの変更に伴い、このプライバシーポリシーを変更する場合があります。重要な変更がある場合には、本サービス上で分かりやすい方法によりお知らせします。",
    ],
  },
  {
    title: "9. お問い合わせ",
    paragraphs: [
      "このプライバシーポリシーに関するお問い合わせは、Irish Pub Map の公開リポジトリの Issue からお願いします。個別のログやOpenStreetMap側の記録については、提供者の方針により対応できない場合があります。",
    ],
  },
];

/**
 * 公開画面で外部送信と情報の取扱いを説明するページです。
 * @returns {Promise<JSX.Element>} プライバシー・外部送信ページ。
 */
export default async function PrivacyPage() {
  const locale = await getRequestLocale();

  return (
    <main className="privacy-page-shell">
      <header className="privacy-masthead">
        <LanguageSwitcher locale={locale} />
        <div className="privacy-masthead-copy">
          <p className="eyebrow">Privacy policy</p>
          <h1>プライバシーポリシー</h1>
          <p className="lead">
            本サービスは、日本国内のアイリッシュパブを検索・閲覧できるサービスです。利用者のプライバシーを尊重し、利用者に関する情報を適切に取り扱います。
          </p>
        </div>
      </header>

      <article className="privacy-content" aria-label="プライバシーポリシー" lang="ja">
        <div className="privacy-sections">
          {policySections.map((section) => (
            <section className="privacy-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.links ? (
                <ul className="privacy-external-links">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} rel="noreferrer" target="_blank">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        <div className="privacy-record">
          <p>最終更新日: 2026年8月21日</p>
          <p>制定日: 2026年8月21日</p>
          <p>変更履歴: 2026年8月21日 プライバシーポリシーを公開</p>
        </div>
        <a className="privacy-home-link" href="/">
          地図からパブを探す<span aria-hidden="true"> →</span>
        </a>
      </article>

      <AppVersionFooter locale={locale} />
    </main>
  );
}

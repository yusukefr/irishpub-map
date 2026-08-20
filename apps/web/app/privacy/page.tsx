import { AppVersionFooter } from "../components/app-version-footer";
import { LanguageSwitcher } from "../components/language-switcher";
import { getRequestLocale } from "../lib/i18n/server";

const policySections = [
  {
    title: "1. このページについて",
    paragraphs: [
      "このページは、Irish Pub Map の公開画面における情報の取扱いと外部送信を説明するものです。アカウント登録、広告、行動追跡は現在提供していません。",
      "日本語を正本とします。英語表示は、この日本語版を利用しやすくするための補助であり、内容に差異がある場合は日本語版を優先します。",
    ],
  },
  {
    title: "2. Vercelによるサイト配信とログ",
    paragraphs: [
      "ページ、静的ファイル、APIへアクセスすると、利用者のブラウザからVercel Inc.およびそのインフラ・サブプロセッサへリクエストが送信されます。サイト配信、障害調査、性能維持、セキュリティ、不正利用対策のために利用されます。",
    ],
    items: [
      "主な情報: IPアドレス、IPから推定した国・都市、アクセス先URL、日時、HTTPヘッダー、ブラウザ・端末情報、応答状態、リクエストID",
      "保持・削除: Runtime Logs の閲覧期間は利用プランにより異なります（Hobby 1時間、Pro 1日、Enterprise 3日、Observability Plus 30日）。実際のプランや設定、契約終了後の取扱いは運営側で確認・管理します。",
    ],
  },
  {
    title: "3. OpenStreetMapの地図タイル",
    paragraphs: [
      "地図の表示、移動、拡大縮小時には、ブラウザが OpenStreetMap Foundation の tile.openstreetmap.org とグローバルなキャッシュサーバーへ地図画像を直接リクエストします。アプリのサーバーは経由しません。",
    ],
    items: [
      "主な情報: IPアドレス、ブラウザ・端末種別、OS、参照元、日時、要求したタイルURL。URLの z/x/y から表示地域と縮尺を推測できる場合があります。",
      "目的: 地図画像の配信、運用・セキュリティ・容量計画、匿名化した利用状況の調査。",
      "保持・削除: OSMFはアクセス記録を一時的なものと説明していますが、タイル要求ログの一律の保持日数、保存地域、個別削除手順は確認できていません。",
    ],
  },
  {
    title: "4. 言語設定Cookie",
    paragraphs: [
      "表示言語を選ぶと、ファーストパーティCookie「irishpub-map-locale」に ja または en を30日間保存します。ページ遷移や再読み込み後も言語を維持するためだけに使い、広告・解析サービスやアプリ独自のデータベースには保存しません。",
      "Cookieは同一オリジンへの通常のリクエストで、ホスティング先のVercel上のアプリに送信されます。ブラウザのサイトデータ削除で消去でき、別の言語を選ぶと値と期限が上書きされます。",
    ],
  },
  {
    title: "5. 現在地の利用",
    paragraphs: [
      "現在地は、利用目的を説明した「現在地から探す」を選んだ後にだけ、ブラウザの許可を得て取得します。座標は都道府県候補の選択、地図の表示範囲、現在地マーカーにだけ利用します。",
      "生の座標をアプリのAPIやデータベースへ送信・保存したり、CookieやLocal Storageへ保存したりする実装はありません。ページを閉じるか再読み込みすると失われます。ただし、現在地周辺を表示すると、地図タイルの識別子からおおよその表示地域がOpenStreetMap側で推測される場合があります。",
    ],
  },
  {
    title: "6. 停止中の計測機能",
    paragraphs: [
      "Vercel Web Analytics と Vercel Speed Insights は現在停止しています。アプリには計測コンポーネントや依存関係がなく、新しいページビューや性能データを送信しません。過去に送信されたデータは、Vercel側の保持期間まで残る可能性があります。",
      "将来これらを再開・追加する場合は、送信情報、送信先、目的、保持期間、停止方法、必要な通知または同意を改めて確認し、このページを更新します。",
    ],
  },
  {
    title: "7. お問い合わせ",
    paragraphs: [
      "この方針や情報の取扱いに関するご連絡は、Irish Pub Map の公開リポジトリの Issue からお願いします。個別のログやOpenStreetMap側の記録については、提供者の方針により対応できない場合があります。",
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
          <p className="eyebrow">Privacy / External transmission</p>
          <h1>プライバシーポリシー・外部送信について</h1>
          <p className="lead">
            Irish Pub Map
            は、地図で店舗を探すために必要な範囲で情報を取り扱います。何がどこへ送られるかを、利用前に確認できるようにしています。
          </p>
        </div>
      </header>

      <article className="privacy-content" aria-label="プライバシーポリシー・外部送信について" lang="ja">
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
            </section>
          ))}
        </div>
        <div className="privacy-record">
          <p>最終更新日: 2026年8月21日</p>
          <p>変更履歴: 2026年8月21日 初版公開（Vercel、OpenStreetMap、Cookie、現在地、停止中の計測機能を明記）</p>
        </div>
        <a className="privacy-home-link" href="/">
          地図からパブを探す<span aria-hidden="true"> →</span>
        </a>
      </article>

      <AppVersionFooter locale={locale} />
    </main>
  );
}

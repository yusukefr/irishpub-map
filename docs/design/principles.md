# Design Principles

## Modern Irish Explorer

Irish Pub Mapは、**日本のアイリッシュパブを探すこと自体を、小さな旅のように楽しめるサービス**としてデザインします。機能的な地図と、地域・文化・店の物語を伝える旅行ガイドの性格を一つのブランドにまとめます。

Brand Keywordsは **Warm / Welcoming / Modern / Irish / Local / Explorer / Authentic / Simple** です。

## Core Principles

### Map is the hero

Map探索画面では、Mapを主要Contentとして扱います。検索、絞り込み、一覧、詳細はMapを隠し続けず、利用者が場所との関係を保てるように配置します。

### Irish, but not stereotypical

IrishらしさをShamrockの多用、全面Green、Celtic Fontなどの固定観念へ依存させません。深いGreen、温かいGold、Cream、編集的なTypography、実在する店や文化の情報を組み合わせます。

### Warm, not corporate

地図製品として明快に操作できることを前提に、CreamのSurface、読みやすい余白、限定的なGold、Authenticな写真によって旅行ガイドの温かさを加えます。

### Content first

装飾よりInformation Hierarchyを優先します。見出し、説明、操作、状態を読む順に置き、写真や装飾は情報を補う場合だけ使います。

### Mobile is not small desktop

Desktop Layoutを縮小しません。DesktopではSide PanelとMapを並べ、MobileではCompact Search、Map、Bottom Sheetを縦の利用可能領域に構成します。

### One brand, different contexts

Map / Discover / Guide / Quiz / Calendarは目的に合うLayoutを使います。共通のToken、Typography Role、Header primitive、Focus、操作寸法によって同じブランドとして認識できる状態を保ちます。

## Product behaviorとの関係

Design変更だけを理由に、検索、位置情報取得、言語保存、店舗選択、外部リンク、データ取得などのBehaviorを変えません。Behavior変更が必要な場合はRequirementとして明記し、個別にテストします。

import { getPubs } from "@irishpub-map/api-client";
import { DEFAULT_LOCALE, isUuid, type Locale, type Pub } from "@irishpub-map/shared";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { isSafeExternalUrl, openExternalUrl } from "../../lib/pub-links";
import { useLocalSearchParams, useRouter } from "../../lib/router";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "https://irishpub-map-web.vercel.app";

const copy = {
  ja: {
    back: "地図へ戻る",
    loading: "パブ情報を読み込んでいます…",
    notFound: "このパブは見つかりませんでした。",
    loadError: "パブ情報を読み込めませんでした。通信状況を確認して、もう一度お試しください。",
    retry: "再試行",
    prefecture: "都道府県",
    city: "市区町村",
    address: "住所",
    tags: "タグ",
    website: "ウェブサイトを開く",
    maps: "Google Mapsで開く",
    instagram: "Instagramを開く",
    linkError: "リンクを開けませんでした。",
    status: { open: "営業中", temporarily_closed: "一時休業", closed: "閉業", unknown: "不明" },
  },
  en: {
    back: "Back to map",
    loading: "Loading pub details…",
    notFound: "This pub could not be found.",
    loadError: "Could not load pub details. Check your connection and try again.",
    retry: "Retry",
    prefecture: "Prefecture",
    city: "City",
    address: "Address",
    tags: "Tags",
    website: "Open website",
    maps: "Open in Google Maps",
    instagram: "Open Instagram",
    linkError: "Could not open the link.",
    status: { open: "Open", temporarily_closed: "Temporarily closed", closed: "Closed", unknown: "Unknown" },
  },
} satisfies Record<
  Locale,
  {
    back: string;
    loading: string;
    notFound: string;
    loadError: string;
    retry: string;
    prefecture: string;
    city: string;
    address: string;
    tags: string;
    website: string;
    maps: string;
    instagram: string;
    linkError: string;
    status: Record<Pub["status"], string>;
  }
>;

type LoadState = { status: "loading" } | { status: "error" } | { status: "success"; pub: Pub | null };

/** UUIDを検証して1件を表示し、検証済みHTTP(S) URLへの外部操作を提供します。 */
export default function PubDetailScreen() {
  const { id, locale: requestedLocale } = useLocalSearchParams<{ id?: string; locale?: string }>();
  const router = useRouter();
  const locale: Locale = requestedLocale === "en" ? "en" : DEFAULT_LOCALE;
  const labels = copy[locale];
  const [retryCount, setRetryCount] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [linkFailed, setLinkFailed] = useState(false);
  const invalidId = !isUuid(id);

  useEffect(() => {
    if (invalidId) return;
    const controller = new AbortController();
    getPubs({ baseUrl: API_BASE_URL, locale, signal: controller.signal })
      .then((pubs) => {
        if (!controller.signal.aborted)
          setLoadState({ status: "success", pub: pubs.find((pub) => pub.id === id) ?? null });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState({ status: "error" });
      });
    return () => controller.abort();
  }, [id, invalidId, locale, retryCount]);

  async function openLink(url: string) {
    setLinkFailed(false);
    setLinkFailed(!(await openExternalUrl(url)));
  }

  const pub = loadState.status === "success" && loadState.pub?.id === id ? loadState.pub : null;
  const resolvingRoute = loadState.status === "success" && loadState.pub !== null && !pub;
  const links = pub
    ? ([
        [labels.website, pub.websiteUrl],
        [labels.maps, pub.googleMapsUrl],
        [labels.instagram, pub.instagramUrl],
      ] as const)
    : [];

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text>{labels.back}</Text>
      </Pressable>
      {(loadState.status === "loading" || resolvingRoute) && !invalidId ? (
        <View accessibilityRole="progressbar" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator />
          <Text>{labels.loading}</Text>
        </View>
      ) : null}
      {loadState.status === "error" ? (
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="alert">{labels.loadError}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRetryCount((count) => count + 1)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text>{labels.retry}</Text>
          </Pressable>
        </View>
      ) : null}
      {invalidId || (loadState.status === "success" && loadState.pub === null) ? (
        <Text accessibilityRole="alert">{labels.notFound}</Text>
      ) : null}
      {pub ? (
        <View style={{ gap: 16 }}>
          <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700" }}>
            {pub.name}
          </Text>
          <Text>{pub.statusDisplayName ?? labels.status[pub.status]}</Text>
          <View style={{ gap: 4 }}>
            <Text>
              {labels.prefecture}: {pub.prefecture}
            </Text>
            {pub.city ? (
              <Text>
                {labels.city}: {pub.city}
              </Text>
            ) : null}
            <Text>
              {labels.address}: {pub.address}
            </Text>
          </View>
          {pub.tags.length ? (
            <View style={{ gap: 4 }}>
              <Text>{labels.tags}</Text>
              <Text>{pub.tags.map((tag) => pub.tagDisplayNames?.[tag] ?? tag).join(" · ")}</Text>
            </View>
          ) : null}
          {links.map(([label, url]) =>
            isSafeExternalUrl(url) ? (
              <Pressable
                key={label}
                accessibilityRole="link"
                onPress={() => void openLink(url)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text>{label}</Text>
              </Pressable>
            ) : null,
          )}
          {linkFailed ? <Text accessibilityRole="alert">{labels.linkError}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

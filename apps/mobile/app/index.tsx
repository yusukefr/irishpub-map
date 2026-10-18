import { getPubs } from "@irishpub-map/api-client";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type Pub } from "@irishpub-map/shared";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "https://irishpub-map-web.vercel.app";

type MobileMessages = {
  title: string;
  loading: string;
  loadError: string;
  retry: string;
  count: (count: number) => string;
  prefecture: (prefecture: string) => string;
  status: string;
  unknownStatus: string;
  selectLanguage: string;
};

const messages = {
  ja: {
    title: "Irish Pub Map",
    loading: "パブ一覧を読み込んでいます…",
    loadError: "パブ一覧を読み込めませんでした。通信状況を確認して、もう一度お試しください。",
    retry: "再試行",
    count: (count: number) => `${count} 件のパブ`,
    prefecture: (prefecture: string) => `都道府県: ${prefecture}`,
    status: "営業状況",
    unknownStatus: "不明",
    selectLanguage: "表示言語",
  },
  en: {
    title: "Irish Pub Map",
    loading: "Loading pubs…",
    loadError: "Could not load pubs. Check your connection and try again.",
    retry: "Retry",
    count: (count: number) => `${count} pubs`,
    prefecture: (prefecture: string) => `Prefecture: ${prefecture}`,
    status: "Status",
    unknownStatus: "Unknown",
    selectLanguage: "Language",
  },
} satisfies Record<Locale, MobileMessages>;

type LoadState = { status: "loading" } | { status: "success"; pubs: Pub[] } | { status: "error" };

/** 端末Localeから初期表示Localeを決め、非対応値は日本語にします。 */
export function resolveInitialLocale(languageTag?: string): Locale {
  const language = (languageTag ?? Intl.DateTimeFormat().resolvedOptions().locale).split(/[-_]/)[0]?.toLowerCase();

  return SUPPORTED_LOCALES.find((locale) => locale === language) ?? DEFAULT_LOCALE;
}

function getStatusLabel(pub: Pub, locale: Locale, unknownLabel: string) {
  if (pub.statusDisplayName) return pub.statusDisplayName;
  if (pub.status === "open") return locale === "ja" ? "営業中" : "Open";
  if (pub.status === "temporarily_closed") return locale === "ja" ? "一時休業" : "Temporarily closed";
  if (pub.status === "closed") return locale === "ja" ? "閉店" : "Closed";
  return unknownLabel;
}

export default function HomeScreen() {
  const [locale, setLocale] = useState<Locale>(resolveInitialLocale);
  const [retryCount, setRetryCount] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const copy = messages[locale];

  useEffect(() => {
    const controller = new AbortController();

    getPubs({ baseUrl: API_BASE_URL, locale, signal: controller.signal })
      .then((pubs) => setLoadState({ status: "success", pubs }))
      .catch(() => {
        if (!controller.signal.aborted) setLoadState({ status: "error" });
      });

    return () => controller.abort();
  }, [locale, retryCount]);

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 20 }}>
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700" }}>
        {copy.title}
      </Text>
      <View accessibilityLabel={copy.selectLanguage} style={{ flexDirection: "row", gap: 12 }}>
        {SUPPORTED_LOCALES.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: locale === option }}
            onPress={() => {
              if (locale === option) return;
              setLoadState({ status: "loading" });
              setLocale(option);
            }}
            style={{ padding: 12, borderWidth: 1, borderRadius: 8 }}
          >
            <Text>{option === "ja" ? "日本語" : "English"}</Text>
          </Pressable>
        ))}
      </View>

      {loadState.status === "loading" ? (
        <View accessibilityRole="progressbar" style={{ gap: 12 }}>
          <ActivityIndicator />
          <Text>{copy.loading}</Text>
        </View>
      ) : loadState.status === "error" ? (
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="alert">{copy.loadError}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setLoadState({ status: "loading" });
              setRetryCount((count) => count + 1);
            }}
            style={{ padding: 12, borderWidth: 1, borderRadius: 8, alignSelf: "flex-start" }}
          >
            <Text>{copy.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <Text>{copy.count(loadState.pubs.length)}</Text>
          {loadState.pubs.map((pub) => (
            <View key={pub.id} style={{ gap: 4, paddingBottom: 12, borderBottomWidth: 1 }}>
              <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "600" }}>
                {pub.name}
              </Text>
              <Text>{copy.prefecture(pub.prefecture)}</Text>
              <Text>
                {copy.status}: {getStatusLabel(pub, locale, copy.unknownStatus)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

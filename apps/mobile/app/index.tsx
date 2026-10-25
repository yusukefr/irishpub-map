import { getPubs } from "@irishpub-map/api-client";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type Pub } from "@irishpub-map/shared";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { PubMap } from "./pub-map";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "https://irishpub-map-web.vercel.app";

type MobileMessages = {
  title: string;
  loading: string;
  loadError: string;
  retry: string;
  selectLanguage: string;
};

const messages = {
  ja: {
    title: "Irish Pub Map",
    loading: "パブ一覧を読み込んでいます…",
    loadError: "パブ一覧を読み込めませんでした。通信状況を確認して、もう一度お試しください。",
    retry: "再試行",
    selectLanguage: "表示言語",
  },
  en: {
    title: "Irish Pub Map",
    loading: "Loading pubs…",
    loadError: "Could not load pubs. Check your connection and try again.",
    retry: "Retry",
    selectLanguage: "Language",
  },
} satisfies Record<Locale, MobileMessages>;

type LoadState = { status: "loading" } | { status: "success"; pubs: Pub[] } | { status: "error" };

/** 端末Localeから初期表示Localeを決め、非対応値は日本語にします。 */
export function resolveInitialLocale(languageTag?: string): Locale {
  const language = (languageTag ?? Intl.DateTimeFormat().resolvedOptions().locale).split(/[-_]/)[0]?.toLowerCase();

  return SUPPORTED_LOCALES.find((locale) => locale === language) ?? DEFAULT_LOCALE;
}

export default function HomeScreen() {
  const [locale, setLocale] = useState<Locale>(resolveInitialLocale);
  const [retryCount, setRetryCount] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selectedPubId, setSelectedPubId] = useState<string | null>(null);
  const copy = messages[locale];

  useEffect(() => {
    const controller = new AbortController();

    getPubs({ baseUrl: API_BASE_URL, locale, signal: controller.signal })
      .then((pubs) => {
        if (!controller.signal.aborted) setLoadState({ status: "success", pubs });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState({ status: "error" });
      });

    return () => controller.abort();
  }, [locale, retryCount]);

  const pubs = loadState.status === "success" ? loadState.pubs : [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, gap: 12 }}>
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
                if (option === locale) return;
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
          <View accessibilityRole="progressbar" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator />
            <Text>{copy.loading}</Text>
          </View>
        ) : null}
        {loadState.status === "error" ? (
          <View style={{ gap: 8 }}>
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
        ) : null}
      </View>
      <PubMap
        pubs={pubs}
        dataReady={loadState.status === "success"}
        locale={locale}
        selectedPubId={selectedPubId}
        onSelectPub={setSelectedPubId}
      />
    </View>
  );
}

import { Camera, GeoJSONSource, Layer, Map, TransformRequestManager } from "@maplibre/maplibre-react-native";
import { filterPubs, getAvailablePrefectures, getAvailableTags, type Locale, type Pub } from "@irishpub-map/shared";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import mobileAppConfig from "../app.json";
import { toPubFeatureCollection } from "./pub-map-data";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
const APP_VERSION = mobileAppConfig.expo.version;

TransformRequestManager.addHeader({
  id: "irishpub-map-openfreemap-user-agent",
  match: "^https://tiles\\.openfreemap\\.org/",
  name: "User-Agent",
  value: `IrishPubMap/${APP_VERSION}`,
});

const copy = {
  ja: {
    count: (count: number) => `${count} 件のパブ`,
    noPubs: "地図に表示できるパブはありません。",
    noMatches: "条件に一致するパブはありません。",
    search: "パブ名・読み方・地域を検索",
    prefecture: "都道府県",
    tags: "タグ",
    clear: "検索条件をすべて解除",
    clearSearch: "検索語を解除",
    mapError: "地図を読み込めませんでした。通信状況を確認して、もう一度お試しください。",
    retry: "地図を再読み込み",
  },
  en: {
    count: (count: number) => `${count} pubs`,
    noPubs: "There are no pubs to show on the map.",
    noMatches: "No pubs match these filters.",
    search: "Search pub name, kana, or area",
    prefecture: "Prefecture",
    tags: "Tags",
    clear: "Clear all search filters",
    clearSearch: "Clear search text",
    mapError: "The map could not be loaded. Check your connection and try again.",
    retry: "Reload map",
  },
} satisfies Record<
  Locale,
  {
    count: (count: number) => string;
    noPubs: string;
    noMatches: string;
    search: string;
    prefecture: string;
    tags: string;
    clear: string;
    clearSearch: string;
    mapError: string;
    retry: string;
  }
>;

type PubMapProps = {
  pubs: Pub[];
  dataReady: boolean;
  locale: Locale;
  selectedPubId: string | null;
  onSelectPub: (pubId: string) => void;
};

/** OpenFreeMap上にPubをまとめて描画し、選択中の店舗情報と読み込み失敗を表示します。 */
export function PubMap({ pubs, dataReady, locale, selectedPubId, onSelectPub }: PubMapProps) {
  const [mapFailed, setMapFailed] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedPrefecture, setSelectedPrefecture] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const filteredPubs = useMemo(
    () => filterPubs(pubs, { query, prefecture: selectedPrefecture, tags: selectedTags }),
    [pubs, query, selectedPrefecture, selectedTags],
  );
  const availablePrefectures = useMemo(() => getAvailablePrefectures(pubs), [pubs]);
  const availableTags = useMemo(() => getAvailableTags(pubs), [pubs]);
  const selectedPub = filteredPubs.find((pub) => pub.id === selectedPubId);
  const features = useMemo(() => toPubFeatureCollection(filteredPubs), [filteredPubs]);
  const labels = copy[locale];
  const hasFilters = Boolean(query.trim() || selectedPrefecture || selectedTags.length);

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((selected) => selected !== tag) : [...current, tag],
    );
  }

  function clearFilters() {
    setQuery("");
    setSelectedPrefecture("");
    setSelectedTags([]);
  }

  return (
    <View style={{ flex: 1, minHeight: 320 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            accessibilityLabel={labels.search}
            value={query}
            onChangeText={setQuery}
            placeholder={labels.search}
            returnKeyType="search"
            style={{ flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }}
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={labels.clearSearch}
              onPress={() => setQuery("")}
              style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}
            >
              <Text>×</Text>
            </Pressable>
          ) : null}
        </View>
        {availablePrefectures.length ? (
          <View style={{ gap: 4 }}>
            <Text>{labels.prefecture}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {availablePrefectures.map((prefecture) => {
                const selected = selectedPrefecture === prefecture;
                return (
                  <Pressable
                    key={prefecture}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedPrefecture(selected ? "" : prefecture)}
                    style={{
                      minHeight: 44,
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderRadius: 22,
                      backgroundColor: selected ? "#e7f1eb" : "transparent",
                    }}
                  >
                    <Text>
                      {selected ? "✓ " : ""}
                      {prefecture}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
        {availableTags.length ? (
          <View style={{ gap: 4 }}>
            <Text>{labels.tags}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {availableTags.map((tag) => {
                const selected = selectedTags.includes(tag);
                const label = pubs.find((pub) => pub.tags.includes(tag))?.tagDisplayNames?.[tag] ?? tag;
                return (
                  <Pressable
                    key={tag}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => toggleTag(tag)}
                    style={{
                      minHeight: 44,
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderRadius: 22,
                      backgroundColor: selected ? "#e7f1eb" : "transparent",
                    }}
                  >
                    <Text>
                      {selected ? "✓ " : ""}
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
        {hasFilters ? (
          <Pressable
            accessibilityRole="button"
            onPress={clearFilters}
            style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}
          >
            <Text>{labels.clear}</Text>
          </Pressable>
        ) : null}
      </View>
      {mapFailed ? (
        <View
          accessibilityRole="alert"
          style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 }}
        >
          <Text>{labels.mapError}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMapFailed(false);
              setMapAttempt((attempt) => attempt + 1);
            }}
            style={{ padding: 12, borderWidth: 1, borderRadius: 8 }}
          >
            <Text>{labels.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <Map
          key={mapAttempt}
          accessibilityLabel={locale === "ja" ? "パブの地図" : "Pub map"}
          mapStyle={MAP_STYLE_URL}
          attribution
          onDidFinishLoadingMap={() => setMapFailed(false)}
          onDidFailLoadingMap={() => setMapFailed(true)}
          style={{ flex: 1 }}
        >
          <Camera
            initialViewState={{ bounds: [122, 24, 147, 46], padding: { top: 16, right: 16, bottom: 16, left: 16 } }}
          />
          <GeoJSONSource
            id="pubs"
            data={features}
            onPress={(event) => {
              const pubId = event.nativeEvent.features[0]?.properties?.pubId;
              if (typeof pubId === "string") onSelectPub(pubId);
            }}
          >
            <Layer
              id="pub-markers"
              type="circle"
              paint={{
                "circle-color": ["case", ["==", ["get", "pubId"], selectedPubId ?? ""], "#8f3f23", "#176b52"],
                "circle-radius": ["case", ["==", ["get", "pubId"], selectedPubId ?? ""], 10, 7],
                "circle-stroke-color": "#fffaf1",
                "circle-stroke-width": 2,
              }}
            />
          </GeoJSONSource>
        </Map>
      )}
      <View style={{ padding: 16, gap: 8, borderTopWidth: 1 }}>
        {dataReady ? <Text accessibilityRole="header">{labels.count(filteredPubs.length)}</Text> : null}
        {dataReady && pubs.length === 0 ? <Text>{labels.noPubs}</Text> : null}
        {dataReady && pubs.length > 0 && filteredPubs.length === 0 ? <Text>{labels.noMatches}</Text> : null}
        {selectedPub ? (
          <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
            <Text accessibilityRole="header" style={{ fontWeight: "700" }}>
              {selectedPub.name}
            </Text>
            <Text>{selectedPub.address}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

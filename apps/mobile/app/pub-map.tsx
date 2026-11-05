import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  TransformRequestManager,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import {
  sortPubsByDistance,
  filterPubs,
  getAvailablePrefectures,
  getAvailableTags,
  getPrefectureCode,
  type Locale,
  type Pub,
} from "@irishpub-map/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import mobileAppConfig from "../app.json";
import { toPubFeatureCollection } from "./pub-map-data";
import type { CurrentLocationResult } from "../lib/current-location";

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
    locate: "現在地を表示",
    locating: "現在地を取得中…",
    privacy:
      "現在地はこの操作中だけ利用し、サーバーへ送信・保存しません。地図タイルの位置情報はOpenFreeMapへ送信されます。",
    denied: "位置情報が許可されませんでした。検索や地図は引き続き利用できます。",
    blocked: "端末設定で位置情報を許可してください。",
    settings: "設定を開く",
    servicesDisabled: "端末の位置情報サービスを有効にしてください。",
    locationTimeout: "現在地を取得できませんでした。もう一度お試しください。",
    locationError: "現在地を利用できません。端末の設定を確認してください。",
    nearby: "近くのパブ",
    noNearby: "周辺に掲載パブはありません。",
    distance: (distanceKm: number) =>
      distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`,
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
    locate: "Show my location",
    locating: "Getting your location…",
    privacy:
      "Your location is used only for this action and is not sent to or stored by our server. Map tile requests reveal the viewed area to OpenFreeMap.",
    denied: "Location permission was not granted. Search and the map remain available.",
    blocked: "Allow location access in your device settings.",
    settings: "Open settings",
    servicesDisabled: "Turn on location services on your device.",
    locationTimeout: "Could not get your location. Please try again.",
    locationError: "Location is unavailable. Check your device settings.",
    nearby: "Nearby pubs",
    noNearby: "There are no listed pubs nearby.",
    distance: (distanceKm: number) =>
      distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`,
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
    locate: string;
    locating: string;
    privacy: string;
    denied: string;
    blocked: string;
    settings: string;
    servicesDisabled: string;
    locationTimeout: string;
    locationError: string;
    nearby: string;
    noNearby: string;
    distance: (distanceKm: number) => string;
  }
>;

type PubMapProps = {
  pubs: Pub[];
  dataReady: boolean;
  locale: Locale;
  selectedPubId: string | null;
  locationState?: { status: "idle" | "requesting" } | CurrentLocationResult;
  onSelectPub: (pubId: string) => void;
  onOpenPub: (pubId: string) => void;
  onRequestLocation?: () => void;
  onOpenLocationSettings?: () => void;
};

type PrefectureFilterOption = {
  id: string;
  name: string;
  code: number | null;
};

/** OpenFreeMap上にPubをまとめて描画し、選択中の店舗情報と読み込み失敗を表示します。 */
export function PubMap({
  pubs,
  dataReady,
  locale,
  selectedPubId,
  locationState = { status: "idle" },
  onSelectPub,
  onOpenPub,
  onRequestLocation = () => undefined,
  onOpenLocationSettings = () => undefined,
}: PubMapProps) {
  const [mapFailed, setMapFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const camera = useRef<CameraRef>(null);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedPrefectureId, setSelectedPrefectureId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const availablePrefectures = useMemo<PrefectureFilterOption[]>(
    () =>
      getAvailablePrefectures(pubs).map((name) => {
        const prefecturePub = pubs.find((pub) => pub.prefecture === name);
        const codeFromMunicipality = Number(prefecturePub?.municipalityCode?.slice(0, 2));
        const code =
          codeFromMunicipality >= 1 && codeFromMunicipality <= 47
            ? codeFromMunicipality
            : (getPrefectureCode(name) ?? null);

        return { id: code === null ? `name:${name}` : `code:${code}`, name, code };
      }),
    [pubs],
  );
  const activePrefectureId = availablePrefectures.some(({ id }) => id === selectedPrefectureId)
    ? selectedPrefectureId
    : null;
  const selectedPrefecture = availablePrefectures.find(({ id }) => id === activePrefectureId);

  const filteredPubs = useMemo(
    () =>
      filterPubs(pubs, {
        query,
        ...(selectedPrefecture?.code === null
          ? { prefecture: selectedPrefecture.name }
          : selectedPrefecture?.code !== undefined
            ? { prefectureCode: selectedPrefecture.code }
            : {}),
        tags: selectedTags,
      }),
    [pubs, query, selectedPrefecture, selectedTags],
  );
  const availableTags = useMemo(() => getAvailableTags(pubs), [pubs]);
  const selectedPub = filteredPubs.find((pub) => pub.id === selectedPubId);
  const features = useMemo(() => toPubFeatureCollection(filteredPubs), [filteredPubs]);
  const labels = copy[locale];
  const coordinates = locationState.status === "success" ? locationState.coordinates : null;
  const nearbyPubs = useMemo(
    () => (coordinates ? sortPubsByDistance(pubs, coordinates).slice(0, 3) : []),
    [pubs, coordinates],
  );
  const locationFeature = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: coordinates
        ? [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "Point" as const,
                coordinates: [coordinates.longitude, coordinates.latitude] as [number, number],
              },
            },
          ]
        : [],
    }),
    [coordinates],
  );
  const hasFilters = Boolean(query.trim() || activePrefectureId || selectedTags.length);

  useEffect(() => {
    if (mapReady && coordinates)
      camera.current?.flyTo({ center: [coordinates.longitude, coordinates.latitude], zoom: 13.5, duration: 1000 });
  }, [mapReady, coordinates]);

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((selected) => selected !== tag) : [...current, tag],
    );
  }

  function clearFilters() {
    setQuery("");
    setSelectedPrefectureId(null);
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
                const selected = activePrefectureId === prefecture.id;
                return (
                  <Pressable
                    key={prefecture.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedPrefectureId(selected ? null : prefecture.id)}
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
                      {prefecture.name}
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
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={labels.locate}
          accessibilityState={{ disabled: locationState.status === "requesting" }}
          disabled={locationState.status === "requesting"}
          onPress={onRequestLocation}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 12,
            borderWidth: 1,
            borderRadius: 8,
            alignSelf: "flex-start",
          }}
        >
          <Text>{locationState.status === "requesting" ? labels.locating : labels.locate}</Text>
        </Pressable>
        <Text>{labels.privacy}</Text>
        {locationState.status === "permission-denied" ? (
          <View accessibilityRole="alert" style={{ gap: 8 }}>
            <Text>{locationState.canAskAgain ? labels.denied : labels.blocked}</Text>
            {!locationState.canAskAgain ? (
              <Pressable
                accessibilityRole="button"
                onPress={onOpenLocationSettings}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text>{labels.settings}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {locationState.status === "services-disabled" ? (
          <Text accessibilityRole="alert">{labels.servicesDisabled}</Text>
        ) : null}
        {locationState.status === "timeout" ? <Text accessibilityRole="alert">{labels.locationTimeout}</Text> : null}
        {locationState.status === "error" ? <Text accessibilityRole="alert">{labels.locationError}</Text> : null}
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
          onDidFinishLoadingMap={() => {
            setMapFailed(false);
            setMapReady(true);
          }}
          onDidFailLoadingMap={() => {
            setMapFailed(true);
            setMapReady(false);
          }}
          style={{ flex: 1 }}
        >
          <Camera
            ref={camera}
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
          {coordinates ? (
            <GeoJSONSource id="current-location" data={locationFeature} onPress={() => undefined}>
              <Layer
                id="current-location-marker"
                type="circle"
                paint={{
                  "circle-color": "#2563eb",
                  "circle-radius": 9,
                  "circle-stroke-color": "#ffffff",
                  "circle-stroke-width": 3,
                }}
              />
            </GeoJSONSource>
          ) : null}
        </Map>
      )}
      <View style={{ padding: 16, gap: 8, borderTopWidth: 1 }}>
        {dataReady ? <Text accessibilityRole="header">{labels.count(filteredPubs.length)}</Text> : null}
        {dataReady && pubs.length === 0 ? <Text>{labels.noPubs}</Text> : null}
        {dataReady && pubs.length > 0 && filteredPubs.length === 0 ? <Text>{labels.noMatches}</Text> : null}
        {selectedPub ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locale === "ja" ? `${selectedPub.name}の詳細` : `Details for ${selectedPub.name}`}
            onPress={() => onOpenPub(selectedPub.id)}
            accessibilityLiveRegion="polite"
            style={{ gap: 4, minHeight: 44, justifyContent: "center" }}
          >
            <Text accessibilityRole="header" style={{ fontWeight: "700" }}>
              {selectedPub.name}
            </Text>
            <Text>{selectedPub.address}</Text>
          </Pressable>
        ) : null}
        {coordinates ? (
          <View>
            <Text accessibilityRole="header">{labels.nearby}</Text>
            {nearbyPubs.length === 0 ? <Text>{labels.noNearby}</Text> : null}
            {nearbyPubs.map(({ pub: nearbyPub, distanceKm }) => (
              <Pressable
                key={nearbyPub.id}
                accessibilityRole="button"
                accessibilityLabel={`${nearbyPub.name}, ${labels.distance(distanceKm)}`}
                onPress={() => {
                  onSelectPub(nearbyPub.id);
                  onOpenPub(nearbyPub.id);
                }}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text>
                  {nearbyPub.name} · {labels.distance(distanceKm)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

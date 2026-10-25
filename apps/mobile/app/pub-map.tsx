import { Camera, GeoJSONSource, Layer, Map, TransformRequestManager } from "@maplibre/maplibre-react-native";
import type { Locale, Pub } from "@irishpub-map/shared";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
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
    mapError: "地図を読み込めませんでした。通信状況を確認して、もう一度お試しください。",
    retry: "地図を再読み込み",
  },
  en: {
    count: (count: number) => `${count} pubs`,
    noPubs: "There are no pubs to show on the map.",
    mapError: "The map could not be loaded. Check your connection and try again.",
    retry: "Reload map",
  },
} satisfies Record<Locale, { count: (count: number) => string; noPubs: string; mapError: string; retry: string }>;

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
  const selectedPub = pubs.find((pub) => pub.id === selectedPubId);
  const labels = copy[locale];

  return (
    <View style={{ flex: 1, minHeight: 320 }}>
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
          <Camera initialViewState={{ center: [138, 37], zoom: 4.5 }} />
          <GeoJSONSource
            id="pubs"
            data={toPubFeatureCollection(pubs)}
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
        {dataReady ? <Text accessibilityRole="header">{labels.count(pubs.length)}</Text> : null}
        {dataReady && pubs.length === 0 ? <Text>{labels.noPubs}</Text> : null}
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

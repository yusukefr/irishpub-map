"use client";

import { useEffect, useRef, useState } from "react";
import { Map, Marker, NavigationControl, Popup, type ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Pub } from "@irishpub-map/shared/pub";
import type { Coordinates } from "../lib/pub-search";
import { formatMessage, getTranslation, type Locale } from "../lib/i18n";

const NON_OPEN_PUB_MARKER_COLOR = "#6b7280";

const DEFAULT_MAP_CENTER: [number, number] = [139.767, 35.681];
const DEFAULT_MAP_ZOOM = 5;
const CURRENT_LOCATION_ZOOM = 12;

const OPENFREEMAP_BRIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
const PREFECTURE_MAP_ZOOM = 10;
const PREFECTURE_MAP_PADDING = 48;

const EMPTY_FOCUS_PUBS: Pub[] = [];

type PubMapProps = {
  pubs: Pub[];
  focusPubs?: Pub[];
  currentLocation?: Coordinates | null;
  selectedPubId?: string | null;
  onSelectPub?: (pubId: string) => void;
  locale?: Locale;
};

/**
 * 店舗ピン、選択状態、表示範囲をMapLibre上へ同期します。
 * @param {{ pubs: Pub[]; focusPubs?: Pub[]; currentLocation?: Coordinates | null; selectedPubId?: string | null; onSelectPub?: (pubId: string) => void }} root0 - 地図表示の状態。
 * @param {Pub[]} root0.pubs - 地図へ表示する店舗一覧。
 * @param {Pub[]} root0.focusPubs - 表示範囲を合わせる店舗一覧。
 * @param {Coordinates | null | undefined} root0.currentLocation - 現在地。
 * @param {string | null | undefined} root0.selectedPubId - 選択中の店舗ID。
 * @param {(pubId: string) => void} root0.onSelectPub - 店舗選択時のコールバック。
 * @returns {JSX.Element} 店舗地図、またはWebGL非対応時のフォールバック。
 */
export function PubMap({
  pubs,
  focusPubs = EMPTY_FOCUS_PUBS,
  currentLocation = null,
  selectedPubId = null,
  onSelectPub = () => undefined,
  locale = "ja",
}: PubMapProps) {
  const t = getTranslation(locale);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerElementsRef = useRef(new globalThis.Map<string, HTMLButtonElement>());
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef(new globalThis.Map<string, Marker>());
  const currentLocationMarkerRef = useRef<Marker | null>(null);
  // 選択コールバックの変更だけでMapLibreインスタンスを作り直さないようrefで保持します。
  const onSelectPubRef = useRef(onSelectPub);
  const localeRef = useRef(locale);
  const hasLoadedMapRef = useRef(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onSelectPubRef.current = onSelectPub;
  }, [onSelectPub]);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    const container = containerRef.current;
    const markers = markersRef.current;
    const markerElements = markerElementsRef.current;

    if (!container) {
      return;
    }

    // MapLibre初期化中の同期的なstate更新を避け、フォールバックを次のタスクで表示します。
    const showFallback = () => {
      setMapUnavailable(true);
    };

    if (!canCreateWebglContext()) {
      showFallback();
      return;
    }

    let map: Map;
    let handleMapLoad: () => void;
    let handleMapError: () => void;
    markerElements.clear();
    markers.clear();

    try {
      map = new Map({
        container,
        style: OPENFREEMAP_BRIGHT_STYLE_URL,
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MAP_ZOOM,
      });

      map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
      handleMapLoad = () => {
        hasLoadedMapRef.current = true;
        updateMapLabelLanguage(map, localeRef.current);
        setMapStatus((status) => (status === "error" ? status : "ready"));
      };
      handleMapError = () => {
        if (!hasLoadedMapRef.current) {
          setMapStatus("error");
        }
      };
      map.on("load", handleMapLoad);
      map.on("error", handleMapError);
      mapRef.current = map;
    } catch (error) {
      console.error("Failed to initialize the map.", error);
      showFallback();
      return;
    }

    return () => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
      markerElements.clear();
      currentLocationMarkerRef.current?.remove();
      currentLocationMarkerRef.current = null;
      map.off("load", handleMapLoad);
      map.off("error", handleMapError);
      mapRef.current = null;
      hasLoadedMapRef.current = false;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    markerElementsRef.current.clear();

    pubs.forEach((pub) => {
      const popup = new Popup({ offset: 18 }).setDOMContent(createPopupContent(pub));
      const markerElement = createMarkerElement(
        pub,
        false,
        () => onSelectPubRef.current(pub.id),
        (name) => formatMessage(t.map.selectPub, { name }),
      );
      const marker = new Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat([pub.longitude, pub.latitude])
        .setPopup(popup)
        .addTo(map);

      markerElementsRef.current.set(pub.id, markerElement);
      markersRef.current.set(pub.id, marker);
    });
  }, [pubs, t.map.selectPub]);

  useEffect(() => {
    const map = mapRef.current;

    currentLocationMarkerRef.current?.remove();
    currentLocationMarkerRef.current = null;

    if (!map || !currentLocation) {
      return;
    }

    const marker = new Marker({
      element: createCurrentLocationMarkerElement(t.map.currentLocation),
      anchor: "center",
    })
      .setLngLat([currentLocation.longitude, currentLocation.latitude])
      .addTo(map);

    currentLocationMarkerRef.current = marker;
  }, [currentLocation, t.map.currentLocation]);

  useEffect(() => {
    const map = mapRef.current;

    if (map) {
      focusMap(map, focusPubs, currentLocation);
    }
  }, [currentLocation, focusPubs]);

  useEffect(() => {
    markerElementsRef.current.forEach((marker, pubId) => {
      const isSelected = pubId === selectedPubId;
      marker.classList.toggle("pub-map-marker-selected", isSelected);
      marker.setAttribute("aria-pressed", String(isSelected));
    });
  }, [pubs, selectedPubId]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || mapStatus !== "ready") {
      return;
    }

    updateMapLabelLanguage(map, locale);
  }, [locale, mapStatus]);

  return (
    <div className="map-canvas" ref={containerRef} aria-label={t.map.locationsLabel}>
      {mapUnavailable ? (
        <div className="map-fallback" role="status">
          <h2>{t.map.unavailableHeading}</h2>
          <p>{t.map.unavailableDescription}</p>
        </div>
      ) : mapStatus === "error" ? (
        <div className="map-error" role="alert" aria-live="assertive">
          <h2>{t.map.errorHeading}</h2>
          <p>{t.map.errorDescription}</p>
        </div>
      ) : mapStatus === "loading" ? (
        <div className="map-loading" role="status" aria-live="polite">
          <span className="map-loading-indicator" aria-hidden="true" />
          <p>{t.map.loading}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * ベクタースタイルの地名ラベルを選択言語へ切り替えます。
 * @param {Map} map - 更新対象のMapLibre地図。
 * @param {Locale} locale - 地名に使う言語。
 * @returns {void}
 */
function updateMapLabelLanguage(map: Map, locale: Locale) {
  const textField: ExpressionSpecification = ["coalesce", ["get", `name:${locale}`], ["get", "name"]];

  map.getStyle().layers?.forEach((layer) => {
    if (layer.type === "symbol" && layer.layout?.["text-field"] !== undefined) {
      map.setLayoutProperty(layer.id, "text-field", textField);
    }
  });
}

/** MapLibreを初期化する前に、ブラウザがWebGLコンテキストを作成できるか確認します。 */
function canCreateWebglContext() {
  const canvas = document.createElement("canvas");

  return Boolean(
    canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false }) ??
    canvas.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: false }),
  );
}

function createPopupContent(pub: Pub) {
  const content = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = pub.name;
  const location = document.createElement("span");
  location.textContent = `${pub.prefecture}${pub.city ? ` / ${pub.city}` : ""}`;

  content.append(name, document.createElement("br"), location);

  return content;
}

function createMarkerElement(
  pub: Pub,
  isSelected: boolean,
  onSelect: () => void,
  selectLabel: (name: string) => string,
) {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = [
    "pub-map-marker",
    `pub-map-marker-${pub.status}`,
    pub.status === "open" ? "pub-map-marker-guinness" : "",
    isSelected ? "pub-map-marker-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
  marker.setAttribute("aria-label", selectLabel(pub.name));
  marker.setAttribute("aria-pressed", String(isSelected));
  marker.addEventListener("click", onSelect);

  if (pub.status !== "open") {
    marker.style.setProperty("--pub-marker-color", NON_OPEN_PUB_MARKER_COLOR);
    marker.append(document.createElement("span"));

    return marker;
  }

  const glass = document.createElement("span");
  glass.className = "pub-map-marker-glass";

  const foam = document.createElement("span");
  foam.className = "pub-map-marker-foam";

  const stout = document.createElement("span");
  stout.className = "pub-map-marker-stout";

  glass.append(foam, stout);
  marker.append(glass);

  return marker;
}

function createCurrentLocationMarkerElement(label: string) {
  const marker = document.createElement("div");
  marker.className = "current-location-marker";
  marker.setAttribute("role", "img");
  marker.setAttribute("aria-label", label);
  marker.title = label;

  return marker;
}

/** 絞り込み対象または現在地に応じて、地図の初期表示範囲を調整します。 */
function focusMap(map: Map, focusPubs: Pub[], currentLocation: Coordinates | null) {
  if (focusPubs.length === 1) {
    const [pub] = focusPubs;
    map.jumpTo({
      center: [pub.longitude, pub.latitude],
      zoom: PREFECTURE_MAP_ZOOM,
    });
    return;
  }

  if (focusPubs.length > 1) {
    const longitudes = focusPubs.map((pub) => pub.longitude);
    const latitudes = focusPubs.map((pub) => pub.latitude);

    map.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      { maxZoom: PREFECTURE_MAP_ZOOM, padding: PREFECTURE_MAP_PADDING },
    );
    return;
  }

  if (currentLocation) {
    map.jumpTo({
      center: [currentLocation.longitude, currentLocation.latitude],
      zoom: CURRENT_LOCATION_ZOOM,
    });
  }
}

"use client";

import { useEffect, useRef, useState } from "react";
import { type ErrorEvent, Map, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Pub } from "@irishpub-map/shared/pub";
import type { Coordinates } from "../lib/pub-search";
import { DEFAULT_LOCALE, formatMessage, getTranslation, type Locale, type Translation } from "../lib/i18n";

const NON_OPEN_PUB_MARKER_COLOR = "#6b7280";

const DEFAULT_MAP_CENTER: [number, number] = [139.767, 35.681];
const DEFAULT_MAP_ZOOM = 5;
const CURRENT_LOCATION_ZOOM = 12;
const MAP_LOAD_TIMEOUT_MS = 15_000;
const POPUP_CLOSE_DELAY_MS = 160;
const HOVER_POINTER_MEDIA_QUERY = "(hover: hover) and (pointer: fine)";

const OPEN_FREE_MAP_BRIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const PREFECTURE_MAP_ZOOM = 10;
const PREFECTURE_MAP_PADDING = 48;

const EMPTY_FOCUS_PUBS: Pub[] = [];
const PLACE_LABEL_LAYER_IDS = [
  "label_country_1",
  "label_country_2",
  "label_country_3",
  "label_state",
  "label_city",
  "label_city_capital",
  "label_town",
  "label_village",
  "label_other",
] as const;

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
  locale = DEFAULT_LOCALE,
}: PubMapProps) {
  const t = getTranslation(locale);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerElementsRef = useRef(new globalThis.Map<string, HTMLButtonElement>());
  const mapRef = useRef<Map | null>(null);
  // Style の非同期ロード完了時にも最新のサイト言語を反映します。
  const localeRef = useRef(locale);
  const markersRef = useRef(new globalThis.Map<string, Marker>());
  const activePopupRef = useRef<Popup | null>(null);
  const currentLocationMarkerRef = useRef<Marker | null>(null);
  // 選択コールバックの変更だけでMapLibreインスタンスを作り直さないようrefで保持します。
  const onSelectPubRef = useRef(onSelectPub);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onSelectPubRef.current = onSelectPub;
  }, [onSelectPub]);

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
    let handleMapError: (event: ErrorEvent) => void;
    let loadTimeoutId: number | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let didLoad = false;
    markerElements.clear();
    markers.clear();

    try {
      // Next.jsがWorkerのmodule URLを解決しないため、build前に配置した自サイト配下のWorkerを明示します。
      setWorkerUrl(MAPLIBRE_WORKER_URL);
      map = new Map({
        container,
        // OpenFreeMap Bright は多言語属性を持つベクタースタイルです。MapLibre の標準帰属表示で必要な帰属を表示します。
        style: OPEN_FREE_MAP_BRIGHT_STYLE_URL,
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MAP_ZOOM,
      });

      map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
      loadTimeoutId = window.setTimeout(() => {
        if (!didLoad) {
          setMapStatus("error");
        }
      }, MAP_LOAD_TIMEOUT_MS);
      handleMapLoad = () => {
        didLoad = true;
        window.clearTimeout(loadTimeoutId);
        applyMapLanguage(map, localeRef.current);
        setMapStatus("ready");
      };
      handleMapError = (event) => {
        // タイル等の一部リソース失敗でも発生するため、初回ロード監視を継続します。
        console.warn("MapLibre resource error.", event.error);
      };
      map.on("load", handleMapLoad);
      map.on("error", handleMapError);
      mapRef.current = map;
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(container);
      }
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
      window.clearTimeout(loadTimeoutId);
      resizeObserver?.disconnect();
      map.off("load", handleMapLoad);
      map.off("error", handleMapError);
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    localeRef.current = locale;
    const map = mapRef.current;

    if (map?.isStyleLoaded()) {
      applyMapLanguage(map, locale);
    }
  }, [locale]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    markerElementsRef.current.clear();
    const popupInteractionCleanups: Array<() => void> = [];

    pubs.forEach((pub) => {
      const popupContent = createPopupContent(pub, t);
      const popup = new Popup({
        offset: 18,
        closeButton: false,
        closeOnClick: true,
        className: "pub-map-popup",
      })
        .setLngLat([pub.longitude, pub.latitude])
        .setMaxWidth("min(320px, calc(100vw - 32px))")
        .setDOMContent(popupContent);
      const markerElement = createMarkerElement(
        pub,
        false,
        () => onSelectPubRef.current(pub.id),
        (name) => formatMessage(t.map.selectPub, { name }),
      );
      const marker = new Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat([pub.longitude, pub.latitude])
        .addTo(map);

      markerElementsRef.current.set(pub.id, markerElement);
      markersRef.current.set(pub.id, marker);
      popupInteractionCleanups.push(enablePopupInteractions(markerElement, popupContent, popup, map, activePopupRef));
    });

    return () => {
      popupInteractionCleanups.forEach((cleanup) => cleanup());
    };
  }, [pubs, t]);

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
 * OpenFreeMap Bright の主要な地名レイヤーだけを、サイト言語と同じ名称へ切り替えます。
 * @param {Map} map - Style のロード完了後の MapLibre インスタンス。
 * @param {Locale} locale - サイト全体で選択された表示言語。
 * @returns {void}
 */
function applyMapLanguage(map: Map, locale: Locale): void {
  const localizedName = `name:${locale}`;
  const textField: ["coalesce", ["get", string], ["get", string]] = [
    "coalesce",
    ["get", localizedName],
    ["get", "name"],
  ];

  PLACE_LABEL_LAYER_IDS.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "text-field", textField);
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

function createPopupContent(pub: Pub, t: Translation) {
  const content = document.createElement("div");
  content.className = "pub-map-popup-card";

  const name = document.createElement("h3");
  name.className = "pub-map-popup-name";
  name.textContent = pub.name;
  const address = document.createElement("p");
  address.className = "pub-map-popup-address";
  address.textContent = pub.address;

  content.append(name, address);

  const links = [
    createPopupLink(pub.websiteUrl, {
      className: "pub-map-popup-website",
      label: formatMessage(t.list.officialWebsiteNewTab, { name: pub.name }),
      text: t.list.officialWebsite,
      icon: createExternalLinkIcon(),
    }),
    createPopupLink(pub.googleMapsUrl, {
      className: "pub-map-popup-icon-link",
      label: formatMessage(t.list.externalServiceNewTab, { name: pub.name, service: "Google Maps" }),
      title: "Google Maps",
      icon: createMapPinIcon(),
    }),
    createPopupLink(pub.instagramUrl, {
      className: "pub-map-popup-icon-link",
      label: formatMessage(t.list.externalServiceNewTab, { name: pub.name, service: "Instagram" }),
      title: "Instagram",
      icon: createInstagramIcon(),
    }),
  ].filter((link): link is HTMLAnchorElement => link !== null);

  if (links.length > 0) {
    const linkGroup = document.createElement("div");
    linkGroup.className = "pub-map-popup-links";
    linkGroup.setAttribute("role", "group");
    linkGroup.setAttribute("aria-label", formatMessage(t.list.externalLinksLabel, { name: pub.name }));
    linkGroup.append(...links);
    content.append(linkGroup);
  }

  return content;
}

type PopupLinkOptions = {
  className: string;
  label: string;
  text?: string;
  title?: string;
  icon: SVGSVGElement;
};

function createPopupLink(href: string | null | undefined, options: PopupLinkOptions) {
  const safeHref = getSafeExternalUrl(href);

  if (!safeHref) {
    return null;
  }

  const link = document.createElement("a");
  link.className = options.className;
  link.href = safeHref;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", options.label);

  if (options.title) {
    link.title = options.title;
  }

  if (options.text) {
    const label = document.createElement("span");
    label.textContent = options.text;
    link.append(label);
  }

  link.append(options.icon);
  return link;
}

function getSafeExternalUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function createSvgIcon() {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("viewBox", "0 0 24 24");
  return icon;
}

function createExternalLinkIcon() {
  const icon = createSvgIcon();
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5");
  icon.append(path);
  return icon;
}

function createMapPinIcon() {
  const icon = createSvgIcon();
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M20 10c0 5-8 10-8 10S4 15 4 10a8 8 0 1 1 16 0Z");
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "10");
  circle.setAttribute("r", "2.5");
  icon.append(path, circle);
  return icon;
}

function createInstagramIcon() {
  const icon = createSvgIcon();
  const outline = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  outline.setAttribute("x", "3.5");
  outline.setAttribute("y", "3.5");
  outline.setAttribute("width", "17");
  outline.setAttribute("height", "17");
  outline.setAttribute("rx", "4.5");
  const lens = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  lens.setAttribute("cx", "12");
  lens.setAttribute("cy", "12");
  lens.setAttribute("r", "4");
  const indicator = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  indicator.setAttribute("cx", "17.3");
  indicator.setAttribute("cy", "6.8");
  indicator.setAttribute("r", "1");
  indicator.classList.add("icon-fill");
  icon.append(outline, lens, indicator);
  return icon;
}

/** hoverの一時表示とclick・tapの固定表示を競合させずに制御します。 */
function enablePopupInteractions(
  markerElement: HTMLElement,
  popupContent: HTMLElement,
  popup: Popup,
  map: Map,
  activePopupRef: { current: Popup | null },
) {
  const canHover = window.matchMedia?.(HOVER_POINTER_MEDIA_QUERY).matches ?? false;
  let markerHovered = false;
  let popupHovered = false;
  let pinned = false;
  let closeTimeoutId: number | undefined;

  const cancelClose = () => {
    window.clearTimeout(closeTimeoutId);
    closeTimeoutId = undefined;
  };
  const openPopup = () => {
    cancelClose();
    if (activePopupRef.current !== popup) {
      activePopupRef.current?.remove();
      activePopupRef.current = popup;
    }
    if (!popup.isOpen()) {
      popup.addTo(map);
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimeoutId = window.setTimeout(() => {
      if (!markerHovered && !popupHovered && !pinned) {
        popup.remove();
      }
    }, POPUP_CLOSE_DELAY_MS);
  };
  const handleMarkerEnter = () => {
    markerHovered = true;
    openPopup();
  };
  const handleMarkerLeave = () => {
    markerHovered = false;
    scheduleClose();
  };
  const handlePopupEnter = () => {
    popupHovered = true;
    cancelClose();
  };
  const handlePopupLeave = () => {
    popupHovered = false;
    scheduleClose();
  };
  const handleMarkerClick = (event: MouseEvent) => {
    event.stopPropagation();
    pinned = true;
    openPopup();
  };
  const handlePopupClose = () => {
    pinned = false;
    if (activePopupRef.current === popup) {
      activePopupRef.current = null;
    }
  };

  markerElement.addEventListener("click", handleMarkerClick);
  popup.on("close", handlePopupClose);
  if (canHover) {
    markerElement.addEventListener("mouseenter", handleMarkerEnter);
    markerElement.addEventListener("mouseleave", handleMarkerLeave);
    popupContent.addEventListener("mouseenter", handlePopupEnter);
    popupContent.addEventListener("mouseleave", handlePopupLeave);
  }

  return () => {
    cancelClose();
    markerElement.removeEventListener("click", handleMarkerClick);
    markerElement.removeEventListener("mouseenter", handleMarkerEnter);
    markerElement.removeEventListener("mouseleave", handleMarkerLeave);
    popupContent.removeEventListener("mouseenter", handlePopupEnter);
    popupContent.removeEventListener("mouseleave", handlePopupLeave);
    popup.remove();
    popup.off("close", handlePopupClose);
    if (activePopupRef.current === popup) {
      activePopupRef.current = null;
    }
  };
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

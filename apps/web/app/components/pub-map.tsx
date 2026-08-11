"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Pub } from "@irishpub-map/shared/pub";
import type { Coordinates } from "../lib/pub-search";

const PUB_MARKER_COLORS = {
  closed: "#d92d20",
  other: "#6b7280"
} as const;

const DEFAULT_MAP_CENTER: [number, number] = [139.767, 35.681];
const DEFAULT_MAP_ZOOM = 5;
const CURRENT_LOCATION_ZOOM = 12;
const PREFECTURE_MAP_ZOOM = 10;
const PREFECTURE_MAP_PADDING = 48;

const EMPTY_FOCUS_PUBS: Pub[] = [];

function getMarkerColor(status: Pub["status"]) {
  if (status === "closed") {
    return PUB_MARKER_COLORS.closed;
  }

  return PUB_MARKER_COLORS.other;
}

function createMarker(pub: Pub) {
  if (pub.status === "open") {
    return new maplibregl.Marker({ element: createGuinnessMarkerElement(), anchor: "bottom" });
  }

  return new maplibregl.Marker({ color: getMarkerColor(pub.status) });
}

type PubMapProps = {
  pubs: Pub[];
  focusPubs?: Pub[];
  currentLocation?: Coordinates | null;
};

export function PubMap({ pubs, focusPubs = EMPTY_FOCUS_PUBS, currentLocation = null }: PubMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const showFallback = () => {
      window.setTimeout(() => setMapUnavailable(true), 0);
    };

    if (!canCreateWebglContext()) {
      showFallback();
      return;
    }

    let map: maplibregl.Map;

    try {
      map = new maplibregl.Map({
        container,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors"
            }
          },
          layers: [
            {
              id: "osm",
              type: "raster",
              source: "osm"
            }
          ]
        },
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MAP_ZOOM
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      focusMap(map, focusPubs, currentLocation);

      pubs.forEach((pub) => {
        const popup = new maplibregl.Popup({ offset: 18 }).setDOMContent(createPopupContent(pub));

        createMarker(pub)
          .setLngLat([pub.longitude, pub.latitude])
          .setPopup(popup)
          .addTo(map);
      });
    } catch (error) {
      console.error("Failed to initialize the map.", error);
      showFallback();
      return;
    }

    return () => {
      map.remove();
    };
  }, [currentLocation, focusPubs, pubs]);

  return (
    <div className="map-canvas" ref={containerRef} aria-label="Irish Pub locations">
      {mapUnavailable ? (
        <div className="map-fallback" role="status">
          <h2>地図を表示できませんでした</h2>
          <p>
            このブラウザ環境ではWebGLが無効、または利用できないため地図を初期化できません。
            右側または下部の店舗一覧からIrish Pubを確認してください。
          </p>
        </div>
      ) : null}
    </div>
  );
}

function canCreateWebglContext() {
  const canvas = document.createElement("canvas");

  return Boolean(
    canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false }) ??
      canvas.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: false })
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

function createGuinnessMarkerElement() {
  const marker = document.createElement("div");
  marker.className = "pub-map-marker pub-map-marker-guinness";
  marker.setAttribute("aria-label", "営業中 Irish Pub");

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

function focusMap(map: maplibregl.Map, focusPubs: Pub[], currentLocation: Coordinates | null) {
  if (focusPubs.length === 1) {
    const [pub] = focusPubs;
    map.jumpTo({
      center: [pub.longitude, pub.latitude],
      zoom: PREFECTURE_MAP_ZOOM
    });
    return;
  }

  if (focusPubs.length > 1) {
    const longitudes = focusPubs.map((pub) => pub.longitude);
    const latitudes = focusPubs.map((pub) => pub.latitude);

    map.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)]
      ],
      { maxZoom: PREFECTURE_MAP_ZOOM, padding: PREFECTURE_MAP_PADDING }
    );
    return;
  }

  if (currentLocation) {
    map.jumpTo({
      center: [currentLocation.longitude, currentLocation.latitude],
      zoom: CURRENT_LOCATION_ZOOM
    });
  }
}

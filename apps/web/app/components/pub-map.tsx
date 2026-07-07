"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Pub } from "@irishpub-map/shared/pub";

const PUB_MARKER_COLORS = {
  open: "#0f7b54",
  closed: "#d92d20",
  other: "#6b7280"
} as const;

function getMarkerColor(status: Pub["status"]) {
  if (status === "open") {
    return PUB_MARKER_COLORS.open;
  }

  if (status === "closed") {
    return PUB_MARKER_COLORS.closed;
  }

  return PUB_MARKER_COLORS.other;
}

type PubMapProps = {
  pubs: Pub[];
};

export function PubMap({ pubs }: PubMapProps) {
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
        center: [139.767, 35.681],
        zoom: 5
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

      pubs.forEach((pub) => {
        const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
          `<strong>${pub.name}</strong><br>${pub.prefecture}${pub.city ? ` / ${pub.city}` : ""}`
        );

        new maplibregl.Marker({ color: getMarkerColor(pub.status) })
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
  }, [pubs]);

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

"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Pub } from "@irishpub-map/shared/pub";

type PubMapProps = {
  pubs: Pub[];
};

export function PubMap({ pubs }: PubMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
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

      new maplibregl.Marker({ color: "#0f7b54" })
        .setLngLat([pub.longitude, pub.latitude])
        .setPopup(popup)
        .addTo(map);
    });

    return () => {
      map.remove();
    };
  }, [pubs]);

  return <div className="map-canvas" ref={containerRef} aria-label="Irish Pub locations" />;
}

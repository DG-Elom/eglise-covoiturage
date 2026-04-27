"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapMarker = {
  lat: number;
  lng: number;
  color?: string;
  label?: string;
};

export type MapCircle = {
  lat: number;
  lng: number;
  radiusKm: number;
};

type MapProps = {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  circle?: MapCircle;
  onClick?: (lng: number, lat: number) => void;
  className?: string;
};

const CIRCLE_SOURCE = "detour-circle";
const CIRCLE_FILL = "detour-circle-fill";
const CIRCLE_LINE = "detour-circle-line";

function circlePolygon(lat: number, lng: number, radiusKm: number, points = 64) {
  const coords: [number, number][] = [];
  const distanceX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusKm / 110.574;
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    coords.push([lng + distanceX * Math.cos(theta), lat + distanceY * Math.sin(theta)]);
  }
  coords.push(coords[0]);
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [coords] },
    properties: {},
  };
}

export function Map({
  center = [-4.0083, 5.36],
  zoom = 12,
  markers = [],
  circle,
  onClick,
  className = "h-96 w-full rounded-xl overflow-hidden",
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.warn("NEXT_PUBLIC_MAPBOX_TOKEN manquant");
      return;
    }
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    if (onClick) {
      map.on("click", (e) => onClick(e.lngLat.lng, e.lngLat.lat));
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom, onClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = markers.map((m) => {
      const marker = new mapboxgl.Marker({ color: m.color ?? "#10b981" }).setLngLat([
        m.lng,
        m.lat,
      ]);
      if (m.label) {
        marker.setPopup(new mapboxgl.Popup({ offset: 24 }).setText(m.label));
      }
      marker.addTo(map);
      return marker;
    });
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      if (!circle) {
        if (map.getLayer(CIRCLE_FILL)) map.removeLayer(CIRCLE_FILL);
        if (map.getLayer(CIRCLE_LINE)) map.removeLayer(CIRCLE_LINE);
        if (map.getSource(CIRCLE_SOURCE)) map.removeSource(CIRCLE_SOURCE);
        return;
      }
      const data = circlePolygon(circle.lat, circle.lng, circle.radiusKm);
      const src = map.getSource(CIRCLE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
      } else {
        map.addSource(CIRCLE_SOURCE, { type: "geojson", data });
        map.addLayer({
          id: CIRCLE_FILL,
          type: "fill",
          source: CIRCLE_SOURCE,
          paint: { "fill-color": "#10b981", "fill-opacity": 0.15 },
        });
        map.addLayer({
          id: CIRCLE_LINE,
          type: "line",
          source: CIRCLE_SOURCE,
          paint: { "line-color": "#059669", "line-width": 2 },
        });
      }

      const dx = circle.radiusKm / (111.32 * Math.cos((circle.lat * Math.PI) / 180));
      const dy = circle.radiusKm / 110.574;
      map.fitBounds(
        [
          [circle.lng - dx, circle.lat - dy],
          [circle.lng + dx, circle.lat + dy],
        ],
        { padding: 32, duration: 400 },
      );
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [circle]);

  return <div ref={containerRef} className={className} />;
}

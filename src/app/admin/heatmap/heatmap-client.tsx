"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type DaysOption = 7 | 30 | 90;

const DAYS_OPTIONS: { label: string; value: DaysOption }[] = [
  { label: "7 derniers jours", value: 7 },
  { label: "30 derniers jours", value: 30 },
  { label: "90 derniers jours", value: 90 },
];

const HEATMAP_SOURCE = "heatmap-source";
const HEATMAP_LAYER = "heatmap-layer";
const HEATMAP_POINTS_LAYER = "heatmap-points";

type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { weight: number };
  }[];
};

export function HeatmapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [days, setDays] = useState<DaysOption>(30);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [totalDemandes, setTotalDemandes] = useState(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [6.175955, 49.146943],
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource(HEATMAP_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: HEATMAP_LAYER,
        type: "heatmap",
        source: HEATMAP_SOURCE,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 10, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(0,0,255,0)",
            0.1, "royalblue",
            0.3, "cyan",
            0.5, "lime",
            0.7, "yellow",
            1, "red",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 15, 30],
          "heatmap-opacity": 0.75,
        },
      });

      map.addLayer({
        id: HEATMAP_POINTS_LAYER,
        type: "circle",
        source: HEATMAP_SOURCE,
        minzoom: 14,
        paint: {
          "circle-radius": 5,
          "circle-color": "rgba(255,100,50,0.7)",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      });

      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const fetchAndUpdate = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setLoading(true);
    fetch(`/api/admin/heatmap-data?days=${days}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: GeoJSONFeatureCollection | null) => {
        if (!data) return;
        const src = map.getSource(HEATMAP_SOURCE) as mapboxgl.GeoJSONSource | undefined;
        src?.setData(data);
        setTotalDemandes(data.features.reduce((acc, f) => acc + (f.properties.weight ?? 1), 0));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days, mapReady]);

  useEffect(() => {
    fetchAndUpdate();
  }, [fetchAndUpdate]);

  return (
    <div className="relative h-full flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        {DAYS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDays(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-sm border transition ${
              days === opt.value
                ? "border-emerald-500 bg-emerald-950/60 text-emerald-300"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {loading && <span className="text-xs text-slate-400">Chargement…</span>}
      </div>

      <div className="relative flex-1 min-h-[500px]">
        <div ref={containerRef} className="h-full w-full rounded-xl overflow-hidden" />

        <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-slate-900/90 border border-slate-700 px-4 py-3 text-sm text-slate-300 shadow-lg">
          <p className="font-semibold text-white mb-1">Demandes non satisfaites</p>
          <p className="text-xs text-slate-400">
            {DAYS_OPTIONS.find((o) => o.value === days)?.label} · {totalDemandes} demande(s)
          </p>
          <div className="mt-2 flex items-center gap-1">
            <div className="h-2 w-24 rounded-full" style={{
              background: "linear-gradient(to right, royalblue, cyan, lime, yellow, red)"
            }} />
            <span className="text-xs text-slate-500 ml-1">faible → forte densité</span>
          </div>
        </div>
      </div>
    </div>
  );
}

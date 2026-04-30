"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Filter } from "lucide-react";

type TrajetAnonyme = {
  trajet_id: string;
  depart_lat: number;
  depart_lng: number;
  sens: "aller" | "retour" | "aller_retour";
  places_total: number;
  jour_culte: string;
  heure_culte: string;
};

const ICC_METZ: [number, number] = [6.175955, 49.146943];
const CLUSTER_SOURCE = "conducteurs-cluster";
const CLUSTER_LAYER = "clusters";
const CLUSTER_COUNT_LAYER = "cluster-count";
const UNCLUSTERED_LAYER = "unclustered-point";

function formatHeure(heure: string): string {
  return heure.slice(0, 5);
}

export function CarteSociale({ egliseLng = ICC_METZ[0], egliseLat = ICC_METZ[1] }: {
  egliseLng?: number;
  egliseLat?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const [conducteurs, setConducteurs] = useState<TrajetAnonyme[]>([]);
  const [loading, setLoading] = useState(true);
  const [culteFilter, setCulteFilter] = useState<string>("tous");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const cultes = Array.from(new Set(conducteurs.map((c) => c.jour_culte)));

  const filtered = culteFilter === "tous"
    ? conducteurs
    : conducteurs.filter((c) => c.jour_culte === culteFilter);

  useEffect(() => {
    fetch("/api/map/conducteurs-actifs")
      .then((r) => r.json())
      .then((d: { conducteurs?: TrajetAnonyme[] }) => {
        setConducteurs(d.conducteurs ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: prefersDark
        ? "mapbox://styles/mapbox/dark-v11"
        : "mapbox://styles/mapbox/light-v11",
      center: [egliseLng, egliseLat],
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource(CLUSTER_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: CLUSTER_LAYER,
        type: "circle",
        source: CLUSTER_SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#10b981",
          "circle-radius": ["step", ["get", "point_count"], 20, 5, 30, 10, 40],
          "circle-opacity": 0.8,
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: "symbol",
        source: CLUSTER_SOURCE,
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 13,
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: UNCLUSTERED_LAYER,
        type: "circle",
        source: CLUSTER_SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#059669",
          "circle-radius": 10,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", CLUSTER_LAYER, (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id as number | undefined;
        if (clusterId === undefined) return;
        const src = map.getSource(CLUSTER_SOURCE) as mapboxgl.GeoJSONSource;
        src.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          const center = (features[0].geometry as unknown as { coordinates: [number, number] }).coordinates;
          map.easeTo({ center, zoom: zoom ?? 14 });
        });
      });

      map.on("click", UNCLUSTERED_LAYER, (e) => {
        if (!e.features?.length) return;
        const f = e.features[0];
        const props = f.properties as {
          trajet_id: string;
          jour_culte: string;
          heure_culte: string;
          places_total: number;
          sens: string;
        };
        const coords = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;

        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 16 })
          .setLngLat(coords)
          .setHTML(
            `<div class="text-sm leading-relaxed">
              <p class="font-semibold">${props.jour_culte}</p>
              <p>Départ à ${formatHeure(props.heure_culte)} · ${props.sens === "aller" ? "Aller" : props.sens === "retour" ? "Retour" : "Aller-Retour"}</p>
              <p>${props.places_total} place(s)</p>
              <a href="/trajets/${props.trajet_id}" class="text-emerald-600 underline hover:text-emerald-700">Voir ce trajet →</a>
            </div>`,
          )
          .addTo(map);
      });

      map.on("mouseenter", CLUSTER_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", CLUSTER_LAYER, () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", UNCLUSTERED_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", UNCLUSTERED_LAYER, () => { map.getCanvas().style.cursor = ""; });

      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [egliseLng, egliseLat]);

  const updateMapData = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource(CLUSTER_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;

    const features = filtered.map((c) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [c.depart_lng, c.depart_lat] as [number, number] },
      properties: {
        trajet_id: c.trajet_id,
        jour_culte: c.jour_culte,
        heure_culte: c.heure_culte,
        places_total: c.places_total,
        sens: c.sens,
      },
    }));
    src.setData({ type: "FeatureCollection", features });
  }, [filtered, mapReady]);

  useEffect(() => {
    updateMapData();
  }, [updateMapData]);

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-slate-900/70 rounded-xl">
          <span className="text-sm text-slate-600 dark:text-slate-400">Chargement des conducteurs…</span>
        </div>
      )}

      <div ref={containerRef} className="h-96 w-full rounded-xl overflow-hidden" />

      <div className="absolute bottom-4 left-4 z-10">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilterMenu((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <Filter className="size-4" />
            {culteFilter === "tous" ? "Filtrer par culte" : culteFilter}
          </button>

          {showFilterMenu && (
            <div className="absolute bottom-full mb-2 left-0 min-w-[180px] rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg py-1">
              <button
                type="button"
                onClick={() => { setCulteFilter("tous"); setShowFilterMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Tous les cultes
              </button>
              {cultes.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCulteFilter(c); setShowFilterMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!loading && filtered.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-slate-500 dark:text-slate-400 bg-white/90 dark:bg-slate-900/90 rounded-lg px-4 py-2 shadow">
            Aucun conducteur actif dans cette zone
          </p>
        </div>
      )}
    </div>
  );
}

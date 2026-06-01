"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Avatar } from "@/components/avatar";
import { formatDistance } from "@/lib/distance";

type MiniProfil = {
  id: string;
  prenom: string;
  nom: string;
  photo_url: string | null;
};

type Nearest = {
  trajetId: string;
  conducteur: MiniProfil | null;
  depart_adresse: string;
  distanceKm: number;
} | null;

type Orphelin = {
  id: string;
  passager: MiniProfil | null;
  culte: { libelle: string; heure: string } | null;
  sens: "aller" | "retour";
  date: string;
  pickup_adresse: string;
  notes: string | null;
  position: { lat: number; lng: number } | null;
  joursAttente: number;
  nearest: Nearest;
};

type Offre = {
  id: string;
  lat: number;
  lng: number;
  conducteur: MiniProfil | null;
  depart_adresse: string;
  places_total: number;
  culte_libelle: string;
  sens: string;
};

type MapData = {
  eglise: { lat: number; lng: number };
  cultes: { id: string; libelle: string }[];
  offre: Offre[];
  orphelins: Orphelin[];
  stats: { nbDemandes: number; nbOffres: number; nbSansConducteur: number };
};

const DENSITY_SOURCE = "demande-density";
const DENSITY_LAYER = "demande-density-layer";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

function attente(jours: number): string {
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "depuis 1 jour";
  return `depuis ${jours} jours`;
}

export function CarteClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<Map<string, mapboxgl.Popup>>(new Map());

  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [culte, setCulte] = useState<string>("");
  const [showDensity, setShowDensity] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // --- Init carte (une seule fois) -----------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [6.175955, 49.146943],
      zoom: 11.5,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource(DENSITY_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: DENSITY_LAYER,
        type: "heatmap",
        source: DENSITY_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(0,0,255,0)",
            0.2, "#1e3a8a",
            0.4, "#7c3aed",
            0.6, "#f59e0b",
            1, "#ef4444",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 15, 40],
          "heatmap-opacity": 0.7,
        },
      });
      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // --- Chargement des données (selon le filtre culte) -----------------------
  const loadData = useCallback(() => {
    setLoading(true);
    const qs = culte ? `?culte=${encodeURIComponent(culte)}` : "";
    fetch(`/api/admin/map-data${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MapData | null) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [culte]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Rendu des markers quand données + carte prêtes -----------------------
  const renderMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !data) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.clear();

    // Église (ancre)
    const egEl = document.createElement("div");
    egEl.className =
      "flex size-7 items-center justify-center rounded-full bg-white text-base shadow ring-2 ring-slate-300";
    egEl.textContent = "⛪";
    egEl.title = "Église";
    markersRef.current.push(
      new mapboxgl.Marker({ element: egEl })
        .setLngLat([data.eglise.lng, data.eglise.lat])
        .addTo(map),
    );

    // Offre : conducteurs (vert)
    for (const o of data.offre) {
      const el = document.createElement("div");
      el.className =
        "size-3.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 shadow cursor-pointer";
      const nom = o.conducteur
        ? esc(`${o.conducteur.prenom} ${o.conducteur.nom}`)
        : "Conducteur";
      const link = o.conducteur
        ? `<a href="/u/${esc(o.conducteur.id)}" class="text-emerald-700 underline">Voir le profil</a>`
        : "";
      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false }).setHTML(
        `<div style="font-size:13px;line-height:1.4">
           <strong>🟢 ${nom}</strong><br/>
           ${esc(o.culte_libelle)} · ${o.places_total} place(s)<br/>
           <span style="color:#64748b">${esc(o.depart_adresse)}</span><br/>${link}
         </div>`,
      );
      markersRef.current.push(
        new mapboxgl.Marker({ element: el }).setLngLat([o.lng, o.lat]).setPopup(popup).addTo(map),
      );
    }

    // Demande : passagers en attente (rouge, plus gros si sans conducteur)
    for (const d of data.orphelins) {
      if (!d.position) continue;
      const sansConducteur = d.nearest === null;
      const el = document.createElement("div");
      el.className = sansConducteur
        ? "size-4 rounded-full bg-red-500 ring-2 ring-red-200 shadow cursor-pointer animate-pulse"
        : "size-3.5 rounded-full bg-amber-500 ring-2 ring-amber-200 shadow cursor-pointer";
      const nom = d.passager ? esc(d.passager.prenom) : "Passager";
      const near = d.nearest
        ? `Conducteur le plus proche : <strong>${esc(
            d.nearest.conducteur?.prenom ?? "—",
          )}</strong> · ${esc(formatDistance(d.nearest.distanceKm))}`
        : `<span style="color:#dc2626">⚠ Aucun conducteur sur ce culte</span>`;
      const link = d.passager
        ? `<a href="/u/${esc(d.passager.id)}" class="text-emerald-700 underline">Voir le profil</a>`
        : "";
      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false }).setHTML(
        `<div style="font-size:13px;line-height:1.4">
           <strong>${sansConducteur ? "🔴" : "🟠"} ${nom}</strong> · ${esc(attente(d.joursAttente))}<br/>
           ${esc(d.culte?.libelle ?? "Trajet")} (${esc(d.sens)})<br/>
           <span style="color:#64748b">${esc(d.pickup_adresse)}</span><br/>
           ${near}<br/>${link}
         </div>`,
      );
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([d.position.lng, d.position.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
      popupsRef.current.set(d.id, popup);
    }

    // Densité (calque optionnel) — alimenté par les positions de demande
    const src = map.getSource(DENSITY_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: data.orphelins
        .filter((d) => d.position)
        .map((d) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [d.position!.lng, d.position!.lat],
          },
          properties: {},
        })),
    });
  }, [data, mapReady]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  // Toggle visibilité du calque densité
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer(DENSITY_LAYER)) {
      map.setLayoutProperty(
        DENSITY_LAYER,
        "visibility",
        showDensity ? "visible" : "none",
      );
    }
  }, [showDensity, mapReady]);

  const flyTo = useCallback((o: Orphelin) => {
    const map = mapRef.current;
    if (!map || !o.position) return;
    map.flyTo({ center: [o.position.lng, o.position.lat], zoom: 14 });
    popupsRef.current.get(o.id)?.addTo(map);
  }, []);

  const cultes = data?.cultes ?? [];
  const orphelins = useMemo(() => data?.orphelins ?? [], [data]);
  const stats = data?.stats;

  return (
    <div className="flex flex-col gap-3">
      {/* Filtres + stats */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={culte}
          onChange={(e) => setCulte(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200"
        >
          <option value="">Tous les cultes</option>
          {cultes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.libelle}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowDensity((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-sm transition ${
            showDensity
              ? "border-emerald-500 bg-emerald-950/60 text-emerald-300"
              : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
          }`}
        >
          Vue densité
        </button>

        {loading && <span className="text-xs text-slate-400">Chargement…</span>}

        {stats && (
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="text-amber-400">{stats.nbDemandes} en attente</span>
            <span className="text-emerald-400">{stats.nbOffres} conducteur(s)</span>
            {stats.nbSansConducteur > 0 && (
              <span className="rounded-full bg-red-950/60 px-2 py-0.5 font-medium text-red-300">
                {stats.nbSansConducteur} sans conducteur
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
        {/* Carte */}
        <div className="relative min-h-[480px] lg:min-h-[600px]">
          <div ref={containerRef} className="h-full w-full overflow-hidden rounded-xl" />
          <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-300 shadow-lg">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-emerald-500" /> Conducteur
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-amber-500" /> Passager (couvert)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-red-500" /> Passager sans conducteur
            </span>
          </div>
        </div>

        {/* Panneau d'action : passagers en attente */}
        <aside className="flex max-h-[600px] flex-col gap-2 overflow-y-auto">
          <h2 className="text-sm font-semibold text-slate-200">
            Passagers en attente {orphelins.length > 0 && `(${orphelins.length})`}
          </h2>
          {orphelins.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 bg-slate-900 p-4 text-center text-sm text-slate-500">
              {loading ? "Chargement…" : "Personne en attente. 🎉"}
            </p>
          ) : (
            orphelins.map((o) => {
              const sans = o.nearest === null;
              return (
                <div
                  key={o.id}
                  className={`rounded-xl border p-3 text-sm ${
                    sans
                      ? "border-red-900/60 bg-red-950/30"
                      : "border-slate-700 bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Link href={`/u/${o.passager?.id ?? ""}`} className="shrink-0">
                      <Avatar
                        photoUrl={o.passager?.photo_url ?? null}
                        prenom={o.passager?.prenom ?? "?"}
                        nom={o.passager?.nom ?? ""}
                        size="sm"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/u/${o.passager?.id ?? ""}`}
                        className="font-medium text-slate-100 hover:underline"
                      >
                        {o.passager?.prenom} {o.passager?.nom}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {o.culte?.libelle ?? "Trajet"} · {o.sens} · {attente(o.joursAttente)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => flyTo(o)}
                      className="shrink-0 rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Voir
                    </button>
                  </div>
                  <p className="mt-1.5 truncate text-xs text-slate-500" title={o.pickup_adresse}>
                    📍 {o.pickup_adresse}
                  </p>
                  {sans ? (
                    <p className="mt-1 text-xs font-medium text-red-400">
                      ⚠ Aucun conducteur sur ce culte
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-emerald-400">
                      Plus proche : {o.nearest?.conducteur?.prenom ?? "—"} ·{" "}
                      {formatDistance(o.nearest?.distanceKm ?? 0)}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </aside>
      </div>
    </div>
  );
}

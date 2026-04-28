"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Clock, Church, Car } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Map } from "@/components/map";
import {
  geocodeAddress,
  getOptimizedRoute,
  type OptimizedRoute,
} from "@/lib/mapbox";

export type Passenger = {
  reservationId: string;
  prenom: string;
  nom: string;
  photoUrl: string | null;
  pickupAdresse: string;
};

type GeocodedPassenger = Passenger & { lat: number; lng: number };

export function OptimizedRouteCard({
  conducteurAdresse,
  heureDepart,
  passengers,
  eglisePos,
  egliseLabel = "Église",
}: {
  conducteurAdresse: string;
  heureDepart: string; // HH:MM:SS or HH:MM
  passengers: Passenger[];
  eglisePos: { lat: number; lng: number };
  egliseLabel?: string;
}) {
  const [geocoded, setGeocoded] = useState<GeocodedPassenger[] | null>(null);
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [conducteurDepart, setConducteurDepart] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      // Geocode conducteur address
      const condR = await geocodeAddress(conducteurAdresse);
      if (cancelled) return;
      if (condR.length === 0) {
        setError("Impossible de localiser ton adresse.");
        setLoading(false);
        return;
      }
      const conducteurPos = { lat: condR[0].lat, lng: condR[0].lng };
      setConducteurDepart(conducteurPos);

      // Geocode each passenger's pickup address
      const results: GeocodedPassenger[] = [];
      for (const p of passengers) {
        const r = await geocodeAddress(p.pickupAdresse);
        if (cancelled) return;
        if (r.length > 0) {
          results.push({ ...p, lat: r[0].lat, lng: r[0].lng });
        }
      }
      if (cancelled) return;
      setGeocoded(results);

      if (results.length === 0) {
        setLoading(false);
        return;
      }

      // Build waypoints: conducteur, ...passengers, église
      const waypoints = [
        conducteurPos,
        ...results.map((g) => ({ lat: g.lat, lng: g.lng })),
        eglisePos,
      ];

      const opt = await getOptimizedRoute(waypoints);
      if (cancelled) return;

      if (!opt) {
        setError("Impossible de calculer l'itinéraire optimisé.");
        setLoading(false);
        return;
      }

      setRoute(opt);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [conducteurAdresse, eglisePos, passengers]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
        <Loader2 className="size-3.5 animate-spin" />
        Calcul de l&apos;itinéraire optimal…
      </div>
    );
  }

  if (error || !route || !geocoded || geocoded.length === 0) {
    return null;
  }

  // route.orderedIndices: [0 = conducteur, 1..N = passagers, N+1 = église]
  // We assume source=first, destination=last so orderedIndices[0]=0 and last=N+1.
  // The intermediate indices give pickup order.
  const stops = buildOrderedStops({
    orderedIndices: route.orderedIndices,
    legs: route.legs,
    geocoded,
    conducteurAdresse,
    conducteurDepart: conducteurDepart ?? { lat: 0, lng: 0 },
    eglisePos,
    egliseLabel,
  });

  const departBase = parseHHMM(heureDepart);
  let cursorMs = departBase;
  const stopsWithTime = stops.map((s, i) => {
    cursorMs += (s.legSeconds ?? 0) * 1000;
    const arriveAt = i === 0 ? departBase : cursorMs;
    return { ...s, arriveAtMs: arriveAt };
  });

  const totalMin = Math.round(route.totalDurationSec / 60);
  const arrivalMs = stopsWithTime[stopsWithTime.length - 1].arriveAtMs;

  // Markers ordered by visit
  const markers = stopsWithTime.map((s, i) => ({
    lat: s.lat,
    lng: s.lng,
    label: `${i + 1}. ${s.label}`,
    color:
      s.kind === "depart"
        ? "#0ea5e9"
        : s.kind === "eglise"
          ? "#a855f7"
          : "#10b981",
  }));

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Itinéraire optimisé</h3>
        <p className="text-xs text-slate-500">
          {totalMin} min · {route.totalDistanceKm.toFixed(1)} km
        </p>
      </div>

      <Map
        markers={markers}
        route={{ coordinates: route.geometry.coordinates }}
        center={[geocoded[0].lng, geocoded[0].lat]}
        zoom={13}
        className="h-56 w-full rounded-lg overflow-hidden"
      />

      <ol className="space-y-2 text-sm">
        {stopsWithTime.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                s.kind === "depart"
                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                  : s.kind === "eglise"
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              }`}
            >
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                {s.kind === "passenger" && s.passenger && (
                  <Avatar
                    photoUrl={s.passenger.photoUrl}
                    prenom={s.passenger.prenom}
                    nom={s.passenger.nom}
                    size="xs"
                  />
                )}
                {s.kind === "depart" && (
                  <Car className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                )}
                {s.kind === "eglise" && (
                  <Church className="size-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                )}
                <span className="font-medium">{s.label}</span>
                <span className="ml-auto text-xs text-slate-500 shrink-0">
                  {fmtTime(s.arriveAtMs)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{s.address}</span>
                {i > 0 && s.legSeconds !== undefined && (
                  <>
                    <span className="mx-1 text-slate-400">·</span>
                    <Clock className="size-3 shrink-0" />
                    <span>{Math.round(s.legSeconds / 60)} min</span>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        <span className="font-semibold">Arrivée prévue à l&apos;église :</span>{" "}
        <strong>{fmtTime(arrivalMs)}</strong>
      </div>
    </div>
  );
}

type Stop = {
  kind: "depart" | "passenger" | "eglise";
  label: string;
  address: string;
  lat: number;
  lng: number;
  passenger?: Passenger;
  legSeconds?: number; // duration FROM previous stop
};

function buildOrderedStops({
  orderedIndices,
  legs,
  geocoded,
  conducteurAdresse,
  conducteurDepart,
  eglisePos,
  egliseLabel,
}: {
  orderedIndices: number[];
  legs: { durationSec: number; distanceKm: number }[];
  geocoded: GeocodedPassenger[];
  conducteurAdresse: string;
  conducteurDepart: { lat: number; lng: number };
  eglisePos: { lat: number; lng: number };
  egliseLabel: string;
}): Stop[] {
  const stops: Stop[] = [];
  for (let i = 0; i < orderedIndices.length; i++) {
    const idx = orderedIndices[i];
    const legSec = i === 0 ? 0 : legs[i - 1]?.durationSec ?? 0;
    if (idx === 0) {
      // depart conducteur
      stops.push({
        kind: "depart",
        label: "Toi",
        address: conducteurAdresse,
        lat: conducteurDepart.lat,
        lng: conducteurDepart.lng,
        legSeconds: legSec,
      });
    } else if (idx === geocoded.length + 1) {
      // église
      stops.push({
        kind: "eglise",
        label: egliseLabel,
        address: egliseLabel,
        lat: eglisePos.lat,
        lng: eglisePos.lng,
        legSeconds: legSec,
      });
    } else {
      const p = geocoded[idx - 1];
      if (!p) continue;
      stops.push({
        kind: "passenger",
        label: p.prenom,
        address: p.pickupAdresse,
        lat: p.lat,
        lng: p.lng,
        passenger: p,
        legSeconds: legSec,
      });
    }
  }
  return stops;
}

function parseHHMM(t: string): number {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.getTime();
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

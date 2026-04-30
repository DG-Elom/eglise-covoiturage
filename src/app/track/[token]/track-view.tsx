"use client";

import { useEffect, useMemo, useState } from "react";
import { Map } from "@/components/map";

type Position = {
  lat: number;
  lng: number;
  updatedAt: string;
  conducteurPrenom: string;
  etaMinutes: number | null;
};

type TrackViewProps = {
  token: string;
  expiresAtIso: string;
};

export function TrackView({ token, expiresAtIso }: TrackViewProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchLabel, setLastFetchLabel] = useState<string | null>(null);

  const expiresAt = useMemo(() => new Date(expiresAtIso), [expiresAtIso]);

  const expiresAtFormatted = expiresAt.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchPosition() {
      try {
        const res = await fetch(`/api/track/position/${token}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) {
            setError("Position non disponible — le trajet n'a pas encore demarre.");
          } else if (res.status === 401) {
            setError("Lien expire ou invalide.");
          }
          return;
        }
        const data = (await res.json()) as Position;
        if (cancelled) return;
        setPosition(data);
        setLastFetchLabel("a l'instant");
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Erreur reseau, nouvelle tentative dans 15 secondes.");
        }
      }
    }

    void fetchPosition();
    const interval = setInterval(() => {
      setLastFetchLabel("il y a 15s");
      void fetchPosition();
    }, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900">Suivi en direct</h1>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          Ce lien expire a {expiresAtFormatted}. Le partage de position est
          volontaire et limite dans le temps.
        </p>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        {position && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
              <span className="font-medium">{position.conducteurPrenom}</span>
              {position.etaMinutes !== null && (
                <span className="text-slate-500">— ~{position.etaMinutes} min</span>
              )}
              {lastFetchLabel !== null && (
                <span className="ml-auto text-xs text-slate-400">
                  mis a jour {lastFetchLabel}
                </span>
              )}
            </div>

            <Map
              center={[position.lng, position.lat]}
              zoom={14}
              markers={[
                {
                  lat: position.lat,
                  lng: position.lng,
                  label: position.conducteurPrenom,
                  color: "#10b981",
                },
              ]}
              className="h-80 w-full rounded-xl overflow-hidden"
            />
          </>
        )}

        {!position && !error && (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Chargement de la position...
          </div>
        )}
      </main>
    </div>
  );
}

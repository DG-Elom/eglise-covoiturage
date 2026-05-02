"use client";

import { useEffect, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { GeocodeResult } from "@/lib/mapbox";
import type { Database } from "@/lib/supabase/types";
import {
  SavedPlacesManager,
  AddSavedPlaceModal,
  iconEmoji,
} from "@/components/saved-places-manager";

const MAX_PLACES = 8;

type SavedPlace = Database["public"]["Tables"]["saved_places"]["Row"] & {
  lat?: number | null;
  lng?: number | null;
};

type Props = {
  userId: string;
  value: GeocodeResult | null;
  onChange: (place: GeocodeResult) => void;
};

export function SavedPlacesButton({ userId, value, onChange }: Props) {
  const supabase = createClient();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("saved_places")
      .select("id, user_id, label, icon, adresse, position, created_at, lat, lng")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setPlaces((data ?? []) as unknown as SavedPlace[]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, version]);

  const isAlreadySaved = value
    ? places.some((p) => p.adresse === value.address)
    : false;

  const canAdd = value !== null && !isAlreadySaved && places.length < MAX_PLACES;

  async function selectPlace(place: SavedPlace) {
    let lat = Number(place.lat);
    let lng = Number(place.lng);
    // Fallback : si la migration v31 n'est pas encore appliquée ou que les
    // colonnes générées sont nulles, on re-géocode à la volée pour ne pas
    // retourner [0,0] (qui causait des "5472 km de détour").
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
    ) {
      try {
        const { geocodeAddress } = await import("@/lib/mapbox");
        const results = await geocodeAddress(place.adresse);
        if (results.length > 0) {
          lat = results[0].lat;
          lng = results[0].lng;
        }
      } catch {
        // ignore : si même le re-geocode échoue, on bloquera côté onSearch
      }
    }
    onChange({ id: place.id, address: place.adresse, lat, lng });
  }

  if (places.length === 0 && !value) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {places.map((place) => (
          <button
            key={place.id}
            type="button"
            onClick={() => selectPlace(place)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              value?.address === place.adresse
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-slate-500"
            }`}
          >
            <span>{iconEmoji(place.icon)}</span>
            <span>{place.label}</span>
          </button>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-700 transition dark:border-slate-600 dark:bg-transparent dark:text-slate-400 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
          >
            <Plus className="size-3" />
            Sauvegarder ce lieu
          </button>
        )}

        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          title="Gérer mes lieux"
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-400 hover:text-slate-700 hover:border-slate-300 transition dark:border-slate-700 dark:bg-transparent dark:hover:border-slate-500 dark:hover:text-slate-200"
        >
          <Settings2 className="size-3" />
          Gérer
        </button>
      </div>

      {managerOpen && (
        <SavedPlacesManager
          userId={userId}
          onClose={() => {
            setManagerOpen(false);
            setVersion((v) => v + 1);
          }}
        />
      )}

      {addOpen && value && (
        <AddSavedPlaceModal
          adresse={value.address}
          lat={value.lat}
          lng={value.lng}
          userId={userId}
          onClose={() => setAddOpen(false)}
          onSaved={() => setVersion((v) => v + 1)}
        />
      )}
    </>
  );
}

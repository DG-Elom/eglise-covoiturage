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

type SavedPlace = Database["public"]["Tables"]["saved_places"]["Row"];

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
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setPlaces(data ?? []);
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

  function selectPlace(place: SavedPlace) {
    const result: GeocodeResult = {
      id: place.id,
      address: place.adresse,
      lat: 0,
      lng: 0,
    };
    onChange(result);
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

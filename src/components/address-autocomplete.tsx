"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { geocodeAddress, reverseGeocode, type GeocodeResult } from "@/lib/mapbox";

type Props = {
  value: GeocodeResult | null;
  onChange: (r: GeocodeResult | null) => void;
  placeholder?: string;
};

export function AddressAutocomplete({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value?.address ?? "");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query || query === value?.address) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await geocodeAddress(query, ctrl.signal);
      setResults(r);
      setLoading(false);
      setOpen(r.length > 0);
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, value?.address]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Géolocalisation non supportée par ce navigateur");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
        if (!r) {
          toast.error("Impossible de résoudre ta position en adresse");
          return;
        }
        onChange(r);
        setQuery(r.address);
        setOpen(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Autorise la géolocalisation pour utiliser cette fonction");
        } else {
          toast.error("Position introuvable");
        }
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none dark:text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange(null);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Saisissez votre adresse"}
          className="w-full rounded-lg border border-slate-200 pl-9 pr-20 py-2.5 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
        />
        {loading && (
          <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 size-4 text-slate-400 animate-spin dark:text-slate-500" />
        )}
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          title="Utiliser ma position actuelle"
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-emerald-700 disabled:opacity-50 transition dark:hover:bg-slate-800 dark:hover:text-emerald-300"
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Crosshair className="size-4" />
          )}
        </button>
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(r);
                  setQuery(r.address);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {r.address}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Map } from "@/components/map";
import type { GeocodeResult } from "@/lib/mapbox";
import { nextOccurrences, formatDateShort, toDateString } from "@/lib/dates";
import { addMinutes } from "@/lib/time";

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

type Culte = {
  id: string;
  libelle: string;
  jour_semaine: number;
  heure: string;
};

type Sens = "aller" | "retour" | "aller_retour";

export function NouveauTrajetForm({
  conducteurId,
  cultes,
}: {
  conducteurId: string;
  cultes: Culte[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [adresse, setAdresse] = useState<GeocodeResult | null>(null);
  const [culteId, setCulteId] = useState<string>(cultes[0]?.id ?? "");
  const [sens, setSens] = useState<Sens>("aller_retour");
  const [places, setPlaces] = useState(2);
  const [rayon, setRayon] = useState(3);
  const [heureDepart, setHeureDepart] = useState("08:00");
  const [datesSelected, setDatesSelected] = useState<Set<string>>(new Set());

  const culte = cultes.find((c) => c.id === culteId);
  const dates = useMemo(
    () => (culte ? nextOccurrences(culte.jour_semaine, 8) : []),
    [culte],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adresse) {
      toast.error("Choisis une adresse de départ");
      return;
    }
    if (!culteId) {
      toast.error("Choisis un programme");
      return;
    }
    if (datesSelected.size === 0) {
      toast.error("Choisis au moins une date");
      return;
    }

    setLoading(true);
    const { data: trajet, error } = await supabase
      .from("trajets")
      .insert({
        conducteur_id: conducteurId,
        culte_id: culteId,
        depart_adresse: adresse.address,
        depart_position: `POINT(${adresse.lng} ${adresse.lat})`,
        sens,
        places_total: places,
        rayon_detour_km: rayon,
        heure_depart: heureDepart,
      })
      .select("id")
      .single();

    if (error || !trajet) {
      setLoading(false);
      toast.error(error?.message ?? "Erreur");
      return;
    }

    const { error: instErr } = await supabase.from("trajets_instances").insert(
      Array.from(datesSelected).map((d) => ({ trajet_id: trajet.id, date: d })),
    );
    setLoading(false);

    if (instErr) {
      toast.error(instErr.message);
      return;
    }
    toast.success("Trajet créé !");
    router.push("/dashboard");
    router.refresh();
  }

  function toggleDate(d: string) {
    setDatesSelected((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  function toggleAllDates() {
    if (datesSelected.size === dates.length) {
      setDatesSelected(new Set());
    } else {
      setDatesSelected(new Set(dates.map(toDateString)));
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Point de départ">
        <AddressAutocomplete
          value={adresse}
          onChange={setAdresse}
          placeholder="Saisis ton adresse de départ"
        />
        {adresse && (
          <Map
            center={[adresse.lng, adresse.lat]}
            zoom={13}
            markers={[{ lat: adresse.lat, lng: adresse.lng, label: "Départ" }]}
            circle={{ lat: adresse.lat, lng: adresse.lng, radiusKm: rayon }}
            className="mt-3 h-64 w-full rounded-lg overflow-hidden"
          />
        )}
      </Section>

      <Section title="Programme">
        <div className="grid gap-2 sm:grid-cols-2">
          {cultes.map((c) => (
            <label
              key={c.id}
              className={`cursor-pointer rounded-lg border px-3 py-3 text-sm transition ${
                culteId === c.id
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="culte"
                checked={culteId === c.id}
                onChange={() => {
                  setCulteId(c.id);
                  setDatesSelected(new Set());
                }}
                className="sr-only"
              />
              <div className="font-medium">{c.libelle}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {JOURS[c.jour_semaine]} · {c.heure.slice(0, 5)}
              </div>
            </label>
          ))}
          {cultes.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
              Aucun programme configuré. Contacte l&apos;admin.
            </div>
          )}
        </div>
      </Section>

      <Section title="Dates où tu es disponible">
        {dates.length === 0 ? (
          <p className="text-sm text-slate-500">Choisis d&apos;abord un programme.</p>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Coche les dates où tu peux conduire.
              </p>
              <button
                type="button"
                onClick={toggleAllDates}
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                {datesSelected.size === dates.length ? "Tout décocher" : "Tout cocher"}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {dates.map((d) => {
                const ds = toDateString(d);
                const checked = datesSelected.has(ds);
                return (
                  <label
                    key={ds}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                      checked
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDate(ds)}
                      className="sr-only"
                    />
                    {formatDateShort(d)}
                  </label>
                );
              })}
            </div>
          </>
        )}
      </Section>

      <Section title="Sens du trajet">
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              { v: "aller", l: "Aller seulement" },
              { v: "retour", l: "Retour seulement" },
              { v: "aller_retour", l: "Aller-retour" },
            ] as const
          ).map((s) => (
            <label
              key={s.v}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                sens === s.v
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="sens"
                checked={sens === s.v}
                onChange={() => setSens(s.v)}
                className="sr-only"
              />
              {s.l}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Heure de départ">
        <label className="block">
          <span className="text-xs font-medium text-slate-700">
            Tu pars de chez toi vers
          </span>
          <input
            type="time"
            value={heureDepart}
            onChange={(e) => setHeureDepart(e.target.value)}
            step={300}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-40"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Les passagers verront que tu pars entre <strong>{heureDepart}</strong> et{" "}
            <strong>{addMinutes(heureDepart, 30)}</strong>.
          </p>
        </label>
      </Section>

      <Section title="Détails">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">
              Places disponibles
            </span>
            <input
              type="number"
              min={1}
              max={8}
              value={places}
              onChange={(e) => setPlaces(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">
              Rayon de détour : <strong>{rayon} km</strong>
            </span>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={rayon}
              onChange={(e) => setRayon(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>0.5 km</span>
              <span>5 km</span>
            </div>
          </label>
        </div>
      </Section>

      <button
        type="submit"
        disabled={loading || !adresse}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        Créer le trajet
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-medium text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

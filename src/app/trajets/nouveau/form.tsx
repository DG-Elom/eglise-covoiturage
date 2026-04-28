"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Map } from "@/components/map";
import { geocodeAddress, type GeocodeResult } from "@/lib/mapbox";
import { nextOccurrences, formatDateShort, toDateString } from "@/lib/dates";
import { addMinutes } from "@/lib/time";

type ParsedTrajet = {
  culte_id?: string | null;
  heure_depart?: string;
  places_total?: number;
  sens?: "aller" | "retour" | "aller_retour";
  rayon_detour_km?: number;
  depart_address_text?: string;
  dates?: string[];
};

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
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [adresse, setAdresse] = useState<GeocodeResult | null>(null);
  const initialCulteId =
    searchParams.get("culte") &&
    cultes.some((c) => c.id === searchParams.get("culte"))
      ? (searchParams.get("culte") as string)
      : cultes[0]?.id ?? "";
  const initialSens =
    (searchParams.get("sens") as Sens | null) ?? "aller_retour";
  const initialDate = searchParams.get("date");
  const [culteId, setCulteId] = useState<string>(initialCulteId);
  const [sens, setSens] = useState<Sens>(initialSens);
  const [places, setPlaces] = useState(2);
  const [rayon, setRayon] = useState(5);
  const [heureDepart, setHeureDepart] = useState("08:00");
  const [datesSelected, setDatesSelected] = useState<Set<string>>(
    initialDate ? new Set([initialDate]) : new Set(),
  );

  useEffect(() => {
    if (initialDate && datesSelected.size === 1 && datesSelected.has(initialDate)) {
      toast.message(`Trajet pré-rempli depuis une demande passager.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [recurrenceWeeks, setRecurrenceWeeks] = useState(4);
  const culte = cultes.find((c) => c.id === culteId);
  const dates = useMemo(
    () => (culte ? nextOccurrences(culte.jour_semaine, recurrenceWeeks) : []),
    [culte, recurrenceWeeks],
  );
  const todayStr = useMemo(() => toDateString(new Date()), []);

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

  async function handleAiPrefill() {
    const text = aiText.trim();
    if (text.length === 0) {
      toast.error("Décris ton trajet avant de cliquer.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch("/api/parse-trajet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, cultes }),
      });
      const data: { parsed?: ParsedTrajet; error?: string } = await res.json();

      if (!res.ok) {
        if (res.status === 503 || data.error === "ai_disabled") {
          toast.error("L'IA n'est pas configurée.");
        } else {
          toast.error(data.error ?? "Erreur lors de l'analyse.");
        }
        return;
      }

      const parsed = data.parsed;
      if (!parsed) {
        toast.error("Aucune information extraite.");
        return;
      }

      let activeCulteId = culteId;
      if (parsed.culte_id && cultes.some((c) => c.id === parsed.culte_id)) {
        activeCulteId = parsed.culte_id;
        setCulteId(parsed.culte_id);
      }

      if (parsed.heure_depart) setHeureDepart(parsed.heure_depart);
      if (typeof parsed.places_total === "number") {
        setPlaces(Math.min(8, Math.max(1, parsed.places_total)));
      }
      if (parsed.sens) setSens(parsed.sens);
      if (typeof parsed.rayon_detour_km === "number") {
        setRayon(Math.min(10, Math.max(0.5, parsed.rayon_detour_km)));
      }

      if (parsed.dates && parsed.dates.length > 0) {
        const activeCulte = cultes.find((c) => c.id === activeCulteId);
        if (activeCulte) {
          const slots = new Set(
            nextOccurrences(activeCulte.jour_semaine, 4).map(toDateString),
          );
          const next = new Set(datesSelected);
          let added = 0;
          for (const d of parsed.dates) {
            if (slots.has(d)) {
              next.add(d);
              added++;
            }
          }
          if (added > 0) {
            setDatesSelected(next);
          } else {
            toast.message(
              "Les dates détectées ne correspondent pas au programme. Coche-les manuellement.",
            );
          }
        }
      }

      if (parsed.depart_address_text) {
        try {
          const results = await geocodeAddress(parsed.depart_address_text);
          if (results.length > 0) {
            setAdresse(results[0]);
          } else {
            toast.message(
              "Adresse non trouvée automatiquement. Choisis-la manuellement.",
            );
          }
        } catch {
          toast.message(
            "Adresse non trouvée automatiquement. Choisis-la manuellement.",
          );
        }
      }

      toast.success("Formulaire pré-rempli !");
    } catch {
      toast.error("Erreur réseau lors de l'analyse.");
    } finally {
      setAiLoading(false);
    }
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
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 dark:border-emerald-800 dark:from-emerald-950/40 dark:to-slate-900">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-200">
          <Sparkles className="size-4" />
          Saisie rapide avec l&apos;IA
        </h2>
        <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
          Décris ton trajet en une phrase, l&apos;IA pré-remplit le formulaire.
        </p>
        <textarea
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          rows={3}
          placeholder="Ex: Je pars dimanche matin de Cocody Riviera vers 8h30, j'ai 3 places…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleAiPrefill}
            disabled={aiLoading || aiText.trim().length === 0}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {aiLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Pré-remplir
          </button>
        </div>
      </div>

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
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500"
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
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
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
            <div className="mb-3 grid gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Récurrence
                </label>
                <select
                  value={recurrenceWeeks}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setRecurrenceWeeks(n);
                    setDatesSelected(new Set());
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value={1}>Cette semaine seulement</option>
                  <option value={2}>2 prochaines semaines</option>
                  <option value={4}>4 prochaines semaines</option>
                  <option value={8}>8 prochaines semaines</option>
                  <option value={12}>12 prochaines semaines</option>
                </select>
              </div>
              <button
                type="button"
                onClick={toggleAllDates}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              >
                {datesSelected.size === dates.length ? "Tout décocher" : "Tout cocher"}
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Coche les dates où tu peux conduire.
            </p>
            <div className="grid gap-2 sm:grid-cols-4">
              {dates.map((d) => {
                const ds = toDateString(d);
                const checked = datesSelected.has(ds);
                return (
                  <label
                    key={ds}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                      checked
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500"
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

            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Ajouter une autre date
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="date"
                  min={todayStr}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v && v >= todayStr) {
                      const next = new Set(datesSelected);
                      next.add(v);
                      setDatesSelected(next);
                      e.target.value = "";
                    }
                  }}
                />
              </div>
              {datesSelected.size > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.from(datesSelected)
                    .sort()
                    .map((ds) => (
                      <span
                        key={ds}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                      >
                        {formatDateShort(new Date(`${ds}T12:00:00`))}
                        <button
                          type="button"
                          onClick={() => toggleDate(ds)}
                          className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
                          aria-label="Retirer cette date"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              )}
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
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500"
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
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Tu pars de chez toi vers
          </span>
          <input
            type="time"
            value={heureDepart}
            onChange={(e) => setHeureDepart(e.target.value)}
            step={300}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Places disponibles
            </span>
            <input
              type="number"
              min={1}
              max={8}
              value={places}
              onChange={(e) => setPlaces(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Rayon de détour : <strong>{rayon} km</strong>
            </span>
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={rayon}
              onChange={(e) => setRayon(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 dark:text-slate-500">
              <span>1 km</span>
              <span>10 km</span>
            </div>
          </label>
        </div>
      </Section>

      <button
        type="submit"
        disabled={loading || !adresse}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        Créer le trajet
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">{title}</h2>
      {children}
    </div>
  );
}

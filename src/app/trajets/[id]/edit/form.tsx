"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, MapPin } from "lucide-react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Map } from "@/components/map";
import type { GeocodeResult } from "@/lib/mapbox";
import { nextOccurrences, formatDateShort, toDateString } from "@/lib/dates";
import { addMinutes } from "@/lib/time";
import { notify } from "@/lib/notify";
import { confirmToast } from "@/lib/confirm";

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

type Sens = "aller" | "retour" | "aller_retour";

type TrajetProp = {
  id: string;
  depart_adresse: string;
  sens: Sens;
  places_total: number;
  rayon_detour_km: number;
  heure_depart: string;
  culte_id: string;
};

type CulteProp = {
  libelle: string;
  jour_semaine: number;
  heure: string;
};

type InstanceProp = { id: string; date: string };

type ReservationProp = {
  id: string;
  trajet_instance_id: string;
  statut: "pending" | "accepted" | "refused" | "cancelled" | "completed" | "no_show";
  passager_id: string;
};

export function EditTrajetForm({
  trajet,
  culte,
  instances,
  reservations,
}: {
  trajet: TrajetProp;
  culte: CulteProp;
  instances: InstanceProp[];
  reservations: ReservationProp[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [editingAdresse, setEditingAdresse] = useState(false);
  const [adresse, setAdresse] = useState<GeocodeResult | null>(null);
  const [sens, setSens] = useState<Sens>(trajet.sens);
  const [places, setPlaces] = useState(trajet.places_total);
  const [rayon, setRayon] = useState(trajet.rayon_detour_km);
  const [heureDepart, setHeureDepart] = useState(trajet.heure_depart.slice(0, 5));

  const existingDateStrings = useMemo(
    () => new Set(instances.map((i) => i.date.slice(0, 10))),
    [instances],
  );
  const [datesSelected, setDatesSelected] = useState<Set<string>>(
    () => new Set(existingDateStrings),
  );

  const dates = useMemo(
    () => nextOccurrences(culte.jour_semaine, 8),
    [culte.jour_semaine],
  );

  // Inclure les dates existantes même si elles ne sont plus dans les 8 prochaines
  const allDateStrings = useMemo(() => {
    const set = new Set<string>(dates.map(toDateString));
    for (const ds of existingDateStrings) set.add(ds);
    return Array.from(set).sort();
  }, [dates, existingDateStrings]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingAdresse && !adresse) {
      toast.error("Choisis une nouvelle adresse ou annule la modification");
      return;
    }
    if (datesSelected.size === 0) {
      toast.error("Choisis au moins une date");
      return;
    }

    const toRemove = instances.filter(
      (i) => !datesSelected.has(i.date.slice(0, 10)),
    );
    const toAdd = Array.from(datesSelected).filter(
      (ds) => !instances.some((i) => i.date.slice(0, 10) === ds),
    );

    const removedIds = new Set(toRemove.map((i) => i.id));
    const reservationsToCancel = reservations.filter(
      (r) =>
        removedIds.has(r.trajet_instance_id) &&
        (r.statut === "pending" || r.statut === "accepted"),
    );

    if (reservationsToCancel.length > 0) {
      const ok = await confirmToast(
        `${reservationsToCancel.length} réservation(s) sur ${toRemove.length} date(s) seront annulée(s). Continuer ?`,
        { destructive: true, confirmLabel: "Continuer" },
      );
      if (!ok) return;
    }

    setLoading(true);

    const trajetUpdate: {
      sens: Sens;
      places_total: number;
      rayon_detour_km: number;
      heure_depart: string;
      depart_adresse?: string;
      depart_position?: string;
    } = {
      sens,
      places_total: places,
      rayon_detour_km: rayon,
      heure_depart: heureDepart,
    };
    if (editingAdresse && adresse) {
      trajetUpdate.depart_adresse = adresse.address;
      trajetUpdate.depart_position = `POINT(${adresse.lng} ${adresse.lat})`;
    }

    const { error: updErr } = await supabase
      .from("trajets")
      .update(trajetUpdate as never)
      .eq("id", trajet.id);

    if (updErr) {
      setLoading(false);
      toast.error(updErr.message);
      return;
    }

    if (reservationsToCancel.length > 0) {
      const ids = reservationsToCancel.map((r) => r.id);
      const { error: resErr } = await supabase
        .from("reservations")
        .update({
          statut: "cancelled",
          cancelled_le: new Date().toISOString(),
        } as never)
        .in("id", ids);
      if (resErr) {
        setLoading(false);
        toast.error(resErr.message);
        return;
      }
      await Promise.all(
        reservationsToCancel.map((r) => notify("trajet_date_cancelled", r.id)),
      );
    }

    if (toRemove.length > 0) {
      const { error: instCancelErr } = await supabase
        .from("trajets_instances")
        .update({ annule_par_conducteur: true } as never)
        .in(
          "id",
          toRemove.map((i) => i.id),
        );
      if (instCancelErr) {
        setLoading(false);
        toast.error(instCancelErr.message);
        return;
      }
    }

    if (toAdd.length > 0) {
      const { error: addErr } = await supabase
        .from("trajets_instances")
        .insert(toAdd.map((d) => ({ trajet_id: trajet.id, date: d })));
      if (addErr) {
        setLoading(false);
        toast.error(addErr.message);
        return;
      }
    }

    setLoading(false);
    toast.success("Trajet mis à jour");
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
    if (datesSelected.size === allDateStrings.length) {
      setDatesSelected(new Set());
    } else {
      setDatesSelected(new Set(allDateStrings));
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Point de départ">
        {!editingAdresse ? (
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <MapPin className="size-4 text-slate-400 mt-0.5 shrink-0 dark:text-slate-500" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Adresse actuelle</p>
                <p className="text-sm text-slate-800 dark:text-slate-200">{trajet.depart_adresse}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingAdresse(true)}
              className="text-xs font-medium text-emerald-700 hover:underline shrink-0 dark:text-emerald-400"
            >
              Changer
            </button>
          </div>
        ) : (
          <>
            <AddressAutocomplete
              value={adresse}
              onChange={setAdresse}
              placeholder="Saisis ta nouvelle adresse de départ"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditingAdresse(false);
                  setAdresse(null);
                }}
                className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
              >
                Annuler le changement
              </button>
            </div>
            {adresse && (
              <Map
                center={[adresse.lng, adresse.lat]}
                zoom={13}
                markers={[
                  { lat: adresse.lat, lng: adresse.lng, label: "Départ" },
                ]}
                circle={{ lat: adresse.lat, lng: adresse.lng, radiusKm: rayon }}
                className="mt-3 h-64 w-full rounded-lg overflow-hidden"
              />
            )}
          </>
        )}
      </Section>

      <Section title="Programme">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm opacity-80 dark:border-slate-700 dark:bg-slate-950">
          <div className="font-medium text-slate-800 dark:text-slate-200">{culte.libelle}</div>
          <div className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
            {JOURS[culte.jour_semaine]} · {culte.heure.slice(0, 5)}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Le programme ne peut pas être modifié sur un trajet existant.
          </p>
        </div>
      </Section>

      <Section title="Dates où tu es disponible">
        {allDateStrings.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune date disponible.</p>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Coche les dates où tu peux conduire.
              </p>
              <button
                type="button"
                onClick={toggleAllDates}
                className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              >
                {datesSelected.size === allDateStrings.length
                  ? "Tout décocher"
                  : "Tout cocher"}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {allDateStrings.map((ds) => {
                const checked = datesSelected.has(ds);
                const d = new Date(ds);
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
            Les passagers verront que tu pars entre <strong>{heureDepart}</strong>{" "}
            et <strong>{addMinutes(heureDepart, 30)}</strong>.
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
              min={0.5}
              max={5}
              step={0.5}
              value={rayon}
              onChange={(e) => setRayon(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 dark:text-slate-500">
              <span>0.5 km</span>
              <span>5 km</span>
            </div>
          </label>
        </div>
      </Section>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        Enregistrer les modifications
      </button>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">{title}</h2>
      {children}
    </div>
  );
}

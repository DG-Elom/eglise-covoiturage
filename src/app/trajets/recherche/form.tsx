"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, MapPin, Users, Search } from "lucide-react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { Avatar } from "@/components/avatar";
import { Map, type MapMarker } from "@/components/map";
import type { GeocodeResult } from "@/lib/mapbox";
import { nextOccurrences, formatDateShort, toDateString } from "@/lib/dates";
import { notify } from "@/lib/notify";


const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

type Culte = { id: string; libelle: string; jour_semaine: number; heure: string };
type Sens = "aller" | "retour";

type TrajetCompatible = {
  trajet_id: string;
  trajet_instance_id: string;
  conducteur_id: string;
  conducteur_prenom: string;
  conducteur_photo_url: string | null;
  depart_adresse: string;
  heure_depart: string;
  places_restantes: number;
  detour_km: number;
  score: number;
  dans_zone: boolean;
};

export function RechercheForm({
  passagerId,
  cultes,
}: {
  passagerId: string;
  cultes: Culte[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [reserving, setReserving] = useState<string | null>(null);
  const [adresse, setAdresse] = useState<GeocodeResult | null>(null);
  const [culteId, setCulteId] = useState(cultes[0]?.id ?? "");
  const [sens, setSens] = useState<Sens>("aller");
  const [date, setDate] = useState<string>("");
  const [results, setResults] = useState<TrajetCompatible[] | null>(null);

  const culte = cultes.find((c) => c.id === culteId);
  const dates = culte ? nextOccurrences(culte.jour_semaine, 4) : [];
  const todayStr = useMemo(() => toDateString(new Date()), []);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!adresse || !culteId || !date) {
      toast.error("Renseigne tous les champs");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("trajets_compatibles", {
      p_passager_lat: adresse.lat,
      p_passager_lng: adresse.lng,
      p_culte_id: culteId,
      p_sens: sens,
      p_date: date,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResults((data ?? []) as TrajetCompatible[]);
  }

  async function reserver(t: TrajetCompatible) {
    if (!adresse) return;
    setReserving(t.trajet_instance_id);
    const { data, error } = await supabase
      .from("reservations")
      .insert({
        passager_id: passagerId,
        trajet_instance_id: t.trajet_instance_id,
        sens,
        pickup_adresse: adresse.address,
        pickup_position: `POINT(${adresse.lng} ${adresse.lat})`,
      })
      .select("id")
      .single();
    setReserving(null);
    if (error || !data) {
      toast.error(error?.message ?? "Erreur");
      return;
    }
    void notify("reservation_created", data.id);
    toast.success("Demande envoyée !");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSearch} className="space-y-6">
        <Section title="Ton adresse">
          <AddressAutocomplete
            value={adresse}
            onChange={setAdresse}
            placeholder="Saisis ton adresse de domicile"
          />
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
                    setDate("");
                  }}
                  className="sr-only"
                />
                <div className="font-medium">{c.libelle}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {JOURS[c.jour_semaine]} · {c.heure.slice(0, 5)}
                </div>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Sens">
          <div className="grid gap-2 sm:grid-cols-2">
            {(["aller", "retour"] as const).map((s) => (
              <label
                key={s}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                  sens === s
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500"
                }`}
              >
                <input
                  type="radio"
                  name="sens"
                  checked={sens === s}
                  onChange={() => setSens(s)}
                  className="sr-only"
                />
                {s === "aller" ? "Aller" : "Retour"}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Date">
          {dates.length === 0 ? (
            <p className="text-sm text-slate-500">Choisis d&apos;abord un programme.</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-4">
                {dates.map((d) => {
                  const ds = toDateString(d);
                  return (
                    <label
                      key={ds}
                      className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                        date === ds
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name="date"
                        checked={date === ds}
                        onChange={() => setDate(ds)}
                        className="sr-only"
                      />
                      {formatDateShort(d)}
                    </label>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Ou choisis une autre date
                </label>
                <input
                  type="date"
                  min={todayStr}
                  value={
                    date && !dates.some((d) => toDateString(d) === date) ? date : ""
                  }
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
                />
                {date && !dates.some((d) => toDateString(d) === date) && (
                  <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                    Date sélectionnée : {formatDateShort(new Date(`${date}T12:00:00`))}
                  </p>
                )}
              </div>
            </>
          )}
        </Section>

        <button
          type="submit"
          disabled={loading || !adresse || !culteId || !date}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Rechercher
        </button>
      </form>

      {results !== null && (
        <Resultats
          results={results}
          adresse={adresse}
          onReserve={reserver}
          reserving={reserving}
        />
      )}

      {results !== null && results.length === 0 && adresse && culteId && date && (
        <PublierDemande
          adresse={adresse}
          culteId={culteId}
          date={date}
          sens={sens}
        />
      )}
    </div>
  );
}

function PublierDemande({
  adresse,
  culteId,
  date,
  sens,
}: {
  adresse: GeocodeResult;
  culteId: string;
  date: string;
  sens: Sens;
}) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  async function publier() {
    setPublishing(true);
    try {
      const res = await fetch("/api/demandes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          culte_id: culteId,
          date,
          sens,
          pickup_adresse: adresse.address,
          pickup_lat: adresse.lat,
          pickup_lng: adresse.lng,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Échec de la publication");
        setPublishing(false);
        return;
      }
      setPublished(true);
      toast.success("Demande publiée. Les conducteurs ont été prévenus.");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch {
      toast.error("Erreur réseau");
      setPublishing(false);
    }
  }

  if (published) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
          ✅ Ta demande est publiée
        </p>
        <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
          Tu seras notifié dès qu&apos;un conducteur peut t&apos;aider.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        Personne ne passe encore par chez toi 😕
      </p>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
        Publie ta demande pour que les conducteurs ICC Metz soient prévenus.
        Si quelqu&apos;un peut t&apos;aider, tu seras notifié.
      </p>
      <button
        type="button"
        onClick={publier}
        disabled={publishing}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition"
      >
        {publishing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          "📢"
        )}
        Publier ma demande
      </button>
    </div>
  );
}

function Resultats({
  results,
  adresse,
  onReserve,
  reserving,
}: {
  results: TrajetCompatible[];
  adresse: GeocodeResult | null;
  onReserve: (t: TrajetCompatible) => void;
  reserving: string | null;
}) {
  const dansZone = results.filter((r) => r.dans_zone);
  const horsZone = results.filter((r) => !r.dans_zone).slice(0, 3);

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Aucun trajet trouvé pour cette date.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Essaie une autre date, ou un autre programme.
        </p>
      </div>
    );
  }

  const markers: MapMarker[] = adresse
    ? [{ lat: adresse.lat, lng: adresse.lng, color: "#0ea5e9", label: "Toi" }]
    : [];

  return (
    <div className="space-y-4">
      {adresse && (
        <Map
          center={[adresse.lng, adresse.lat]}
          zoom={12}
          markers={markers}
          className="h-64 w-full rounded-xl overflow-hidden"
        />
      )}

      {dansZone.length > 0 ? (
        <>
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {dansZone.length} trajet{dansZone.length > 1 ? "s" : ""} sur ton chemin
          </h2>
          <ul className="space-y-3">
            {dansZone.map((t) => (
              <TrajetItem
                key={t.trajet_instance_id}
                trajet={t}
                onReserve={onReserve}
                reserving={reserving}
              />
            ))}
          </ul>
        </>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">Aucun trajet ne passe directement par chez toi.</p>
          <p className="mt-1">
            Voici les conducteurs les plus proches qui pourraient peut-être faire un détour.
            Le conducteur reste libre d&apos;accepter ou refuser.
          </p>
        </div>
      )}

      {horsZone.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-slate-700 pt-2 dark:text-slate-300">
            {dansZone.length > 0 ? "Trajets plus éloignés" : "Trajets les plus proches"}
          </h2>
          <ul className="space-y-3">
            {horsZone.map((t) => (
              <TrajetItem
                key={t.trajet_instance_id}
                trajet={t}
                onReserve={onReserve}
                reserving={reserving}
                outOfZone
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function TrajetItem({
  trajet,
  onReserve,
  reserving,
  outOfZone,
}: {
  trajet: TrajetCompatible;
  onReserve: (t: TrajetCompatible) => void;
  reserving: string | null;
  outOfZone?: boolean;
}) {
  return (
    <li
      className={`rounded-xl border bg-white p-4 dark:bg-slate-900 ${
        outOfZone
          ? "border-amber-200 dark:border-amber-800"
          : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Avatar
              photoUrl={trajet.conducteur_photo_url}
              prenom={trajet.conducteur_prenom}
              nom=""
              size="sm"
            />
            <span className="font-medium">{trajet.conducteur_prenom}</span>
            {outOfZone && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                hors zone
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="size-3" />
            <span className="truncate">{trajet.depart_adresse}</span>
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Départ à <strong>{trajet.heure_depart.slice(0, 5)}</strong>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
              <Users className="size-3" /> {trajet.places_restantes} place
              {trajet.places_restantes > 1 ? "s" : ""}
            </span>
            <span className={outOfZone ? "text-amber-700 dark:text-amber-300" : "text-slate-500"}>
              Détour : {trajet.detour_km} km
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onReserve(trajet)}
          disabled={reserving !== null}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition shrink-0 dark:hover:bg-emerald-500"
        >
          {reserving === trajet.trajet_instance_id ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Demander"
          )}
        </button>
      </div>
    </li>
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

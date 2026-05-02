"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, MapPin, Users, Search, History, X } from "lucide-react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { SavedPlacesButton } from "@/components/saved-places-button";
import { Avatar } from "@/components/avatar";
import { Map, type MapMarker } from "@/components/map";
import type { GeocodeResult } from "@/lib/mapbox";
import { geocodeAddress } from "@/lib/mapbox";
import { nextOccurrences, formatDateShort, toDateString } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { ProfileRatingBadge } from "@/components/profile-rating-badge";
import type { ConducteurRating } from "./page";
import type { TrajetAlternative } from "@/lib/capacity";
import { PlacesRestantesLive } from "@/components/places-restantes-live";
import { formatDetour } from "@/lib/detour";


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
  places_total: number;
  detour_km: number;
  score: number;
  dans_zone: boolean;
};

export function RechercheForm({
  passagerId,
  cultes,
  conducteurRatings,
  recentAddresses,
}: {
  passagerId: string;
  cultes: Culte[];
  conducteurRatings?: Record<string, ConducteurRating>;
  recentAddresses?: string[];
}) {
  const userId = passagerId;
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [reserving, setReserving] = useState<string | null>(null);
  const [adresse, setAdresse] = useState<GeocodeResult | null>(null);
  const [culteId, setCulteId] = useState(cultes[0]?.id ?? "");
  const [sens, setSens] = useState<Sens>("aller");
  const [date, setDate] = useState<string>("");
  const [results, setResults] = useState<TrajetCompatible[] | null>(null);
  const [fullDialog, setFullDialog] = useState<{
    alternatives: TrajetAlternative[];
  } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const culte = cultes.find((c) => c.id === culteId);
  const dates = culte ? nextOccurrences(culte.jour_semaine, 4) : [];

  // Reset les resultats des qu'un critere de recherche change (oblige a relancer Rechercher)
  useEffect(() => {
    setResults(null);
  }, [adresse, culteId, sens, date]);
  const todayStr = useMemo(() => toDateString(new Date()), []);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!adresse || !culteId || !date) {
      toast.error("Renseigne tous les champs");
      return;
    }
    // Garde-fou anti-null-island : refuse si l'adresse n'a pas de coordonnees valides
    if (
      !Number.isFinite(adresse.lat) ||
      !Number.isFinite(adresse.lng) ||
      (Math.abs(adresse.lat) < 0.01 && Math.abs(adresse.lng) < 0.01)
    ) {
      toast.error("Ton adresse n'a pas pu être localisée. Ressaisis-la.");
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
    // Filtre les detours aberrants (> 100 km = bug geocoding cote conducteur)
    const MAX_DETOUR_KM = 100;
    const trajets = ((data ?? []) as TrajetCompatible[])
      .filter((t) => {
        const detour = Number(t.detour_km);
        return !Number.isFinite(detour) || detour <= MAX_DETOUR_KM;
      })
      .map((t) => ({
        ...t,
        places_total: t.places_total ?? t.places_restantes,
      }));
    setResults(trajets);
    // Defile vers les resultats apres render
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function reserver(t: TrajetCompatible) {
    if (!adresse) return;
    setReserving(t.trajet_instance_id);

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trajet_instance_id: t.trajet_instance_id,
        sens,
        pickup_adresse: adresse.address,
        pickup_lat: adresse.lat,
        pickup_lng: adresse.lng,
        passager_lat: adresse.lat,
        passager_lng: adresse.lng,
        culte_id: culteId,
        date,
      }),
    });

    setReserving(null);

    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        alternatives?: TrajetAlternative[];
      };
      if (body.error === "instance_full") {
        setFullDialog({ alternatives: body.alternatives ?? [] });
        return;
      }
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Erreur");
      return;
    }

    const data = (await res.json()) as { id?: string };
    if (!data.id) {
      toast.error("Erreur inattendue");
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
          <SavedPlacesButton
            userId={userId}
            value={adresse}
            onChange={setAdresse}
          />
          {recentAddresses && recentAddresses.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">Récents</p>
              <div className="flex flex-wrap gap-2">
                {recentAddresses.map((addr) => (
                  <button
                    key={addr}
                    type="button"
                    onClick={async () => {
                      const results = await geocodeAddress(addr);
                      if (results.length > 0) setAdresse(results[0]);
                    }}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs hover:border-slate-300 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    <History className="size-3 shrink-0" />
                    <span className="truncate">{addr}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition active:scale-95 transition-transform dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Rechercher
        </button>
      </form>

      {results !== null && (
        <div ref={resultsRef} className="scroll-mt-4">
          <Resultats
            results={results}
            adresse={adresse}
            onReserve={reserver}
            reserving={reserving}
            conducteurRatings={conducteurRatings}
          />
        </div>
      )}

      {results !== null && results.length === 0 && adresse && culteId && date && (
        <PublierDemande
          adresse={adresse}
          culteId={culteId}
          date={date}
          sens={sens}
        />
      )}

      {fullDialog !== null && (
        <InstanceFullDialog
          alternatives={fullDialog.alternatives}
          onClose={() => setFullDialog(null)}
          onReserveAlternative={(alt) => {
            setFullDialog(null);
            void reserver({
              trajet_id: alt.trajet_id,
              trajet_instance_id: alt.trajet_instance_id,
              conducteur_id: alt.conducteur_id,
              conducteur_prenom: alt.conducteur_prenom,
              conducteur_photo_url: alt.conducteur_photo_url,
              depart_adresse: alt.depart_adresse,
              heure_depart: alt.heure_depart,
              places_restantes: alt.places_restantes,
              places_total: alt.places_restantes,
              detour_km: alt.detour_km,
              score: alt.score,
              dans_zone: alt.dans_zone,
            });
          }}
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
  conducteurRatings,
}: {
  results: TrajetCompatible[];
  adresse: GeocodeResult | null;
  onReserve: (t: TrajetCompatible) => void;
  reserving: string | null;
  conducteurRatings?: Record<string, ConducteurRating>;
}) {
  // Exclut les trajets sans place restante (sinon bouton "Demander" inutile + frustrant)
  const avecPlace = results.filter((r) => (r.places_restantes ?? 0) > 0);
  const dansZone = avecPlace.filter((r) => r.dans_zone);
  const horsZone = avecPlace.filter((r) => !r.dans_zone).slice(0, 3);
  const completsCount = results.length - avecPlace.length;

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

  if (avecPlace.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Tous les trajets de cette date sont complets
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300/90">
          {results.length} trajet{results.length > 1 ? "s ont été proposés" : " a été proposé"}, mais plus aucune place n&apos;est disponible. Essaie une autre date ou propose toi-même un trajet.
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
                rating={conducteurRatings?.[t.conducteur_id]}
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
                rating={conducteurRatings?.[t.conducteur_id]}
              />
            ))}
          </ul>
        </>
      )}

      {completsCount > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
          {completsCount} trajet{completsCount > 1 ? "s" : ""} complet
          {completsCount > 1 ? "s" : ""} non affiché{completsCount > 1 ? "s" : ""}.
        </p>
      )}
    </div>
  );
}

function TrajetItem({
  trajet,
  onReserve,
  reserving,
  outOfZone,
  rating,
}: {
  trajet: TrajetCompatible;
  onReserve: (t: TrajetCompatible) => void;
  reserving: string | null;
  outOfZone?: boolean;
  rating?: ConducteurRating;
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
          <div className="flex items-center gap-2 flex-wrap">
            <Avatar
              photoUrl={trajet.conducteur_photo_url}
              prenom={trajet.conducteur_prenom}
              nom=""
              size="sm"
            />
            <span className="font-medium">{trajet.conducteur_prenom}</span>
            {rating && rating.count > 0 && (
              <ProfileRatingBadge avg={rating.avg} count={rating.count} size="sm" />
            )}
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
            <PlacesRestantesLive
              trajetInstanceId={trajet.trajet_instance_id}
              placesTotal={trajet.places_total}
              initialPlacesRestantes={trajet.places_restantes}
            />
            <span className={outOfZone ? "text-amber-700 dark:text-amber-300" : "text-slate-500"}>
              {formatDetour(trajet.detour_km)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onReserve(trajet)}
          disabled={reserving !== null}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition active:scale-95 transition-transform shrink-0 dark:hover:bg-emerald-500"
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

function InstanceFullDialog({
  alternatives,
  onClose,
  onReserveAlternative,
}: {
  alternatives: TrajetAlternative[];
  onClose: () => void;
  onReserveAlternative: (alt: TrajetAlternative) => void;
}) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              Ce trajet est complet
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Toutes les places ont été prises. Voici des alternatives.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-600 transition dark:text-slate-500 dark:hover:text-slate-300"
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-96 overflow-y-auto">
          {alternatives.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Aucune alternative disponible pour ce créneau.
            </p>
          ) : (
            alternatives.map((alt) => (
              <div
                key={alt.trajet_instance_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Avatar
                      photoUrl={alt.conducteur_photo_url}
                      prenom={alt.conducteur_prenom}
                      nom=""
                      size="sm"
                    />
                    <span className="font-medium text-sm">{alt.conducteur_prenom}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{alt.depart_adresse}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <Users className="size-3" /> {alt.places_restantes} place
                      {alt.places_restantes > 1 ? "s" : ""}
                    </span>
                    <span className="text-slate-500">🛣️ {formatDetour(alt.detour_km)} de détour</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onReserveAlternative(alt)}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition dark:hover:bg-emerald-500"
                >
                  Demander
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/trajets/recherche");
            }}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Voir tous les trajets disponibles
          </button>
        </div>
      </div>
    </div>
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

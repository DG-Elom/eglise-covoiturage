import Link from "next/link";
import { ArrowLeft, Users, Calendar, CheckCircle2, BarChart3, Clock, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { computeAcceptanceRate, parseDetourRpcResult } from "@/lib/trajet-stats";
import { formatDetourLong } from "@/lib/detour";

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const STATUT_CONFIG = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" },
  accepted: { label: "Acceptées", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  refused: { label: "Refusées", color: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200" },
  cancelled: { label: "Annulées", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  completed: { label: "Complétées", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200" },
  no_show: { label: "No-show", color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
} as const;

type StatutKey = keyof typeof STATUT_CONFIG;

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">
        {value}
      </div>
      {sub && (
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>
      )}
    </div>
  );
}

export default async function TrajetDetailPage({
  params,
}: {
  params: Promise<{ trajetId: string }>;
}) {
  const { trajetId } = await params;
  const supabase = await createClient();

  const { data: trajetRaw, error: trajetErr } = await supabase
    .from("trajets")
    .select(
      `id, depart_adresse, places_total, sens, heure_depart,
       conducteur:profiles!trajets_conducteur_id_fkey (id, prenom, nom, photo_url),
       culte:cultes (id, libelle, jour_semaine, heure)`,
    )
    .eq("id", trajetId)
    .single();

  if (trajetErr || !trajetRaw) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/trajets"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition"
        >
          <ArrowLeft className="size-4" /> Retour aux trajets
        </Link>
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          Trajet introuvable.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: instancesRaw } = await supabase
    .from("trajets_instances")
    .select("id, date, annule_par_conducteur")
    .eq("trajet_id", trajetId)
    .order("date", { ascending: true });

  const instances = instancesRaw ?? [];
  const instancesPassees = instances.filter(
    (i) => i.date < today && !i.annule_par_conducteur,
  ).length;
  const instancesFutures = instances.filter(
    (i) => i.date >= today && !i.annule_par_conducteur,
  );
  const instancesAnnulees = instances.filter((i) => i.annule_par_conducteur).length;
  const instanceIds = instances.map((i) => i.id);

  type ReservationRow = {
    id: string;
    passager_id: string;
    statut: string;
    demande_le: string;
    traitee_le: string | null;
    trajet_instance_id: string;
  };

  let reservations: ReservationRow[] = [];
  if (instanceIds.length > 0) {
    const { data: resasRaw } = await supabase
      .from("reservations")
      .select("id, passager_id, statut, demande_le, traitee_le, trajet_instance_id")
      .in("trajet_instance_id", instanceIds);
    reservations = (resasRaw ?? []) as ReservationRow[];
  }

  const statutCounts = {
    pending: 0,
    accepted: 0,
    refused: 0,
    cancelled: 0,
    completed: 0,
    no_show: 0,
  };
  for (const r of reservations) {
    const s = r.statut as StatutKey;
    if (s in statutCounts) statutCounts[s]++;
  }
  const totalDemandes = reservations.length;
  const tauxAcceptation = computeAcceptanceRate(
    statutCounts.accepted,
    statutCounts.refused,
  );

  const minutesSorted = reservations
    .filter((r) => r.traitee_le !== null)
    .map((r) => {
      const diff =
        new Date(r.traitee_le!).getTime() - new Date(r.demande_le).getTime();
      return diff / 60000;
    })
    .sort((a, b) => a - b);

  let medianeMinutes: number | null = null;
  if (minutesSorted.length > 0) {
    const mid = Math.floor(minutesSorted.length / 2);
    medianeMinutes =
      minutesSorted.length % 2 === 0
        ? (minutesSorted[mid - 1] + minutesSorted[mid]) / 2
        : minutesSorted[mid];
  }

  // Passagers
  type PassagerGroup = {
    id: string;
    nb_demandes: number;
    nb_acceptees: number;
    last_demande_at: string;
    statut_dernier: string;
  };
  const passagerMap = new Map<string, PassagerGroup>();
  for (const r of reservations) {
    const ex = passagerMap.get(r.passager_id);
    if (!ex) {
      passagerMap.set(r.passager_id, {
        id: r.passager_id,
        nb_demandes: 1,
        nb_acceptees: r.statut === "accepted" ? 1 : 0,
        last_demande_at: r.demande_le,
        statut_dernier: r.statut,
      });
    } else {
      ex.nb_demandes++;
      if (r.statut === "accepted") ex.nb_acceptees++;
      if (r.demande_le > ex.last_demande_at) {
        ex.last_demande_at = r.demande_le;
        ex.statut_dernier = r.statut;
      }
    }
  }

  const passagerIds = Array.from(passagerMap.keys());
  type ProfileRow = { id: string; prenom: string; nom: string; photo_url: string | null };
  let profilesMap = new Map<string, ProfileRow>();
  if (passagerIds.length > 0) {
    const { data: profilesRaw } = await supabase
      .from("profiles")
      .select("id, prenom, nom, photo_url")
      .in("id", passagerIds);
    profilesMap = new Map(
      (profilesRaw ?? []).map((p: ProfileRow) => [p.id, p]),
    );
  }

  const passagersList = Array.from(passagerMap.values())
    .map((pg) => {
      const prof = profilesMap.get(pg.id);
      return { ...pg, prenom: prof?.prenom ?? "Inconnu", nom: prof?.nom ?? "", photo_url: prof?.photo_url ?? null };
    })
    .sort(
      (a, b) =>
        new Date(b.last_demande_at).getTime() -
        new Date(a.last_demande_at).getTime(),
    );

  // Instances futures avec places restantes
  const instancesFuturesData = instancesFutures.map((inst) => {
    const resasAcceptees = reservations.filter(
      (r) =>
        r.trajet_instance_id === inst.id &&
        (r.statut === "accepted" || r.statut === "completed"),
    ).length;
    return {
      date: inst.date,
      places_restantes: Math.max(0, trajetRaw.places_total - resasAcceptees),
    };
  });

  // Détour moyen via PostGIS (st_distance trajet_ligne / pickup_position)
  const { data: detourData } = await supabase
    .rpc("trajet_detour_moyen_km", { p_trajet_id: trajetId });
  const detourMoyenKm = parseDetourRpcResult(detourData);

  const conducteur = trajetRaw.conducteur as unknown as ProfileRow | null;
  const culte = trajetRaw.culte as unknown as { id: string; libelle: string; jour_semaine: number; heure: string } | null;

  const SENS_LABEL: Record<string, string> = {
    aller: "Aller",
    retour: "Retour",
    aller_retour: "Aller-retour",
  };

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/admin/trajets"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition"
      >
        <ArrowLeft className="size-4" /> Retour aux trajets
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar
            photoUrl={conducteur?.photo_url}
            prenom={conducteur?.prenom}
            nom={conducteur?.nom}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {conducteur ? `${conducteur.prenom} ${conducteur.nom}` : "Conducteur inconnu"}
              </h1>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {SENS_LABEL[trajetRaw.sens] ?? trajetRaw.sens}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 truncate">
              {trajetRaw.depart_adresse}
            </p>
            {culte && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {culte.libelle} · {JOURS[culte.jour_semaine]} à {culte.heure.slice(0, 5)}
                {trajetRaw.heure_depart && ` · Départ ${trajetRaw.heure_depart.slice(0, 5)}`}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              {trajetRaw.places_total}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">places offertes</div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Instances futures"
          value={instancesFutures.length}
          sub={`${instancesPassees} passées · ${instancesAnnulees} annulées`}
          icon={Calendar}
        />
        <StatCard
          label="Demandes total"
          value={totalDemandes}
          icon={Users}
        />
        <StatCard
          label="Taux acceptation"
          value={
            tauxAcceptation !== null
              ? `${Math.round(tauxAcceptation * 100)} %`
              : "—"
          }
          icon={CheckCircle2}
        />
        <StatCard
          label="Places offertes"
          value={trajetRaw.places_total}
          icon={Route}
        />
      </div>

      {/* Répartition statuts */}
      {totalDemandes > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Répartition des demandes
          </h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUT_CONFIG) as StatutKey[]).map((s) => (
              <span
                key={s}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${STATUT_CONFIG[s].color}`}
              >
                {STATUT_CONFIG[s].label}
                <span className="font-bold">{statutCounts[s]}</span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Pas encore de données pour ce trajet
        </div>
      )}

      {/* Performance */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Performance
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
              <Clock className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {medianeMinutes !== null ? `${Math.round(medianeMinutes)} min` : "—"}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                Médiane de réponse
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
              <BarChart3 className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {detourMoyenKm !== null ? formatDetourLong(detourMoyenKm) : "—"}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                Détour moyen consenti
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Passagers */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Passagers ({passagersList.length})
          </h2>
        </div>
        {passagersList.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Aucun passager pour ce trajet.
          </p>
        ) : (
          <>
            {/* Table desktop */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    <th className="px-5 py-3 font-medium">Passager</th>
                    <th className="px-5 py-3 font-medium text-center">Demandes</th>
                    <th className="px-5 py-3 font-medium text-center">Acceptées</th>
                    <th className="px-5 py-3 font-medium">Dernier statut</th>
                    <th className="px-5 py-3 font-medium">Dernière demande</th>
                    <th className="px-5 py-3 font-medium">Profil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {passagersList.map((p) => {
                    const statut = p.statut_dernier as StatutKey;
                    const cfg = STATUT_CONFIG[statut];
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar
                              photoUrl={p.photo_url}
                              prenom={p.prenom}
                              nom={p.nom}
                              size="sm"
                            />
                            <span className="font-medium">
                              {p.prenom} {p.nom}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center text-slate-600 dark:text-slate-300">
                          {p.nb_demandes}
                        </td>
                        <td className="px-5 py-3 text-center text-emerald-700 dark:text-emerald-400 font-medium">
                          {p.nb_acceptees}
                        </td>
                        <td className="px-5 py-3">
                          {cfg ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}
                            >
                              {cfg.label}
                            </span>
                          ) : (
                            <span className="text-slate-400">{p.statut_dernier}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                          {new Date(p.last_demande_at).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            href={`/u/${p.id}`}
                            className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                          >
                            Voir profil
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Cards mobile */}
            <div className="divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
              {passagersList.map((p) => {
                const statut = p.statut_dernier as StatutKey;
                const cfg = STATUT_CONFIG[statut];
                return (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar
                      photoUrl={p.photo_url}
                      prenom={p.prenom}
                      nom={p.nom}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {p.prenom} {p.nom}
                        </span>
                        {cfg && (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {p.nb_demandes} demande{p.nb_demandes !== 1 ? "s" : ""} ·{" "}
                        {p.nb_acceptees} acceptée{p.nb_acceptees !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <Link
                      href={`/u/${p.id}`}
                      className="shrink-0 text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      Profil
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Instances futures */}
      {instancesFuturesData.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Instances futures ({instancesFuturesData.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {instancesFuturesData.map(({ date, places_restantes }) => (
              <div
                key={date}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="text-slate-700 dark:text-slate-200">
                  {new Date(date + "T00:00:00").toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span
                  className={`font-medium ${
                    places_restantes > 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {places_restantes} place{places_restantes !== 1 ? "s" : ""} libre{places_restantes !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

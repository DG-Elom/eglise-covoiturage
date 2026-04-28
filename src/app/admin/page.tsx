import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatsSection } from "./stats-section";

export default async function AdminPage() {
  const supabase = await createClient();
  const stats = await loadStats(supabase);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
        Vue d&apos;ensemble · Stats globales de la plateforme.
      </div>
      <StatsSection stats={stats} />
    </div>
  );
}

type ReservationStatut =
  | "pending"
  | "accepted"
  | "refused"
  | "cancelled"
  | "completed"
  | "no_show";

export type StatsPayload = {
  users: number;
  conducteurs: number;
  trajetsActifs: number;
  prochainesDates: number;
  demandesEnAttente: number;
  trajetsParProgramme: { libelle: string; count: number }[];
  statutsReservations: { statut: ReservationStatut; count: number }[];
  topConducteurs: {
    id: string;
    prenom: string;
    nom: string;
    photo_url: string | null;
    count: number;
  }[];
  sparkline14j: { date: string; count: number }[];
};

async function loadStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<StatsPayload> {
  const today = new Date().toISOString().slice(0, 10);
  const since14d = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [
    users,
    conducteurs,
    trajets,
    instances,
    reservationsPending,
    cultesActifs,
    trajetsForCultes,
    reservationsAll,
    completedReservations,
    sparklineRows,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("role", ["conducteur", "les_deux"]),
    supabase.from("trajets").select("*", { count: "exact", head: true }).eq("actif", true),
    supabase
      .from("trajets_instances")
      .select("*", { count: "exact", head: true })
      .gte("date", today)
      .eq("annule_par_conducteur", false),
    supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("statut", "pending"),
    supabase
      .from("cultes")
      .select("id, libelle")
      .eq("actif", true),
    supabase
      .from("trajets")
      .select("culte_id")
      .eq("actif", true),
    supabase.from("reservations").select("statut"),
    supabase
      .from("reservations")
      .select("trajet_instance_id, trajets_instances(trajet_id, trajets(conducteur_id))")
      .eq("statut", "completed"),
    supabase
      .from("reservations")
      .select("demande_le")
      .gte("demande_le", `${since14d}T00:00:00`),
  ]);

  const cultesList = (cultesActifs.data ?? []) as { id: string; libelle: string }[];
  const trajetsRows = (trajetsForCultes.data ?? []) as { culte_id: string }[];
  const culteCount = new Map<string, number>();
  for (const t of trajetsRows) {
    culteCount.set(t.culte_id, (culteCount.get(t.culte_id) ?? 0) + 1);
  }
  const trajetsParProgramme = cultesList
    .map((c) => ({ libelle: c.libelle, count: culteCount.get(c.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const statutsOrder: ReservationStatut[] = [
    "pending",
    "accepted",
    "refused",
    "cancelled",
    "completed",
    "no_show",
  ];
  const statutCount = new Map<ReservationStatut, number>();
  for (const r of (reservationsAll.data ?? []) as { statut: ReservationStatut }[]) {
    statutCount.set(r.statut, (statutCount.get(r.statut) ?? 0) + 1);
  }
  const statutsReservations = statutsOrder.map((s) => ({
    statut: s,
    count: statutCount.get(s) ?? 0,
  }));

  type CompletedRow = {
    trajets_instances: {
      trajets: { conducteur_id: string } | null;
    } | null;
  };
  const completedRows = (completedReservations.data ?? []) as unknown as CompletedRow[];
  const conducteurCount = new Map<string, number>();
  for (const row of completedRows) {
    const cid = row.trajets_instances?.trajets?.conducteur_id;
    if (!cid) continue;
    conducteurCount.set(cid, (conducteurCount.get(cid) ?? 0) + 1);
  }
  const topIds = [...conducteurCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  let topConducteurs: StatsPayload["topConducteurs"] = [];
  if (topIds.length > 0) {
    const { data: profilesTop } = await supabase
      .from("profiles")
      .select("id, prenom, nom, photo_url")
      .in(
        "id",
        topIds.map(([id]) => id),
      );
    const byId = new Map(
      ((profilesTop ?? []) as {
        id: string;
        prenom: string;
        nom: string;
        photo_url: string | null;
      }[]).map((p) => [p.id, p]),
    );
    topConducteurs = topIds
      .map(([id, count]) => {
        const p = byId.get(id);
        if (!p) return null;
        return {
          id: p.id,
          prenom: p.prenom,
          nom: p.nom,
          photo_url: p.photo_url,
          count,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  const dayBuckets = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    dayBuckets.set(d, 0);
  }
  for (const r of (sparklineRows.data ?? []) as { demande_le: string }[]) {
    const day = r.demande_le.slice(0, 10);
    if (dayBuckets.has(day)) dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
  }
  const sparkline14j = [...dayBuckets.entries()].map(([date, count]) => ({
    date,
    count,
  }));

  return {
    users: users.count ?? 0,
    conducteurs: conducteurs.count ?? 0,
    trajetsActifs: trajets.count ?? 0,
    prochainesDates: instances.count ?? 0,
    demandesEnAttente: reservationsPending.count ?? 0,
    trajetsParProgramme,
    statutsReservations,
    topConducteurs,
    sparkline14j,
  };
}

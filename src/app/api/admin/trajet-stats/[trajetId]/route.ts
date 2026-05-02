import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeAcceptanceRate } from "@/lib/trajet-stats";

export const runtime = "nodejs";

export interface TrajetStatsPassager {
  id: string;
  prenom: string;
  nom: string;
  photo_url: string | null;
  nb_demandes: number;
  nb_acceptees: number;
  last_demande_at: string;
  statut_dernier: string;
}

export interface TrajetStatsResponse {
  trajet: {
    id: string;
    depart_adresse: string;
    places_total: number;
    sens: string;
    heure_depart: string;
    conducteur: {
      id: string;
      prenom: string;
      nom: string;
      photo_url: string | null;
    } | null;
    culte: {
      id: string;
      libelle: string;
      jour_semaine: number;
      heure: string;
    } | null;
  };
  stats: {
    instances: { passees: number; futures: number; annulees: number };
    demandes: {
      total: number;
      pending: number;
      accepted: number;
      refused: number;
      cancelled: number;
      completed: number;
      no_show: number;
    };
    taux_acceptation: number | null;
    mediane_minutes_reponse: number | null;
    detour_moyen_km: number | null;
  };
  passagers: TrajetStatsPassager[];
  instances_futures: Array<{ date: string; places_restantes: number }>;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trajetId: string }> },
): Promise<NextResponse> {
  const { trajetId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile?.is_admin) {
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
  }

  // Trajet + conducteur + culte
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
    return NextResponse.json({ error: "Trajet introuvable" }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Instances
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
  const instancesAnnulees = instances.filter(
    (i) => i.annule_par_conducteur,
  ).length;

  const instanceIds = instances.map((i) => i.id);

  // Reservations (toutes instances du trajet)
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

  // Comptage par statut
  const statutCounts = {
    pending: 0,
    accepted: 0,
    refused: 0,
    cancelled: 0,
    completed: 0,
    no_show: 0,
  };
  for (const r of reservations) {
    const s = r.statut as keyof typeof statutCounts;
    if (s in statutCounts) statutCounts[s]++;
  }
  const total = reservations.length;

  // Taux acceptation
  const tauxAcceptation = computeAcceptanceRate(
    statutCounts.accepted,
    statutCounts.refused,
  );

  // Médiane minutes réponse (côté JS — les données sont déjà chargées)
  const minutes = reservations
    .filter((r) => r.traitee_le !== null)
    .map((r) => {
      const diff =
        new Date(r.traitee_le!).getTime() - new Date(r.demande_le).getTime();
      return diff / 60000;
    })
    .sort((a, b) => a - b);

  let medianeMinutes: number | null = null;
  if (minutes.length > 0) {
    const mid = Math.floor(minutes.length / 2);
    medianeMinutes =
      minutes.length % 2 === 0
        ? (minutes[mid - 1] + minutes[mid]) / 2
        : minutes[mid];
  }

  // Passagers — grouper par passager_id
  type PassagerGroup = {
    id: string;
    nb_demandes: number;
    nb_acceptees: number;
    last_demande_at: string;
    statut_dernier: string;
  };

  const passagerMap = new Map<string, PassagerGroup>();
  for (const r of reservations) {
    const existing = passagerMap.get(r.passager_id);
    if (!existing) {
      passagerMap.set(r.passager_id, {
        id: r.passager_id,
        nb_demandes: 1,
        nb_acceptees: r.statut === "accepted" ? 1 : 0,
        last_demande_at: r.demande_le,
        statut_dernier: r.statut,
      });
    } else {
      existing.nb_demandes++;
      if (r.statut === "accepted") existing.nb_acceptees++;
      if (r.demande_le > existing.last_demande_at) {
        existing.last_demande_at = r.demande_le;
        existing.statut_dernier = r.statut;
      }
    }
  }

  const passagerIds = Array.from(passagerMap.keys());
  let passagers: TrajetStatsPassager[] = [];

  if (passagerIds.length > 0) {
    const { data: profilesRaw } = await supabase
      .from("profiles")
      .select("id, prenom, nom, photo_url")
      .in("id", passagerIds);

    const profilesMap = new Map(
      (profilesRaw ?? []).map((p: { id: string; prenom: string; nom: string; photo_url: string | null }) => [p.id, p]),
    );

    passagers = Array.from(passagerMap.values())
      .map((pg) => {
        const prof = profilesMap.get(pg.id);
        return {
          id: pg.id,
          prenom: prof?.prenom ?? "Inconnu",
          nom: prof?.nom ?? "",
          photo_url: prof?.photo_url ?? null,
          nb_demandes: pg.nb_demandes,
          nb_acceptees: pg.nb_acceptees,
          last_demande_at: pg.last_demande_at,
          statut_dernier: pg.statut_dernier,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.last_demande_at).getTime() -
          new Date(a.last_demande_at).getTime(),
      );
  }

  // Instances futures avec places restantes
  type InstanceFuture = { date: string; places_restantes: number };
  const instancesFuturesData: InstanceFuture[] = [];

  for (const inst of instancesFutures) {
    const resasAcceptees = reservations.filter(
      (r) =>
        r.trajet_instance_id === inst.id &&
        (r.statut === "accepted" || r.statut === "completed"),
    ).length;
    const places_restantes = Math.max(
      0,
      (trajetRaw as { places_total: number }).places_total - resasAcceptees,
    );
    instancesFuturesData.push({
      date: inst.date,
      places_restantes,
    });
  }

  // Détour moyen — calculé en JS à partir des données disponibles
  // (st_distance nécessiterait une requête SQL raw non disponible via client JS)
  // On retourne null ici ; la valeur réelle nécessite PostGIS direct
  const detourMoyenKm: number | null = null;

  const response: TrajetStatsResponse = {
    trajet: {
      id: trajetRaw.id,
      depart_adresse: trajetRaw.depart_adresse,
      places_total: trajetRaw.places_total,
      sens: trajetRaw.sens,
      heure_depart: trajetRaw.heure_depart ?? "",
      conducteur: trajetRaw.conducteur as unknown as TrajetStatsResponse["trajet"]["conducteur"],
      culte: trajetRaw.culte as unknown as TrajetStatsResponse["trajet"]["culte"],
    },
    stats: {
      instances: {
        passees: instancesPassees,
        futures: instancesFutures.length,
        annulees: instancesAnnulees,
      },
      demandes: { total, ...statutCounts },
      taux_acceptation: tauxAcceptation,
      mediane_minutes_reponse: medianeMinutes !== null ? Math.round(medianeMinutes) : null,
      detour_moyen_km: detourMoyenKm,
    },
    passagers,
    instances_futures: instancesFuturesData,
  };

  return NextResponse.json(response);
}

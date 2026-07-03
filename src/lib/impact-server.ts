import "server-only";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  computeImpactStats,
  KM_MOYEN_PAR_TRAJET,
  type ImpactRawData,
  type ImpactStats,
} from "@/lib/impact";

export type CurrentMonthImpact = {
  /** Premier jour du mois courant (UTC, format YYYY-MM-DD). */
  debutMois: string;
  stats: ImpactStats;
};

/** Premier instant du mois courant en UTC. */
export function startOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
}

/**
 * Agrégats d'impact COMMUNAUTAIRES du mois courant.
 *
 * Lecture en service_role : ce sont des compteurs anonymes (nombre de trajets,
 * de passagers, d'inscrits, de messages) destinés à toute la communauté. Sous
 * la RLS d'un membre lambda, `reservations`/`messages` ne renverraient que SES
 * propres lignes — la carte afficherait alors des chiffres personnels, pas
 * communautaires. L'accès à la page/route reste protégé par une garde auth en
 * amont ; ici on ne renvoie que des totaux, aucune donnée individuelle.
 */
export async function fetchCurrentMonthImpact(): Promise<CurrentMonthImpact> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("service_unavailable");

  const admin = createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sinceIso = startOfCurrentMonthUTC().toISOString();
  const sinceDate = sinceIso.slice(0, 10);

  const [
    { count: trajetsEffectues },
    { count: passagersTransportes },
    { count: nouveauxInscrits },
    { count: messagesEchanges },
  ] = await Promise.all([
    admin
      .from("trajets_instances")
      .select("id", { count: "exact", head: true })
      .eq("annule_par_conducteur", false)
      .gte("date", sinceDate),
    admin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("statut", "completed")
      .gte("demande_le", sinceIso),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso),
    admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gte("envoye_le", sinceIso),
  ]);

  const raw: ImpactRawData = {
    trajetsEffectues: trajetsEffectues ?? 0,
    passagersTransportes: passagersTransportes ?? 0,
    nouveauxInscrits: nouveauxInscrits ?? 0,
    messagesEchanges: messagesEchanges ?? 0,
    kmCumules: (trajetsEffectues ?? 0) * KM_MOYEN_PAR_TRAJET,
  };

  return { debutMois: sinceDate, stats: computeImpactStats(raw) };
}

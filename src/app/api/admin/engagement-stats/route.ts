import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface EngagementLogRow {
  kind: string;
  sent_at: string;
}

interface EligibleProfile {
  id: string;
  prenom: string;
  nom: string;
  charte_acceptee_at: string;
  age_jours: number;
  next_kind: EngageKind | null;
}

type EngageKind = "engage_d2" | "engage_d7" | "engage_d14";

function chooseKind(ageJours: number): EngageKind | null {
  if (ageJours >= 2 && ageJours < 7) return "engage_d2";
  if (ageJours >= 7 && ageJours < 14) return "engage_d7";
  if (ageJours >= 14 && ageJours < 28) return "engage_d14";
  return null;
}

export async function GET(): Promise<NextResponse> {
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

  // 1. Nombre total de passagers inactifs (jamais réservé)
  const { data: allPassagers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["passager", "les_deux"])
    .eq("suspended", false);

  let totalInactifs = 0;
  const passagerIds = (allPassagers ?? []).map((p: { id: string }) => p.id);

  if (passagerIds.length > 0) {
    const { data: avecReservation } = await supabase
      .from("reservations")
      .select("passager_id")
      .in("passager_id", passagerIds);

    const idsAvecResa = new Set((avecReservation ?? []).map((r: { passager_id: string }) => r.passager_id));
    totalInactifs = passagerIds.filter((id: string) => !idsAvecResa.has(id)).length;
  }

  // 2. Relances envoyées par kind sur 30 jours
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: logsRaw } = await supabase
    .from("engagement_log")
    .select("kind, sent_at")
    .gte("sent_at", thirtyDaysAgo);

  const logs = (logsRaw ?? []) as EngagementLogRow[];
  const relancesByKind: Record<string, number> = {
    engage_d2: 0,
    engage_d7: 0,
    engage_d14: 0,
  };
  for (const log of logs) {
    if (log.kind in relancesByKind) {
      relancesByKind[log.kind]++;
    }
  }

  // 3. Passagers actuellement éligibles à une relance
  const { data: inactifsRaw } = await supabase
    .from("profiles")
    .select("id, prenom, nom, charte_acceptee_at")
    .in("role", ["passager", "les_deux"])
    .eq("suspended", false)
    .not("charte_acceptee_at", "is", null)
    .lte("charte_acceptee_at", new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString());

  const inactifs = (inactifsRaw ?? []) as Array<{
    id: string;
    prenom: string;
    nom: string;
    charte_acceptee_at: string;
  }>;

  const eligibles: EligibleProfile[] = [];
  const now = Date.now();

  for (const p of inactifs) {
    // Vérifier pas de réservation
    const { count } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("passager_id", p.id);

    if ((count ?? 0) > 0) continue;

    const ageJours = Math.floor((now - new Date(p.charte_acceptee_at).getTime()) / (24 * 3600 * 1000));
    const nextKind = chooseKind(ageJours);
    if (!nextKind) continue;

    // Vérifier si déjà envoyé
    const { data: alreadySent } = await supabase
      .from("engagement_log")
      .select("id")
      .eq("user_id", p.id)
      .eq("kind", nextKind)
      .limit(1)
      .maybeSingle();

    if (alreadySent) continue;

    eligibles.push({
      id: p.id,
      prenom: p.prenom,
      nom: p.nom,
      charte_acceptee_at: p.charte_acceptee_at,
      age_jours: ageJours,
      next_kind: nextKind,
    });
  }

  return NextResponse.json({
    total_inactifs: totalInactifs,
    relances_30j: relancesByKind,
    eligibles_maintenant: eligibles,
  });
}

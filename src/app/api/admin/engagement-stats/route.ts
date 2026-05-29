import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildEligibles } from "./_logic";

export const runtime = "nodejs";

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

  const logs = (logsRaw ?? []) as Array<{ kind: string; sent_at: string }>;
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

  const inactifIds = inactifs.map((p) => p.id);
  const now = Date.now();

  // Requêtes agrégées (remplace la boucle N+1 qui faisait 2 requêtes/passager)
  const [{ data: inactifResasRaw }, { data: inactifLogsRaw }] =
    inactifIds.length > 0
      ? await Promise.all([
          supabase
            .from("reservations")
            .select("passager_id")
            .in("passager_id", inactifIds),
          supabase
            .from("engagement_log")
            .select("user_id, kind")
            .in("user_id", inactifIds),
        ])
      : [{ data: [] }, { data: [] }];

  const eligibles = buildEligibles(
    inactifs,
    (inactifResasRaw ?? []) as Array<{ passager_id: string }>,
    (inactifLogsRaw ?? []) as Array<{ user_id: string; kind: string }>,
    now,
  );

  return NextResponse.json({
    total_inactifs: totalInactifs,
    relances_30j: relancesByKind,
    eligibles_maintenant: eligibles,
  });
}

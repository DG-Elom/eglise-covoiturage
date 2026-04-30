import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeTopScore, type RawStats } from "@/lib/top-score";

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

  const { data: statsRows, error } = await supabase
    .from("user_top_score")
    .select(
      "user_id, trajets_proposes, demandes_recues, demandes_acceptees, passagers_transportes, km_detour_consenti, median_minutes_reponse, taux_acceptation",
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!statsRows || statsRows.length === 0) {
    return NextResponse.json({ debug: [] });
  }

  const raw: RawStats[] = statsRows.map((r) => ({
    user_id: r.user_id as string,
    trajets_proposes: Number(r.trajets_proposes ?? 0),
    demandes_recues: Number(r.demandes_recues ?? 0),
    demandes_acceptees: Number(r.demandes_acceptees ?? 0),
    passagers_transportes: Number(r.passagers_transportes ?? 0),
    km_detour_consenti: Number(r.km_detour_consenti ?? 0),
    median_minutes_reponse:
      r.median_minutes_reponse !== null && r.median_minutes_reponse !== undefined
        ? Number(r.median_minutes_reponse)
        : null,
    taux_acceptation:
      r.taux_acceptation !== null && r.taux_acceptation !== undefined
        ? Number(r.taux_acceptation)
        : null,
  }));

  const scored = computeTopScore(raw);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, prenom, nom")
    .in(
      "id",
      scored.map((r) => r.user_id),
    );

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const debug = scored.map((r) => {
    const profile = profileMap.get(r.user_id);
    return {
      user_id: r.user_id,
      prenom: profile?.prenom ?? null,
      nom: profile?.nom ?? null,
      score: r.score,
      trajets_proposes: r.trajets_proposes,
      demandes_recues: r.demandes_recues,
      demandes_acceptees: r.demandes_acceptees,
      passagers_transportes: r.passagers_transportes,
      km_detour_consenti: r.km_detour_consenti,
      median_minutes_reponse: r.median_minutes_reponse,
      taux_acceptation: r.taux_acceptation,
    };
  });

  return NextResponse.json({ debug });
}

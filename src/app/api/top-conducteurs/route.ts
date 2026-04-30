import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeTopScore, type RawStats } from "@/lib/top-score";

export type TopConducteur = {
  id: string;
  prenom: string;
  nom: string;
  photoUrl: string | null;
  passagersTransportes: number;
  kmDetourConsenti: number;
  trajetsProposes: number;
};

export type TopConducteursResponse = {
  top: TopConducteur[];
};

export async function GET() {
  const supabase = await createClient();

  const { data: statsRows, error } = await supabase
    .from("user_top_score")
    .select(
      "user_id, trajets_proposes, demandes_recues, demandes_acceptees, passagers_transportes, km_detour_consenti, median_minutes_reponse, taux_acceptation",
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!statsRows || statsRows.length === 0) {
    return NextResponse.json({ top: [] } satisfies TopConducteursResponse);
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

  const scored = computeTopScore(raw).slice(0, 3);

  if (scored.length === 0) {
    return NextResponse.json({ top: [] } satisfies TopConducteursResponse);
  }

  const userIds = scored.map((r) => r.user_id);

  const { data: profiles, error: profError } = await supabase
    .from("profiles")
    .select("id, prenom, nom, photo_url")
    .in("id", userIds);

  if (profError) {
    return NextResponse.json({ error: profError.message }, { status: 500 });
  }

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p]),
  );

  const top: TopConducteur[] = scored
    .map((row) => {
      const profile = profileMap.get(row.user_id);
      if (!profile) return null;
      return {
        id: row.user_id,
        prenom: profile.prenom,
        nom: profile.nom,
        photoUrl: profile.photo_url,
        passagersTransportes: row.passagers_transportes,
        kmDetourConsenti: row.km_detour_consenti,
        trajetsProposes: row.trajets_proposes,
      };
    })
    .filter((r): r is TopConducteur => r !== null);

  return NextResponse.json({ top } satisfies TopConducteursResponse);
}

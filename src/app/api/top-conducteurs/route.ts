import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type TopConducteur = {
  id: string;
  prenom: string;
  nom: string;
  photoUrl: string | null;
  trajetsCeMois: number;
  placesOffertes30j: number;
  noteMoyenne: number | null;
};

export type TopConducteursResponse = {
  top: TopConducteur[];
};

export async function GET() {
  const supabase = await createClient();

  const { data: statsRows, error } = await supabase
    .from("user_stats")
    .select("user_id, mois_courant_trajets, places_offertes_30j, note_moyenne")
    .order("mois_courant_trajets", { ascending: false })
    .order("places_offertes_30j", { ascending: false })
    .limit(3);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!statsRows || statsRows.length === 0) {
    return NextResponse.json({ top: [] } satisfies TopConducteursResponse);
  }

  const userIds = statsRows.map((r) => r.user_id);

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

  const top: TopConducteur[] = statsRows
    .map((row) => {
      const profile = profileMap.get(row.user_id);
      if (!profile) return null;
      return {
        id: row.user_id,
        prenom: profile.prenom,
        nom: profile.nom,
        photoUrl: profile.photo_url,
        trajetsCeMois: row.mois_courant_trajets,
        placesOffertes30j: row.places_offertes_30j,
        noteMoyenne: row.note_moyenne,
      };
    })
    .filter((r): r is TopConducteur => r !== null);

  return NextResponse.json({ top } satisfies TopConducteursResponse);
}

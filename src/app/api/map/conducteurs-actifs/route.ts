import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anonymiserTrajet, type TrajetRaw } from "./_logic";

export const runtime = "nodejs";

type TrajetRow = {
  id: string;
  sens: "aller" | "retour" | "aller_retour";
  places_total: number;
  depart_position: unknown;
  culte: {
    libelle: string;
    heure: string;
    jour_semaine: number;
  };
};

function extractCoords(position: unknown): { lat: number; lng: number } | null {
  if (!position || typeof position !== "object") return null;
  const obj = position as Record<string, unknown>;
  if (obj.type === "Point" && Array.isArray(obj.coordinates)) {
    const [lng, lat] = obj.coordinates as number[];
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  }
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

  const { data: trajets, error } = await supabase
    .from("trajets")
    .select(
      `id, sens, places_total, depart_position,
       culte:cultes!inner (libelle, heure, jour_semaine),
       conducteur:profiles!trajets_conducteur_id_fkey (suspended)`,
    )
    .eq("actif", true)
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Erreur de chargement" }, { status: 500 });
  }

  const rows = (trajets ?? []) as unknown as (TrajetRow & {
    conducteur: { suspended: boolean };
  })[];

  const result = rows
    .filter((t) => !t.conducteur?.suspended)
    .map((t) => {
      const coords = extractCoords(t.depart_position);
      if (!coords) return null;
      const raw: TrajetRaw = {
        id: t.id,
        depart_lat: coords.lat,
        depart_lng: coords.lng,
        sens: t.sens,
        places_total: t.places_total,
        culte_libelle: t.culte.libelle,
        culte_heure: t.culte.heure,
        culte_jour: t.culte.jour_semaine,
      };
      return anonymiserTrajet(raw);
    })
    .filter(<T>(x: T | null): x is T => x !== null)
    .sort((a, b) => a.heure_culte.localeCompare(b.heure_culte));

  return NextResponse.json({ conducteurs: result });
}

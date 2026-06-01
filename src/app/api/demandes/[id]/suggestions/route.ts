import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  compatibleDrivers,
  type DemandeMatch,
  type TrajetMatch,
} from "@/lib/match-driver";

export const runtime = "nodejs";

type DemandeRow = {
  id: string;
  passager_id: string;
  culte_id: string;
  date: string;
  sens: "aller" | "retour";
  pickup_position: unknown;
};

type TrajetRow = {
  id: string;
  conducteur_id: string;
  culte_id: string;
  sens: "aller" | "retour" | "aller_retour";
  places_total: number;
  depart_adresse: string;
  heure_depart: string;
  depart_position: unknown;
  conducteur: { prenom: string; nom: string; photo_url: string | null } | null;
};

/** Extrait { lat, lng } d'un geography PostGIS sérialisé en GeoJSON Point. */
function extractCoords(position: unknown): { lat: number; lng: number } | null {
  if (!position || typeof position !== "object") return null;
  const obj = position as Record<string, unknown>;
  if (obj.type === "Point" && Array.isArray(obj.coordinates)) {
    const [lng, lat] = obj.coordinates as number[];
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Lecture de la demande (RLS : owner ou admin). Si invisible -> 404.
  const { data: demande, error: demandeErr } = await supabase
    .from("demandes_passager")
    .select("id, passager_id, culte_id, date, sens, pickup_position")
    .eq("id", id)
    .maybeSingle();

  if (demandeErr) {
    return NextResponse.json({ error: "Erreur de chargement" }, { status: 500 });
  }
  if (!demande) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  const d = demande as DemandeRow;

  // Garde explicite : propriétaire de la demande OU admin.
  if (d.passager_id !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const pickup = extractCoords(d.pickup_position);
  if (!pickup) {
    return NextResponse.json({ suggestions: [] });
  }

  // Trajets actifs du même culte (le sens et la distance sont filtrés en logique pure).
  const { data: trajets, error: trajetsErr } = await supabase
    .from("trajets")
    .select(
      `id, conducteur_id, culte_id, sens, places_total, depart_adresse, heure_depart, depart_position,
       conducteur:profiles!trajets_conducteur_id_fkey (prenom, nom, photo_url, suspended)`,
    )
    .eq("actif", true)
    .eq("culte_id", d.culte_id)
    .limit(100);

  if (trajetsErr) {
    return NextResponse.json({ error: "Erreur de chargement" }, { status: 500 });
  }

  const rows = (trajets ?? []) as unknown as (TrajetRow & {
    conducteur: (TrajetRow["conducteur"] & { suspended: boolean }) | null;
  })[];

  const matchTrajets: (TrajetMatch & { row: (typeof rows)[number] })[] = rows
    .filter((t) => !t.conducteur?.suspended)
    .map((t) => ({
      id: t.id,
      culte_id: t.culte_id,
      sens: t.sens,
      depart: extractCoords(t.depart_position),
      places: t.places_total,
      row: t,
    }));

  const demandeMatch: DemandeMatch = {
    culte_id: d.culte_id,
    sens: d.sens,
    pickup,
  };

  const suggestions = compatibleDrivers(demandeMatch, matchTrajets)
    .slice(0, 3)
    .map(({ trajet, distanceKm }) => {
      const t = trajet.row;
      return {
        trajet_id: t.id,
        distance_km: Math.round(distanceKm * 10) / 10,
        depart_adresse: t.depart_adresse,
        heure_depart: t.heure_depart,
        sens: t.sens,
        places_total: t.places_total,
        conducteur: t.conducteur
          ? {
              prenom: t.conducteur.prenom,
              nom: t.conducteur.nom,
              photo_url: t.conducteur.photo_url,
            }
          : null,
        // Infos pour démarrer une réservation depuis le parcours existant.
        culte_id: d.culte_id,
        date: d.date,
        demande_sens: d.sens,
      };
    });

  return NextResponse.json({ suggestions });
}

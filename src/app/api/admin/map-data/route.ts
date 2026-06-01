import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractCoords,
  buildOrphelins,
  computeStats,
  type DemandeRaw,
  type TrajetRaw,
  type MiniProfil,
  type GeoPoint,
} from "./_logic";

export const runtime = "nodejs";

const ICC_METZ: GeoPoint = { lat: 49.146943, lng: 6.175955 };

/** Aujourd'hui au format YYYY-MM-DD en heure de Paris. */
function todayParis(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

/** PostgREST renvoie parfois une jointure to-one comme tableau : on aplatit. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
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

  const culteFilter = req.nextUrl.searchParams.get("culte");
  const today = todayParis();

  // --- Demande : passagers en attente (demandes actives, à venir) -----------
  let demandesQuery = supabase
    .from("demandes_passager")
    .select(
      `id, sens, culte_id, date, pickup_adresse, notes, created_at, pickup_position,
       passager:profiles!demandes_passager_passager_id_fkey (id, prenom, nom, photo_url),
       culte:cultes (libelle, heure)`,
    )
    .eq("statut", "active")
    .gte("date", today)
    .limit(500);
  if (culteFilter) demandesQuery = demandesQuery.eq("culte_id", culteFilter);

  // --- Offre : conducteurs avec un trajet actif -----------------------------
  let trajetsQuery = supabase
    .from("trajets")
    .select(
      `id, sens, culte_id, places_total, depart_adresse, depart_position,
       conducteur:profiles!trajets_conducteur_id_fkey (id, prenom, nom, photo_url, suspended),
       culte:cultes (libelle)`,
    )
    .eq("actif", true)
    .limit(500);
  if (culteFilter) trajetsQuery = trajetsQuery.eq("culte_id", culteFilter);

  const [demandesRes, trajetsRes, egliseRes, cultesRes] = await Promise.all([
    demandesQuery,
    trajetsQuery,
    supabase.from("eglise").select("position").limit(1).maybeSingle(),
    supabase.from("cultes").select("id, libelle").eq("actif", true).order("heure"),
  ]);

  if (demandesRes.error || trajetsRes.error) {
    return NextResponse.json({ error: "Erreur de chargement" }, { status: 500 });
  }

  type DemandeJoin = {
    id: string;
    sens: "aller" | "retour";
    culte_id: string;
    date: string;
    pickup_adresse: string;
    notes: string | null;
    created_at: string;
    pickup_position: unknown;
    passager: MiniProfil | MiniProfil[] | null;
    culte: { libelle: string; heure: string } | { libelle: string; heure: string }[] | null;
  };

  const demandes: DemandeRaw[] = ((demandesRes.data ?? []) as unknown as DemandeJoin[]).map(
    (d) => ({
      id: d.id,
      sens: d.sens,
      culte_id: d.culte_id,
      date: d.date,
      pickup_adresse: d.pickup_adresse,
      notes: d.notes,
      created_at: d.created_at,
      position: extractCoords(d.pickup_position),
      passager: one(d.passager),
      culte: one(d.culte),
    }),
  );

  type TrajetJoin = {
    id: string;
    sens: "aller" | "retour" | "aller_retour";
    culte_id: string;
    places_total: number;
    depart_adresse: string;
    depart_position: unknown;
    conducteur:
      | (MiniProfil & { suspended: boolean })
      | (MiniProfil & { suspended: boolean })[]
      | null;
    culte: { libelle: string } | { libelle: string }[] | null;
  };

  const trajetsRaw = (trajetsRes.data ?? []) as unknown as TrajetJoin[];
  const trajets: TrajetRaw[] = [];
  const offre: {
    id: string;
    lat: number;
    lng: number;
    conducteur: MiniProfil | null;
    depart_adresse: string;
    places_total: number;
    culte_libelle: string;
    sens: string;
  }[] = [];

  for (const t of trajetsRaw) {
    const conducteurFull = one(t.conducteur);
    if (conducteurFull?.suspended) continue; // on n'affiche pas l'offre des comptes suspendus
    const conducteur: MiniProfil | null = conducteurFull
      ? {
          id: conducteurFull.id,
          prenom: conducteurFull.prenom,
          nom: conducteurFull.nom,
          photo_url: conducteurFull.photo_url,
        }
      : null;
    const position = extractCoords(t.depart_position);
    trajets.push({
      id: t.id,
      sens: t.sens,
      culte_id: t.culte_id,
      places_total: t.places_total,
      depart_adresse: t.depart_adresse,
      position,
      conducteur,
    });
    if (position) {
      offre.push({
        id: t.id,
        lat: position.lat,
        lng: position.lng,
        conducteur,
        depart_adresse: t.depart_adresse,
        places_total: t.places_total,
        culte_libelle: one(t.culte)?.libelle ?? "",
        sens: t.sens,
      });
    }
  }

  const orphelins = buildOrphelins(demandes, trajets, Date.now());
  const stats = computeStats(orphelins, trajets);

  // Ancre = position de l'église (sinon ICC Metz par défaut).
  let eglise = ICC_METZ;
  const egPos = extractCoords(egliseRes.data?.position);
  if (egPos) eglise = egPos;

  return NextResponse.json({
    eglise,
    cultes: cultesRes.data ?? [],
    offre,
    orphelins,
    stats,
  });
}

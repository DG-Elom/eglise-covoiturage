import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nextOccurrenceDates } from "@/lib/dates";

// Nombre de semaines matérialisées par défaut (« reproduire les 4 prochaines
// semaines »). Borné pour éviter qu'un appel ne crée un nombre arbitraire
// d'instances au-delà de l'horizon du cron generer_trajets_instances (30 j).
const DEFAULT_WEEKS = 4;
const MAX_WEEKS = 6;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  // Garde auth AVANT toute lecture métier (cf. convention routes API).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { weeks?: unknown };
  const weeks =
    typeof body.weeks === "number" && Number.isInteger(body.weeks)
      ? Math.min(MAX_WEEKS, Math.max(1, body.weeks))
      : DEFAULT_WEEKS;

  // Le trajet doit appartenir au conducteur courant et être actif. On récupère
  // le jour_semaine du culte pour calculer les occurrences.
  const { data: trajet, error: fetchErr } = await supabase
    .from("trajets")
    .select(
      `id, actif, conducteur_id,
       cultes ( jour_semaine )`,
    )
    .eq("id", id)
    .single();

  if (fetchErr || !trajet) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (trajet.conducteur_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!trajet.actif) {
    return NextResponse.json({ error: "trajet_inactif" }, { status: 409 });
  }

  const culte = trajet.cultes as unknown as { jour_semaine: number } | null;
  if (!culte || typeof culte.jour_semaine !== "number") {
    return NextResponse.json({ error: "culte_invalide" }, { status: 409 });
  }

  const dates = nextOccurrenceDates(culte.jour_semaine, weeks);
  if (dates.length === 0) {
    return NextResponse.json({ created: 0, dates: [] });
  }

  // Quelles instances existent déjà (toutes confondues, y compris annulées) ?
  // Sert uniquement à reporter le nombre réellement créé : la contrainte UNIQUE
  // (trajet_id, date) garantit l'idempotence côté DB.
  const { data: existing } = await supabase
    .from("trajets_instances")
    .select("date")
    .eq("trajet_id", id)
    .in("date", dates);

  const existingDates = new Set((existing ?? []).map((r) => r.date as string));
  const toCreate = dates.filter((d) => !existingDates.has(d));

  if (toCreate.length === 0) {
    // Tout est déjà matérialisé (probablement par le cron) : rien à faire.
    return NextResponse.json({ created: 0, dates });
  }

  // Insertion idempotente : ignoreDuplicates couvre une éventuelle course avec
  // le cron entre le SELECT ci-dessus et l'INSERT. La RLS « conducteur gère
  // instances » autorise ces lignes (trajet appartient au conducteur).
  const { error: insertErr } = await supabase
    .from("trajets_instances")
    .upsert(
      toCreate.map((d) => ({ trajet_id: id, date: d })) as never,
      { onConflict: "trajet_id,date", ignoreDuplicates: true },
    );

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ created: toCreate.length, dates });
}

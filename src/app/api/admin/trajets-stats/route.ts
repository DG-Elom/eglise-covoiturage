import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeAcceptanceRate } from "@/lib/trajet-stats";

export const runtime = "nodejs";

export interface TrajetStatRow {
  trajet_id: string;
  depart_adresse: string;
  conducteur_prenom: string;
  conducteur_nom: string;
  places_total: number;
  instances_count: number;
  demandes_total: number;
  taux_acceptation: number | null;
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

  const { data: trajetsRaw, error: trajetsErr } = await supabase
    .from("trajets")
    .select(
      `id, depart_adresse, places_total,
       conducteur:profiles!trajets_conducteur_id_fkey (id, prenom, nom),
       trajets_instances (id)`,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (trajetsErr) {
    return NextResponse.json({ error: trajetsErr.message }, { status: 500 });
  }

  type TrajetRaw = {
    id: string;
    depart_adresse: string;
    places_total: number;
    conducteur: { id: string; prenom: string; nom: string } | null;
    trajets_instances: Array<{ id: string }>;
  };

  const trajets = (trajetsRaw ?? []) as unknown as TrajetRaw[];

  if (trajets.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const allInstanceIds = trajets.flatMap((t) =>
    t.trajets_instances.map((i) => i.id),
  );

  type ResaRow = { trajet_instance_id: string; statut: string };
  let allResas: ResaRow[] = [];

  if (allInstanceIds.length > 0) {
    const { data: resasRaw } = await supabase
      .from("reservations")
      .select("trajet_instance_id, statut")
      .in("trajet_instance_id", allInstanceIds);
    allResas = (resasRaw ?? []) as ResaRow[];
  }

  const resasByInstance = new Map<string, ResaRow[]>();
  for (const r of allResas) {
    const list = resasByInstance.get(r.trajet_instance_id) ?? [];
    list.push(r);
    resasByInstance.set(r.trajet_instance_id, list);
  }

  const rows: TrajetStatRow[] = trajets
    .map((t) => {
      const instanceIds = t.trajets_instances.map((i) => i.id);
      const resas = instanceIds.flatMap(
        (id) => resasByInstance.get(id) ?? [],
      );
      const accepted = resas.filter((r) => r.statut === "accepted").length;
      const refused = resas.filter((r) => r.statut === "refused").length;

      return {
        trajet_id: t.id,
        depart_adresse: t.depart_adresse,
        conducteur_prenom: t.conducteur?.prenom ?? "",
        conducteur_nom: t.conducteur?.nom ?? "",
        places_total: t.places_total,
        instances_count: t.trajets_instances.length,
        demandes_total: resas.length,
        taux_acceptation: computeAcceptanceRate(accepted, refused),
      };
    })
    .sort((a, b) => {
      if (b.instances_count !== a.instances_count)
        return b.instances_count - a.instances_count;
      return b.demandes_total - a.demandes_total;
    });

  return NextResponse.json({ data: rows });
}

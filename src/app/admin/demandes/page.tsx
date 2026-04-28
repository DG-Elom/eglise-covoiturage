import { createClient } from "@/lib/supabase/server";
import { DemandesTable } from "./demandes-table";
import type { DemandeRow } from "./demandes-table";

export default async function AdminDemandesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("demandes_passager")
    .select(
      `id, date, sens, pickup_adresse, notes, statut, created_at,
      passager:profiles!demandes_passager_passager_id_fkey (id, prenom, nom, photo_url),
      culte:cultes (libelle, heure),
      matched_trajet_id`,
    )
    .order("created_at", { ascending: false });

  const demandes = (data ?? []) as unknown as DemandeRow[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Demandes passagers</h1>
      <DemandesTable demandes={demandes} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { SignalementsSection } from "../signalements-section";
import type { SignalementRow } from "../signalements-section";

export default async function AdminSignalementsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("signalements")
    .select(
      `id, motif, description, statut, created_at, ia_gravite, ia_action_suggeree,
      auteur:profiles!signalements_auteur_id_fkey (id, prenom, nom, photo_url),
      cible:profiles!signalements_cible_id_fkey (id, prenom, nom, suspended, photo_url)`,
    )
    .order("created_at", { ascending: false });

  const signalements = (data ?? []) as unknown as SignalementRow[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Signalements</h1>
      <SignalementsSection signalements={signalements} />
    </div>
  );
}

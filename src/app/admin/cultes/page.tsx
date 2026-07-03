import { createClient } from "@/lib/supabase/server";
import { ProgrammesSection } from "../programmes-section";

export default async function AdminCultesPage() {
  const supabase = await createClient();
  const { data: cultes } = await supabase
    .from("cultes")
    .select(
      "id, libelle, jour_semaine, jours_semaine, date_debut, date_fin, heure, actif, destination_adresse, destination_position",
    )
    .order("heure");
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Programmes</h1>
      <ProgrammesSection programmes={cultes ?? []} />
    </div>
  );
}

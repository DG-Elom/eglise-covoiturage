import { createClient } from "@/lib/supabase/server";
import { ProgrammesSection } from "../programmes-section";

export default async function AdminCultesPage() {
  const supabase = await createClient();
  const { data: cultes } = await supabase
    .from("cultes")
    .select("id, libelle, jour_semaine, heure, actif")
    .order("jour_semaine");
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Cultes / Programmes</h1>
      <ProgrammesSection programmes={cultes ?? []} />
    </div>
  );
}

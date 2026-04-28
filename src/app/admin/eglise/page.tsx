import { createClient } from "@/lib/supabase/server";
import { EgliseForm } from "./eglise-form";

export default async function AdminEglisePage() {
  const supabase = await createClient();
  const { data: eglise } = await supabase
    .from("eglise")
    .select("id, nom, adresse")
    .maybeSingle();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Église</h1>
      {eglise ? (
        <EgliseForm egliseId={eglise.id} initialNom={eglise.nom} initialAdresse={eglise.adresse} />
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Aucune entrée église trouvée en base.
        </p>
      )}
    </div>
  );
}

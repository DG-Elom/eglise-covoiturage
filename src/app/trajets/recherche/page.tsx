import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RechercheForm } from "./form";

export default async function RecherchePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const { data: cultes } = await supabase
    .from("cultes")
    .select("id, libelle, jour_semaine, heure")
    .eq("actif", true)
    .order("jour_semaine");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Trouver un trajet</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Saisis ton adresse et le culte concerné. On te montre les conducteurs
          qui passent près de chez toi.
        </p>
      </div>
      <RechercheForm passagerId={profile.id} cultes={cultes ?? []} />
    </main>
  );
}

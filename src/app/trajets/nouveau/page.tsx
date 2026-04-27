import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NouveauTrajetForm } from "./form";

export default async function NouveauTrajetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");
  if (profile.role === "passager") {
    redirect("/dashboard?error=role");
  }

  const { data: cultes } = await supabase
    .from("cultes")
    .select("id, libelle, jour_semaine, heure")
    .eq("actif", true)
    .order("jour_semaine");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Proposer un trajet</h1>
        <p className="mt-1 text-sm text-slate-600">
          Déclare ton point de départ et le culte concerné. Tu pourras récupérer
          les passagers proches de ton chemin.
        </p>
      </div>
      <NouveauTrajetForm conducteurId={profile.id} cultes={cultes ?? []} />
    </main>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { NouveauTrajetForm } from "./form";

export default async function NouveauTrajetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom, photo_url, is_admin")
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

  // Position de l'église (ICC Metz). Source : table eglise. Fallback hardcodé.
  const eglisePos = { lat: 49.146943, lng: 6.175955 };

  return (
    <>
      <AppHeader
        title="Proposer un trajet"
        back={{ href: "/dashboard" }}
        user={{
          prenom: profile.prenom,
          nom: profile.nom,
          email: user.email,
          photoUrl: profile.photo_url,
        }}
        isAdmin={!!profile.is_admin}
      />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
          Déclare ton point de départ et le culte concerné. Tu pourras récupérer
          les passagers proches de ton chemin.
        </p>
        <NouveauTrajetForm
          conducteurId={profile.id}
          cultes={cultes ?? []}
          eglisePos={eglisePos}
        />
      </main>
    </>
  );
}

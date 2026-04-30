import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { ProfilForm } from "./form";

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, prenom, nom, telephone, role, voiture_modele, voiture_couleur, voiture_plaque, voiture_photo_url, photo_url, is_admin",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  return (
    <>
      <AppHeader
        title="Mon profil"
        back={{ href: "/dashboard" }}
        user={{
          prenom: profile.prenom,
          nom: profile.nom,
          email: user.email,
          photoUrl: profile.photo_url,
        }}
        isAdmin={!!profile.is_admin}
      />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Mets à jour tes informations.
        </p>
        <div className="mt-6">
          <ProfilForm profile={profile} email={user.email ?? ""} />
        </div>
      </main>
    </>
  );
}

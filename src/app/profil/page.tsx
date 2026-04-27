import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
      "id, prenom, nom, telephone, role, voiture_modele, voiture_couleur, voiture_plaque, photo_url",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition dark:hover:text-slate-100"
      >
        <ArrowLeft className="size-3" /> Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Mon profil</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Mets à jour tes informations.
      </p>
      <div className="mt-6">
        <ProfilForm profile={profile} email={user.email ?? ""} />
      </div>
    </main>
  );
}

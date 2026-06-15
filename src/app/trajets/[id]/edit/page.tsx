import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { EditTrajetForm } from "./form";

export default async function EditTrajetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: trajet } = await supabase
    .from("trajets")
    .select(
      "id, depart_adresse, sens, places_total, rayon_detour_km, heure_depart, culte_id, conducteur_id, actif, cultes(libelle, jour_semaine, jours_semaine, date_debut, date_fin, heure)",
    )
    .eq("id", id)
    .maybeSingle();

  if (
    !trajet ||
    trajet.conducteur_id !== user.id ||
    trajet.actif === false ||
    !trajet.cultes
  ) {
    redirect("/dashboard");
  }

  const { data: instances } = await supabase
    .from("trajets_instances")
    .select("id, date")
    .eq("trajet_id", trajet.id)
    .eq("annule_par_conducteur", false);

  const instanceIds = (instances ?? []).map((i) => i.id);
  const { data: reservations } = instanceIds.length
    ? await supabase
        .from("reservations")
        .select("id, trajet_instance_id, statut, passager_id")
        .in("trajet_instance_id", instanceIds)
        .in("statut", ["pending", "accepted"])
    : { data: [] as never[] };

  const culte = Array.isArray(trajet.cultes) ? trajet.cultes[0] : trajet.cultes;

  return (
    <>
      <AppHeader
        title="Modifier le trajet"
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
          Mets à jour les informations de ton trajet. Les passagers concernés
          seront prévenus si tu retires des dates.
        </p>
        <EditTrajetForm
          trajet={{
            id: trajet.id,
            depart_adresse: trajet.depart_adresse,
            sens: trajet.sens,
            places_total: trajet.places_total,
            rayon_detour_km: trajet.rayon_detour_km,
            heure_depart: trajet.heure_depart,
            culte_id: trajet.culte_id,
          }}
          culte={{
            libelle: culte.libelle,
            jour_semaine: culte.jour_semaine ?? null,
            jours_semaine: (culte as unknown as { jours_semaine?: number[] }).jours_semaine ?? [],
            date_debut: (culte as unknown as { date_debut?: string | null }).date_debut ?? null,
            date_fin: (culte as unknown as { date_fin?: string | null }).date_fin ?? null,
            heure: culte.heure,
          }}
          instances={instances ?? []}
          reservations={reservations ?? []}
          eglisePos={{ lat: 49.146943, lng: 6.175955 }}
        />
      </main>
    </>
  );
}

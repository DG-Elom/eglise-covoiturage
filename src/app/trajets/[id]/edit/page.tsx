import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  const { data: trajet } = await supabase
    .from("trajets")
    .select(
      "id, depart_adresse, sens, places_total, rayon_detour_km, heure_depart, culte_id, conducteur_id, actif, cultes(libelle, jour_semaine, heure)",
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

  const { data: cultes } = await supabase
    .from("cultes")
    .select("id, libelle, jour_semaine, heure")
    .eq("actif", true)
    .order("jour_semaine");

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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Modifier le trajet
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Mets à jour les informations de ton trajet. Les passagers concernés
          seront prévenus si tu retires des dates.
        </p>
      </div>
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
          jour_semaine: culte.jour_semaine,
          heure: culte.heure,
        }}
        instances={instances ?? []}
        reservations={reservations ?? []}
      />
    </main>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import {
  CalendrierView,
  type CalendrierConducteurTrajet,
  type CalendrierPassagerReservation,
} from "./calendrier-view";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function CalendrierPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, nom, role, photo_url, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const windowEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0);
  const startStr = ymd(windowStart);
  const endStr = ymd(windowEnd);

  const peutConduire = profile.role === "conducteur" || profile.role === "les_deux";
  const peutVoyager = profile.role === "passager" || profile.role === "les_deux";

  let mesTrajets: CalendrierConducteurTrajet[] = [];
  if (peutConduire) {
    const { data } = await supabase
      .from("trajets")
      .select(
        `
        id, depart_adresse, heure_depart, sens,
        cultes (libelle, heure),
        trajets_instances (
          id, date, annule_par_conducteur,
          reservations ( id, statut )
        )
      `,
      )
      .eq("conducteur_id", user.id)
      .eq("actif", true)
      .gte("trajets_instances.date", startStr)
      .lte("trajets_instances.date", endStr);
    mesTrajets = (data ?? []) as unknown as CalendrierConducteurTrajet[];
  }

  let mesReservations: CalendrierPassagerReservation[] = [];
  if (peutVoyager) {
    const { data } = await supabase
      .from("reservations")
      .select(
        `
        id, statut, sens, pickup_adresse,
        trajets_instances!inner (
          id, date,
          trajets (
            depart_adresse, heure_depart,
            cultes (libelle, heure),
            conducteur:profiles!trajets_conducteur_id_fkey ( prenom )
          )
        )
      `,
      )
      .eq("passager_id", user.id)
      .gte("trajets_instances.date", startStr)
      .lte("trajets_instances.date", endStr);
    mesReservations = (data ?? []) as unknown as CalendrierPassagerReservation[];
  }

  return (
    <>
      <AppHeader
        title="Calendrier"
        back={{ href: "/dashboard" }}
        user={{
          prenom: profile.prenom,
          nom: profile.nom,
          email: user.email,
          photoUrl: profile.photo_url,
        }}
        isAdmin={!!profile.is_admin}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
          Vue mensuelle de tes trajets et réservations.
        </p>
        <CalendrierView
          trajets={mesTrajets}
          reservations={mesReservations}
          initialYear={now.getFullYear()}
          initialMonth={now.getMonth()}
        />
      </main>
    </>
  );
}

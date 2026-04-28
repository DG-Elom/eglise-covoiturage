import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { RechercheForm } from "./form";
import { TrajetsDisponibles, type TrajetDisponible } from "./trajets-disponibles";
import { deduplicateRecentAddresses } from "./recent-addresses";

export type ConducteurRating = { avg: number | null; count: number };

export default async function RecherchePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, prenom, nom, photo_url, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const { data: cultes } = await supabase
    .from("cultes")
    .select("id, libelle, jour_semaine, heure")
    .eq("actif", true)
    .order("jour_semaine");

  const today = new Date().toISOString().slice(0, 10);
  const { data: instancesRaw } = await supabase
    .from("trajets_instances")
    .select(
      `id, date,
       trajet:trajets!inner (
         id, depart_adresse, sens, places_total, heure_depart,
         conducteur:profiles!trajets_conducteur_id_fkey (id, prenom, nom, photo_url),
         culte:cultes!inner (libelle, heure)
       )`,
    )
    .eq("annule_par_conducteur", false)
    .gte("date", today)
    .order("date");

  const instances = (instancesRaw ?? []) as unknown as TrajetDisponible[];

  const { data: pastReservations } = await supabase
    .from("reservations")
    .select("pickup_adresse")
    .eq("passager_id", profile.id)
    .order("demande_le", { ascending: false })
    .limit(20);

  const recentAddresses = deduplicateRecentAddresses(
    (pastReservations ?? []) as { pickup_adresse: string }[],
  );

  const { data: ratingsData } = await supabase
    .from("trip_ratings")
    .select("rated_id, stars");

  const conducteurRatings: Record<string, ConducteurRating> = {};
  if (ratingsData && ratingsData.length > 0) {
    const grouped: Record<string, number[]> = {};
    for (const row of ratingsData) {
      const arr = grouped[row.rated_id] ?? [];
      arr.push(row.stars);
      grouped[row.rated_id] = arr;
    }
    for (const [userId, stars] of Object.entries(grouped)) {
      const avg = stars.reduce((a, b) => a + b, 0) / stars.length;
      conducteurRatings[userId] = { avg, count: stars.length };
    }
  }

  return (
    <>
      <AppHeader
        title="Trouver un trajet"
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
          Saisis ton adresse et le culte concerné, ou parcours simplement les trajets
          déjà proposés ci-dessous.
        </p>
        <RechercheForm
          passagerId={profile.id}
          cultes={cultes ?? []}
          conducteurRatings={conducteurRatings}
          recentAddresses={recentAddresses}
        />
        <TrajetsDisponibles instances={instances} conducteurRatings={conducteurRatings} />
      </main>
    </>
  );
}

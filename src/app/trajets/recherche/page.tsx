import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { RechercheForm } from "./form";
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

  const { count: trajetsDisponiblesCount } = await supabase
    .from("trajets_instances")
    .select("id", { count: "exact", head: true })
    .eq("annule_par_conducteur", false)
    .gte("date", today);

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
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
          <Search className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <div className="text-sm">
            <p className="font-medium text-emerald-900 dark:text-emerald-100">
              {trajetsDisponiblesCount ?? 0} trajet
              {(trajetsDisponiblesCount ?? 0) > 1 ? "s" : ""} proposé
              {(trajetsDisponiblesCount ?? 0) > 1 ? "s" : ""} à venir
            </p>
            <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-200/80">
              Saisis ton adresse et le culte concerné pour voir uniquement les
              conducteurs qui passent près de chez toi.
            </p>
          </div>
        </div>
        <RechercheForm
          passagerId={profile.id}
          cultes={cultes ?? []}
          conducteurRatings={conducteurRatings}
          recentAddresses={recentAddresses}
        />
      </main>
    </>
  );
}

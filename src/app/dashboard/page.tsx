import Link from "next/link";
import { redirect } from "next/navigation";
import { Car, Search, Plus, AlertCircle, Megaphone, Hand } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { DashboardSoundListener } from "@/components/dashboard-sound-listener";
import { OnlineToggle } from "@/components/online-toggle";
import { ActionCard } from "./action-card";
import { ConducteurSection, type ConducteurTrajet, type RatingInfo } from "./conducteur-section";
import { PassagerSection, type PassagerReservation } from "./passager-section";
import {
  MesDemandesSection,
  type DemandePassagerRow,
} from "./mes-demandes-section";
import {
  DemandesProchesSection,
  type DemandeProcheRow,
} from "./demandes-proches-section";
import { TopConducteurs } from "@/components/top-conducteurs";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "prenom, nom, role, is_admin, photo_url, available_now, available_until, emergency_contact_name, emergency_contact_phone",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const today = new Date().toISOString().slice(0, 10);
  const past14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const peutConduire = profile.role === "conducteur" || profile.role === "les_deux";
  const peutVoyager = profile.role === "passager" || profile.role === "les_deux";

  let mesTrajets: ConducteurTrajet[] = [];
  if (peutConduire) {
    const { data } = await supabase
      .from("trajets")
      .select(
        `
        id, depart_adresse, sens, places_total, rayon_detour_km, heure_depart,
        cultes (libelle, jour_semaine, heure),
        trajets_instances (
          id, date, annule_par_conducteur,
          reservations (
            id, statut, sens, pickup_adresse, demande_le,
            passager:profiles!reservations_passager_id_fkey (
              id, prenom, nom, telephone, photo_url
            )
          )
        )
      `,
      )
      .eq("conducteur_id", user.id)
      .eq("actif", true)
      .gte("trajets_instances.date", past14);
    mesTrajets = (data ?? []) as unknown as ConducteurTrajet[];
  }

  let alreadyRatedIdsAsConduct: string[] = [];
  const passagerRatings: Map<string, RatingInfo> = new Map();
  if (peutConduire) {
    const { data: myRatings } = await supabase
      .from("trip_ratings")
      .select("reservation_id")
      .eq("rater_id", user.id);
    alreadyRatedIdsAsConduct = (myRatings ?? []).map((r) => r.reservation_id);

    const { data: ratingsData } = await supabase
      .from("trip_ratings")
      .select("rated_id, stars");
    if (ratingsData && ratingsData.length > 0) {
      const grouped = new Map<string, number[]>();
      for (const row of ratingsData) {
        const arr = grouped.get(row.rated_id) ?? [];
        arr.push(row.stars);
        grouped.set(row.rated_id, arr);
      }
      for (const [userId, stars] of grouped.entries()) {
        const avg = stars.reduce((a, b) => a + b, 0) / stars.length;
        passagerRatings.set(userId, { avg, count: stars.length });
      }
    }
  }

  const [{ count: nbConducteurs }, { count: nbPassagers }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["conducteur", "les_deux"]),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["passager", "les_deux"]),
  ]);
  const ratioBas =
    (nbPassagers ?? 0) >= 3 &&
    (nbConducteurs ?? 0) > 0 &&
    (nbPassagers ?? 0) >= (nbConducteurs ?? 0) * 2;

  let mesDemandes: DemandePassagerRow[] = [];
  if (peutVoyager) {
    const { data } = await supabase
      .from("demandes_passager")
      .select(
        `id, date, sens, pickup_adresse, statut, created_at,
         culte:cultes (libelle, heure)`,
      )
      .eq("passager_id", user.id)
      .gte("date", today)
      .order("date", { ascending: true });
    mesDemandes = (data ?? []) as unknown as DemandePassagerRow[];
  }

  let demandesProches: DemandeProcheRow[] = [];
  if (peutConduire) {
    const { data } = await supabase
      .from("demandes_passager")
      .select(
        `id, date, sens, pickup_adresse, notes, created_at,
         passager:profiles!demandes_passager_passager_id_fkey (
           id, prenom, nom, telephone, photo_url
         ),
         culte:cultes (id, libelle, heure)`,
      )
      .eq("statut", "active")
      .gte("date", today)
      .neq("passager_id", user.id)
      .order("date", { ascending: true });
    demandesProches = (data ?? []) as unknown as DemandeProcheRow[];
  }

  let mesReservations: PassagerReservation[] = [];
  let alreadyRatedIds: string[] = [];
  if (peutVoyager) {
    const { data } = await supabase
      .from("reservations")
      .select(
        `
        id, statut, sens, pickup_adresse, demande_le,
        trajets_instances!inner (
          id,
          date,
          trajet_id,
          trajets (
            depart_adresse,
            heure_depart,
            cultes (libelle, heure),
            conducteur:profiles!trajets_conducteur_id_fkey (
              id, prenom, nom, telephone, voiture_modele, voiture_couleur, voiture_photo_url, photo_url
            )
          )
        )
      `,
      )
      .eq("passager_id", user.id)
      .gte("trajets_instances.date", today)
      .order("demande_le", { ascending: false });
    const rawReservations = (data ?? []) as unknown as PassagerReservation[];

    const { data: ratings } = await supabase
      .from("trip_ratings")
      .select("reservation_id")
      .eq("rater_id", user.id);
    alreadyRatedIds = (ratings ?? []).map((r) => r.reservation_id);

    // Fetch subscriptions actives pour enrichir chaque réservation eligible
    const eligibleTrajetIds = rawReservations
      .filter((r) => r.statut === "accepted" || r.statut === "completed")
      .map((r) => r.trajets_instances?.trajet_id)
      .filter((id): id is string => Boolean(id));

    const subsByTrajetSens: Map<string, string> = new Map();
    if (eligibleTrajetIds.length > 0) {
      const { data: subsData } = await supabase
        .from("subscriptions")
        .select("id, trajet_id, sens")
        .eq("passager_id", user.id)
        .eq("actif", true)
        .in("trajet_id", eligibleTrajetIds);

      for (const sub of subsData ?? []) {
        subsByTrajetSens.set(`${sub.trajet_id}:${sub.sens}`, sub.id);
      }
    }

    mesReservations = rawReservations.map((r) => {
      const trajetId = r.trajets_instances?.trajet_id;
      if (!trajetId || (r.statut !== "accepted" && r.statut !== "completed")) {
        return r;
      }
      const subId = subsByTrajetSens.get(`${trajetId}:${r.sens}`);
      return { ...r, subscription: subId ? { id: subId } : null };
    });
  }

  return (
    <>
      <AppHeader
        user={{
          prenom: profile.prenom,
          email: user.email,
          photoUrl: profile.photo_url,
        }}
        isAdmin={!!profile.is_admin}
      />
      <DashboardSoundListener userId={user.id} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Bonjour {profile.prenom} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Bienvenue sur ton espace de covoiturage.
          </p>
        </div>

        <div className="mt-4">
          <TopConducteurs />
        </div>

        {ratioBas && peutConduire && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/30">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Manque de conducteurs
              </p>
              <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/90">
                {nbPassagers} fidèles cherchent un trajet pour seulement {nbConducteurs}{" "}
                conducteur{(nbConducteurs ?? 0) > 1 ? "s" : ""}. Propose tes trajets pour
                aider la famille 🙏
              </p>
            </div>
          </div>
        )}

        {ratioBas && !peutConduire && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-slate-500" />
            <div className="text-sm">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                Tu as une voiture ?
              </p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                Beaucoup de fidèles cherchent un trajet. Tu peux passer en mode
                « conducteur » dans <Link href="/profil" className="underline">ton profil</Link>.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {peutConduire && (
          <ActionCard
            href="/trajets/nouveau"
            icon={<Plus className="size-5" />}
            title="Proposer un trajet"
            tone="emerald"
          />
        )}
        {peutVoyager && (
          <ActionCard
            href="/trajets/recherche"
            icon={<Search className="size-5" />}
            title="Trouver un trajet"
            tone="slate"
          />
        )}
      </div>

      {peutConduire && (
        <div className="mt-4">
          <OnlineToggle
            initialAvailable={!!profile.available_now}
            initialUntil={profile.available_until}
          />
        </div>
      )}

      {peutConduire && demandesProches.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Hand className="size-5 text-amber-600 dark:text-amber-400" />
            Fidèles qui cherchent un trajet
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {demandesProches.length}
            </span>
          </h2>
          <DemandesProchesSection demandes={demandesProches} />
        </section>
      )}

      {peutConduire && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Car className="size-5 text-emerald-600 dark:text-emerald-400" />
            Mes trajets proposés
          </h2>
          <ConducteurSection
            trajets={mesTrajets}
            alreadyRatedIds={alreadyRatedIdsAsConduct}
            passagerRatings={passagerRatings}
          />
        </section>
      )}

      {peutVoyager && mesDemandes.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="size-5 text-emerald-600 dark:text-emerald-400" />
            Mes demandes publiées
          </h2>
          <MesDemandesSection demandes={mesDemandes} />
        </section>
      )}

      {peutVoyager && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Search className="size-5 text-emerald-600 dark:text-emerald-400" />
            Mes demandes de trajet
          </h2>
          <PassagerSection
            reservations={mesReservations}
            alreadyRatedIds={alreadyRatedIds}
            emergencyName={profile.emergency_contact_name}
            emergencyPhone={profile.emergency_contact_phone}
            myPrenom={profile.prenom}
            myNom={profile.nom ?? ""}
            myPhotoUrl={profile.photo_url}
          />
        </section>
      )}
      </main>
    </>
  );
}


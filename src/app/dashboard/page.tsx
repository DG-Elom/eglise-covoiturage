import Link from "next/link";
import { redirect } from "next/navigation";
import { Car, Search, Plus, ShieldCheck, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { ConducteurSection, type ConducteurTrajet } from "./conducteur-section";
import { PassagerSection, type PassagerReservation } from "./passager-section";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, role, is_admin, photo_url")
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

  let mesReservations: PassagerReservation[] = [];
  if (peutVoyager) {
    const { data } = await supabase
      .from("reservations")
      .select(
        `
        id, statut, sens, pickup_adresse, demande_le,
        trajets_instances!inner (
          date,
          trajets (
            depart_adresse,
            heure_depart,
            cultes (libelle, heure),
            conducteur:profiles!trajets_conducteur_id_fkey (
              id, prenom, nom, telephone, voiture_modele, voiture_couleur, photo_url
            )
          )
        )
      `,
      )
      .eq("passager_id", user.id)
      .gte("trajets_instances.date", today)
      .order("demande_le", { ascending: false });
    mesReservations = (data ?? []) as unknown as PassagerReservation[];
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar
            photoUrl={profile.photo_url}
            prenom={profile.prenom}
            nom=""
            size="md"
          />
          <div>
            <h1 className="text-2xl font-semibold">Bonjour {profile.prenom} 👋</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile.is_admin && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-100 transition dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
            >
              <ShieldCheck className="size-3.5" />
              Admin
            </Link>
          )}
          <Link
            href="/profil"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <User className="size-3.5" />
            Profil
          </Link>
          <LogoutButton />
          <ThemeToggle />
        </div>
      </header>

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
        <section className="mt-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Car className="size-5 text-emerald-600 dark:text-emerald-400" />
            Mes trajets proposés
          </h2>
          <ConducteurSection trajets={mesTrajets} />
        </section>
      )}

      {peutVoyager && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Search className="size-5 text-emerald-600 dark:text-emerald-400" />
            Mes demandes de trajet
          </h2>
          <PassagerSection reservations={mesReservations} />
        </section>
      )}
    </main>
  );
}

function ActionCard({
  href,
  icon,
  title,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  tone: "emerald" | "slate";
}) {
  const styles =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:border-emerald-600"
      : "border-slate-200 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500";
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${styles}`}
    >
      <div className="inline-flex size-9 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-800">
        {icon}
      </div>
      <span className="font-medium">{title}</span>
    </Link>
  );
}

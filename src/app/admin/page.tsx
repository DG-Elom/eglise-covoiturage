import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProgrammesSection } from "./programmes-section";
import { SignalementsSection, type SignalementRow } from "./signalements-section";
import { StatsSection } from "./stats-section";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, prenom")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");
  if (!profile.is_admin) redirect("/dashboard");

  const [{ data: cultes }, { data: signalements }, stats] = await Promise.all([
    supabase
      .from("cultes")
      .select("id, libelle, jour_semaine, heure, actif")
      .order("jour_semaine"),
    supabase
      .from("signalements")
      .select(
        `
        id, motif, description, statut, created_at, ia_gravite, ia_action_suggeree,
        auteur:profiles!signalements_auteur_id_fkey (id, prenom, nom, photo_url),
        cible:profiles!signalements_cible_id_fkey (id, prenom, nom, suspended, photo_url)
      `,
      )
      .order("created_at", { ascending: false }),
    loadStats(supabase),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-8">
      <header className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="size-3" /> Dashboard
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="size-6 text-emerald-600" />
          Administration
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Gestion des programmes, modération et statistiques.
        </p>
      </header>

      <div className="space-y-10">
        <StatsSection stats={stats} />
        <ProgrammesSection programmes={cultes ?? []} />
        <SignalementsSection
          signalements={(signalements ?? []) as unknown as SignalementRow[]}
        />
      </div>
    </main>
  );
}

async function loadStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date().toISOString().slice(0, 10);
  const [users, conducteurs, trajets, instances, reservationsPending] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("role", ["conducteur", "les_deux"]),
    supabase.from("trajets").select("*", { count: "exact", head: true }).eq("actif", true),
    supabase
      .from("trajets_instances")
      .select("*", { count: "exact", head: true })
      .gte("date", today)
      .eq("annule_par_conducteur", false),
    supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("statut", "pending"),
  ]);

  return {
    users: users.count ?? 0,
    conducteurs: conducteurs.count ?? 0,
    trajetsActifs: trajets.count ?? 0,
    prochainesDates: instances.count ?? 0,
    demandesEnAttente: reservationsPending.count ?? 0,
  };
}

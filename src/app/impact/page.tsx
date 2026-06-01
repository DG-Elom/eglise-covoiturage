import { redirect } from "next/navigation";
import { Leaf, Users, Route as RouteIcon, Car, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { formatImpactShareText, KM_MOYEN_PAR_TRAJET } from "@/lib/impact";
import { fetchCurrentMonthImpact } from "@/lib/impact-server";
import { ShareImpactButton } from "./share-impact-button";

export const runtime = "nodejs";

function moisCourantLabel(): string {
  return new Date().toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

const nf = new Intl.NumberFormat("fr-FR");

export default async function ImpactPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, photo_url, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const { stats } = await fetchCurrentMonthImpact();
  const shareText = formatImpactShareText(stats);

  const metrics = [
    {
      icon: <Car className="size-5" />,
      value: nf.format(stats.trajetsEffectues),
      label: stats.trajetsEffectues > 1 ? "trajets partagés" : "trajet partagé",
    },
    {
      icon: <Users className="size-5" />,
      value: nf.format(stats.passagersTransportes),
      label: stats.passagersTransportes > 1 ? "personnes transportées" : "personne transportée",
    },
    {
      icon: <RouteIcon className="size-5" />,
      value: `${nf.format(Math.round(stats.kmCumules))} km`,
      label: "parcourus ensemble",
    },
    {
      icon: <Leaf className="size-5" />,
      value: `${nf.format(Math.round(stats.co2EconomiseKg))} kg`,
      label: "de CO2 évités",
    },
  ];

  return (
    <>
      <AppHeader
        title="Notre impact"
        back={{ href: "/dashboard", label: "Retour" }}
        user={{
          prenom: profile.prenom,
          email: user.email,
          photoUrl: profile.photo_url,
        }}
        isAdmin={!!profile.is_admin}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Notre impact, ensemble 🌱
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Ce que la famille ICC Metz a accompli en covoiturant ce mois-ci.
          </p>
        </div>

        {/* Carte d'impact partageable */}
        <section
          aria-label="Carte d'impact du mois"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-6 text-white shadow-xl sm:p-8"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 size-44 rounded-full bg-teal-300/20 blur-2xl" />

          <div className="relative">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-50">
              <Sparkles className="size-4" />
              <span className="capitalize">{moisCourantLabel()}</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:gap-6">
              {metrics.map((m) => (
                <div key={m.label} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-emerald-50/90">
                    {m.icon}
                  </div>
                  <span className="text-3xl font-bold tracking-tight sm:text-4xl">
                    {m.value}
                  </span>
                  <span className="text-sm text-emerald-50/90">{m.label}</span>
                </div>
              ))}
            </div>

            {stats.trajetsEffectues === 0 && (
              <p className="mt-6 text-sm text-emerald-50/90">
                Aucun trajet ce mois pour l&apos;instant. Proposez ou réservez un
                trajet pour faire grandir notre impact 🙏
              </p>
            )}

            <p className="mt-7 text-base font-medium text-white/95">
              {shareText}
            </p>

            <div className="mt-6">
              <ShareImpactButton text={shareText} />
            </div>
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Estimations basées sur {nf.format(KM_MOYEN_PAR_TRAJET)} km en moyenne par
          trajet. Chaque place partagée, c&apos;est moins de voitures sur la route.
        </p>
      </main>
    </>
  );
}

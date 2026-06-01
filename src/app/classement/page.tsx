import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { computeTopScore, type RawStats } from "@/lib/top-score";
import { buildClassement, MEDALS, type ClassementEntry } from "@/lib/classement";
import type { TopConducteur } from "@/app/api/top-conducteurs/route";

export const metadata = {
  title: "Classement des covoitureurs",
};

export default async function ClassementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, nom, photo_url, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const { data: statsRows } = await supabase
    .from("user_top_score")
    .select(
      "user_id, trajets_proposes, demandes_recues, demandes_acceptees, passagers_transportes, km_detour_consenti, median_minutes_reponse, taux_acceptation",
    );

  const raw: RawStats[] = (statsRows ?? []).map((r) => ({
    user_id: r.user_id,
    trajets_proposes: Number(r.trajets_proposes ?? 0),
    demandes_recues: Number(r.demandes_recues ?? 0),
    demandes_acceptees: Number(r.demandes_acceptees ?? 0),
    passagers_transportes: Number(r.passagers_transportes ?? 0),
    km_detour_consenti: Number(r.km_detour_consenti ?? 0),
    median_minutes_reponse:
      r.median_minutes_reponse !== null && r.median_minutes_reponse !== undefined
        ? Number(r.median_minutes_reponse)
        : null,
    taux_acceptation:
      r.taux_acceptation !== null && r.taux_acceptation !== undefined
        ? Number(r.taux_acceptation)
        : null,
  }));

  const scored = computeTopScore(raw);

  let entries: ClassementEntry[] = [];
  if (scored.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, prenom, nom, photo_url")
      .in(
        "id",
        scored.map((r) => r.user_id),
      );

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const conducteurs: TopConducteur[] = scored
      .map((row): TopConducteur | null => {
        const p = profileMap.get(row.user_id);
        if (!p) return null;
        return {
          id: row.user_id,
          prenom: p.prenom,
          nom: p.nom,
          photoUrl: p.photo_url,
          passagersTransportes: row.passagers_transportes,
          kmDetourConsenti: row.km_detour_consenti,
          trajetsProposes: row.trajets_proposes,
        };
      })
      .filter((c): c is TopConducteur => c !== null);

    entries = buildClassement(conducteurs);
  }

  const podium = entries.slice(0, 3);
  const reste = entries.slice(3);

  return (
    <>
      <AppHeader
        title="Classement"
        back={{ href: "/dashboard", label: "Tableau de bord" }}
        user={{
          prenom: profile.prenom,
          email: user.email,
          photoUrl: profile.photo_url,
        }}
        isAdmin={!!profile.is_admin}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <Trophy className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Covoitureurs du mois
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Merci à celles et ceux qui prennent la route pour la famille. Le
              classement se remet à zéro chaque mois.
            </p>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pas encore de covoitureur classé ce mois-ci.
              <br />
              Propose un trajet et transporte un fidèle pour ouvrir le bal 🙌
            </p>
          </div>
        ) : (
          <>
            <Podium entries={podium} />
            {reste.length > 0 && (
              <ol className="mt-8 space-y-2">
                {reste.map((entry) => (
                  <RangLigne key={entry.id} entry={entry} />
                ))}
              </ol>
            )}
          </>
        )}
      </main>
    </>
  );
}

function Podium({ entries }: { entries: ClassementEntry[] }) {
  // Ordre visuel : 2 - 1 - 3 (le 1er au centre, plus haut).
  const order = [entries[1], entries[0], entries[2]].filter(
    (e): e is ClassementEntry => Boolean(e),
  );

  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
      {order.map((entry) => {
        const isFirst = entry.rang === 1;
        return (
          <Link
            key={entry.id}
            href={`/u/${entry.id}`}
            className={`group flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition hover:shadow-md sm:p-4 ${
              isFirst
                ? "order-2 border-amber-300 bg-amber-50/60 pb-6 dark:border-amber-700/60 dark:bg-amber-950/20"
                : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            }`}
          >
            <span
              className="text-2xl leading-none sm:text-3xl"
              aria-label={`${entry.rang}e place`}
            >
              {MEDALS[entry.rang]}
            </span>
            <Avatar
              photoUrl={entry.photoUrl}
              prenom={entry.prenom}
              nom={entry.nom}
              size={isFirst ? "lg" : "md"}
              className="ring-2 ring-emerald-300 dark:ring-emerald-700"
            />
            <p className="line-clamp-1 text-sm font-semibold text-slate-900 group-hover:underline dark:text-slate-100">
              {entry.prenom}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              <span aria-hidden="true">{entry.highlight.icon} </span>
              {entry.highlight.label}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

function RangLigne({ entry }: { entry: ClassementEntry }) {
  return (
    <li>
      <Link
        href={`/u/${entry.id}`}
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums text-slate-400 dark:text-slate-500">
          {entry.rang}
        </span>
        <Avatar
          photoUrl={entry.photoUrl}
          prenom={entry.prenom}
          nom={entry.nom}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {entry.prenom} {entry.nom}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            <span aria-hidden="true">{entry.highlight.icon} </span>
            {entry.highlight.label}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
          {entry.trajetsProposes} trajet{entry.trajetsProposes > 1 ? "s" : ""}
        </span>
      </Link>
    </li>
  );
}

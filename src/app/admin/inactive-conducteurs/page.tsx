import Link from "next/link";
import { Car, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";

type Conducteur = {
  id: string;
  prenom: string;
  nom: string;
  telephone: string | null;
  photo_url: string | null;
  charte_acceptee_at: string;
};

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function formatDays(d: number): string {
  if (d === 0) return "aujourd'hui";
  if (d === 1) return "depuis hier";
  if (d < 30) return `depuis ${d} j`;
  const months = Math.floor(d / 30);
  if (months < 12) return `depuis ${months} mois`;
  const years = Math.floor(months / 12);
  return `depuis ${years} an${years > 1 ? "s" : ""}`;
}

export default async function InactiveConducteursPage() {
  const supabase = await createClient();

  const { data: conducteursRaw } = await supabase
    .from("profiles")
    .select("id, prenom, nom, telephone, photo_url, charte_acceptee_at")
    .in("role", ["conducteur", "les_deux"])
    .eq("suspended", false)
    .not("charte_acceptee_at", "is", null);

  const candidats = (conducteursRaw ?? []) as Conducteur[];
  const ids = candidats.map((p) => p.id);

  const actifsIds = new Set<string>();
  if (ids.length > 0) {
    const { data: avecTrajet } = await supabase
      .from("trajets")
      .select("conducteur_id")
      .eq("actif", true)
      .in("conducteur_id", ids);
    for (const t of (avecTrajet ?? []) as Array<{ conducteur_id: string }>) {
      actifsIds.add(t.conducteur_id);
    }
  }

  const inactifs = candidats
    .filter((p) => !actifsIds.has(p.id))
    .map((p) => ({ ...p, days: daysSince(p.charte_acceptee_at) }))
    .sort((a, b) => b.days - a.days);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Conducteurs sans trajet actif
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Membres inscrits comme conducteurs qui n&apos;ont publié aucun trajet
          actif. À relancer.
        </p>
      </div>

      {inactifs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
          <Car className="mx-auto mb-2 size-6 text-emerald-600 dark:text-emerald-400" />
          Tous les conducteurs ont au moins un trajet actif.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {inactifs.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <Avatar
                photoUrl={p.photo_url}
                prenom={p.prenom}
                nom={p.nom}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                  {p.prenom} {p.nom}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Inscrit {formatDays(p.days)} · aucun trajet actif
                </div>
              </div>
              <div className="flex items-center gap-2">
                {p.telephone && (
                  <a
                    href={`tel:${p.telephone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Phone className="size-3.5" />
                    Appeler
                  </a>
                )}
                <Link
                  href={`/admin/profiles?q=${encodeURIComponent(`${p.prenom} ${p.nom}`)}`}
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  Voir profil
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

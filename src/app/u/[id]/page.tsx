import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, prenom, nom, photo_url, role")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  const { data: thanks } = await supabase
    .from("thanks")
    .select(
      "id, message, created_at, auteur_id",
    )
    .eq("destinataire_id", id)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);

  const auteurIds = [...new Set((thanks ?? []).map((t) => t.auteur_id))];

  const auteurMap = new Map<string, { prenom: string; photo_url: string | null }>();
  if (auteurIds.length > 0) {
    const { data: auteurs } = await supabase
      .from("profiles")
      .select("id, prenom, photo_url")
      .in("id", auteurIds);

    for (const a of auteurs ?? []) {
      auteurMap.set(a.id, { prenom: a.prenom, photo_url: a.photo_url });
    }
  }

  const ROLE_LABEL: Record<string, string> = {
    conducteur: "Conducteur",
    passager: "Passager",
    les_deux: "Conducteur & passager",
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4">
      <div className="mx-auto max-w-lg">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-6 flex flex-col items-center gap-3">
          <Avatar
            photoUrl={profile.photo_url}
            prenom={profile.prenom}
            nom={profile.nom}
            size="lg"
          />
          <div className="text-center">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {profile.prenom} {profile.nom}
            </h1>
            {profile.role && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {ROLE_LABEL[profile.role] ?? profile.role}
              </p>
            )}
          </div>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Mots de remerciement
          </h2>

          {!thanks || thanks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500">
              Pas encore de mot de remerciement
            </p>
          ) : (
            <ul className="space-y-3">
              {thanks.map((t) => {
                const auteur = auteurMap.get(t.auteur_id);
                const distance = formatDistanceToNow(new Date(t.created_at), {
                  locale: fr,
                  addSuffix: true,
                });

                return (
                  <li
                    key={t.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar
                        photoUrl={auteur?.photo_url ?? null}
                        prenom={auteur?.prenom ?? "?"}
                        nom=""
                        size="sm"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {auteur?.prenom ?? "Anonyme"}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">{distance}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {t.message}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

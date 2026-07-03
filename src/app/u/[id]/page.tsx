import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Car,
  Phone,
  ShieldAlert,
  ShieldCheck,
  CalendarClock,
  Route,
  Ticket,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { Avatar } from "@/components/avatar";
import { ProfileLink } from "@/components/profile-link";

type Props = {
  params: Promise<{ id: string }>;
};

const ROLE_LABEL: Record<string, string> = {
  conducteur: "Conducteur",
  passager: "Passager",
  les_deux: "Conducteur & passager",
};

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { isAdmin } = await getViewer();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, prenom, nom, photo_url, role, bio")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  // Données réservées à l'admin : contact, modération, ancienneté, véhicule, activité.
  let adminData:
    | null
    | {
        telephone: string;
        created_at: string;
        suspended: boolean;
        suspended_reason: string | null;
        is_admin: boolean;
        voiture_modele: string | null;
        voiture_couleur: string | null;
        voiture_plaque: string | null;
        nbTrajets: number;
        nbReservations: number;
      } = null;

  if (isAdmin) {
    // RLS (migration_v12_admin_rls) : profiles, trajets ET reservations ont
    // chacun une policy is_admin() → l'admin lit ces données pour n'importe
    // quel membre, sous sa propre session (clé anon + RLS).
    const [{ data: full }, { count: nbTrajets }, { count: nbReservations }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "telephone, created_at, suspended, suspended_reason, is_admin, voiture_modele, voiture_couleur, voiture_plaque",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("trajets")
          .select("id", { count: "exact", head: true })
          .eq("conducteur_id", id),
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("passager_id", id),
      ]);

    if (full) {
      adminData = {
        telephone: full.telephone,
        created_at: full.created_at,
        suspended: full.suspended,
        suspended_reason: full.suspended_reason,
        is_admin: full.is_admin,
        voiture_modele: full.voiture_modele,
        voiture_couleur: full.voiture_couleur,
        voiture_plaque: full.voiture_plaque,
        nbTrajets: nbTrajets ?? 0,
        nbReservations: nbReservations ?? 0,
      };
    }
  }

  const { data: thanks } = await supabase
    .from("thanks")
    .select("id, message, created_at, auteur_id")
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

  const voiture = adminData
    ? [adminData.voiture_modele, adminData.voiture_couleur]
        .filter(Boolean)
        .join(" · ")
    : "";

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
            {profile.bio && (
              <p className="mt-2 max-w-xs text-sm text-slate-600 italic dark:text-slate-400">
                {profile.bio}
              </p>
            )}
          </div>
        </div>

        {adminData && (
          <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="size-3.5" />
                Vue admin
              </span>
              {adminData.is_admin && (
                <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  Administrateur
                </span>
              )}
            </div>

            {adminData.suspended && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  Compte suspendu
                  {adminData.suspended_reason ? ` — ${adminData.suspended_reason}` : ""}
                </span>
              </div>
            )}

            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Phone className="size-4 shrink-0 text-slate-400" />
                <a
                  href={`tel:${adminData.telephone}`}
                  className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {adminData.telephone}
                </a>
              </div>
              {voiture && (
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Car className="size-4 shrink-0 text-slate-400" />
                  <span>
                    {voiture}
                    {adminData.voiture_plaque ? ` (${adminData.voiture_plaque})` : ""}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CalendarClock className="size-4 shrink-0 text-slate-400" />
                <span>
                  Membre depuis{" "}
                  {formatDistanceToNow(new Date(adminData.created_at), {
                    locale: fr,
                    addSuffix: true,
                  })}
                </span>
              </div>
            </dl>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
                <Route className="mx-auto mb-1 size-4 text-emerald-600" />
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {adminData.nbTrajets}
                </p>
                <p className="text-[11px] text-slate-500">trajets proposés</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
                <Ticket className="mx-auto mb-1 size-4 text-emerald-600" />
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {adminData.nbReservations}
                </p>
                <p className="text-[11px] text-slate-500">réservations</p>
              </div>
            </div>

            <Link
              href="/admin/profiles"
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-slate-800"
            >
              <ShieldCheck className="size-4" />
              Gérer dans l&apos;administration
            </Link>
          </section>
        )}

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
                      <ProfileLink userId={t.auteur_id} enabled={isAdmin}>
                        <span className="flex items-center gap-2">
                          <Avatar
                            photoUrl={auteur?.photo_url ?? null}
                            prenom={auteur?.prenom ?? "?"}
                            nom=""
                            size="sm"
                          />
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {auteur?.prenom ?? "Anonyme"}
                          </span>
                        </span>
                      </ProfileLink>
                      <span className="text-xs text-slate-400">{distance}</span>
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

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import Link from "next/link";
import { CarteSociale } from "@/components/carte-sociale";

const ICC_METZ_LNG = 6.175955;
const ICC_METZ_LAT = 49.146943;

export default async function CartePage() {
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

  const { data: eglise } = await supabase
    .from("eglise")
    .select("position")
    .limit(1)
    .maybeSingle();

  let egliseLng = ICC_METZ_LNG;
  let egliseLat = ICC_METZ_LAT;

  if (eglise?.position) {
    const pos = eglise.position as unknown as Record<string, unknown>;
    if (pos.type === "Point" && Array.isArray(pos.coordinates)) {
      const [lng, lat] = pos.coordinates as number[];
      if (typeof lng === "number" && typeof lat === "number") {
        egliseLng = lng;
        egliseLat = lat;
      }
    }
  }

  return (
    <>
      <AppHeader
        title="Carte des conducteurs"
        back={{ href: "/trajets/recherche" }}
        user={{
          prenom: profile.prenom,
          nom: profile.nom,
          email: user.email,
          photoUrl: profile.photo_url,
        }}
        isAdmin={!!profile.is_admin}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/trajets/recherche"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Liste
          </Link>
          <span className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            Carte
          </span>
        </div>

        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Points de départ des conducteurs actifs. Les noms et informations personnelles ne sont pas affichés.
        </p>

        <CarteSociale egliseLng={egliseLng} egliseLat={egliseLat} />

        <p className="mt-3 text-xs text-slate-400 dark:text-slate-600">
          Les positions affichées sont approximatives (rayon ~100 m) pour protéger la vie privée des conducteurs.
        </p>
      </main>
    </>
  );
}

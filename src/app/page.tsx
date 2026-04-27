import Link from "next/link";
import { Car, MapPin, Users } from "lucide-react";
import { Logo } from "@/components/logo";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <Logo size="lg" className="mb-6" />
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Communauté locale
        </div>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Allez à l&apos;église <span className="text-emerald-600 dark:text-emerald-400">ensemble</span>.
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-600 sm:text-lg dark:text-slate-400">
          Proposez un trajet ou trouvez un fidèle qui passe sur votre chemin.
          Simple, gratuit, et fait pour notre communauté.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Se connecter
          </Link>
          <Link
            href="#fonctionnement"
            className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-medium hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            Comment ça marche
          </Link>
        </div>
      </section>

      <section
        id="fonctionnement"
        className="border-t border-slate-200 bg-white px-6 py-16 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
          <Feature
            icon={<Car className="size-5" />}
            title="Pour les conducteurs"
            text="Déclarez votre point de départ, vos horaires et vos places disponibles."
          />
          <Feature
            icon={<MapPin className="size-5" />}
            title="Pour les passagers"
            text="Trouvez un trajet sur votre chemin, demandez une place en un clic."
          />
          <Feature
            icon={<Users className="size-5" />}
            title="100% communautaire"
            text="Pas d'argent, pas de pub. Juste l'esprit de famille de l'église."
          />
        </div>
      </section>

      <footer className="border-t border-slate-200 px-6 py-6 text-center text-xs text-slate-500 dark:border-slate-800">
        © {new Date().getFullYear()} Covoiturage Église
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="space-y-2">
      <div className="inline-flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{text}</p>
    </div>
  );
}

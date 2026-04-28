import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — Covoiturage ICC Metz",
  description: "Mentions légales du service Covoiturage ICC Metz.",
};

export default function MentionsLegalesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← Retour à l&apos;accueil
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">Mentions légales</h1>
      <p className="mt-2 text-sm text-slate-500">
        Dernière mise à jour : 28 avril 2026
      </p>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Éditeur du service</h2>
        <p className="text-sm leading-relaxed">
          Le service <strong>Covoiturage ICC Metz</strong>, accessible à
          l&apos;adresse{" "}
          <a
            href="https://icc-covoit.fr"
            className="text-emerald-700 hover:underline dark:text-emerald-400"
          >
            icc-covoit.fr
          </a>
          , est édité par :
        </p>
        <ul className="text-sm leading-relaxed list-disc pl-6">
          <li>
            <strong>Elom Gnaglo</strong>, responsable de la publication
          </li>
          <li>
            Lien avec l&apos;ICC Metz, sise au 7 rue de l&apos;Abbé Grégoire,
            57050 Metz
          </li>
          <li>
            Statut juridique de l&apos;entité responsable :{" "}
            <span className="text-slate-500">[À COMPLÉTER]</span>
          </li>
          <li>
            Contact :{" "}
            <a
              href="mailto:rgpd@icc-covoit.fr"
              className="text-emerald-700 hover:underline dark:text-emerald-400"
            >
              rgpd@icc-covoit.fr
            </a>
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Hébergement</h2>
        <p className="text-sm leading-relaxed">
          Le site est hébergé par :
        </p>
        <ul className="text-sm leading-relaxed list-disc pl-6">
          <li>
            <strong>Vercel Inc.</strong> — 440 N Barranca Avenue #4133, Covina,
            CA 91723, États-Unis (frontend et serveur Next.js)
          </li>
          <li>
            <strong>Supabase Inc.</strong> — 970 Toa Payoh North #07-04,
            Singapour (base de données et stockage)
          </li>
          <li>
            <strong>OVH SAS</strong> — 2 rue Kellermann, 59100 Roubaix, France
            (nom de domaine)
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Propriété intellectuelle</h2>
        <p className="text-sm leading-relaxed">
          Le code source, les textes, les illustrations et les éléments graphiques
          du service sont protégés. Toute reproduction sans autorisation
          préalable est interdite, à l&apos;exception du logo de l&apos;ICC Metz
          dont les droits appartiennent à son propriétaire.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Limitation de responsabilité</h2>
        <p className="text-sm leading-relaxed">
          Covoiturage ICC Metz est un service de mise en relation gratuit entre
          fidèles. L&apos;éditeur ne saurait être tenu responsable des dommages
          directs ou indirects résultant de l&apos;utilisation du service, ni
          des actes commis par les utilisateurs lors des trajets organisés via
          la plateforme. Les utilisateurs voyagent sous leur propre
          responsabilité.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Données personnelles</h2>
        <p className="text-sm leading-relaxed">
          Pour en savoir plus sur le traitement de vos données personnelles,
          consultez notre{" "}
          <Link
            href="/legal/confidentialite"
            className="text-emerald-700 hover:underline dark:text-emerald-400"
          >
            politique de confidentialité
          </Link>
          .
        </p>
      </section>
    </main>
  );
}

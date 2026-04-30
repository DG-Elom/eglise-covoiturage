import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Covoiturage ICC Metz",
  description:
    "Politique de confidentialité et traitement des données personnelles.",
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← Retour à l&apos;accueil
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        Politique de confidentialité
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Dernière mise à jour : 28 avril 2026
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">1. Qui traite vos données ?</h2>
        <p className="text-sm leading-relaxed">
          Le responsable de traitement est <strong>Elom Gnaglo</strong>, en lien
          avec l&apos;ICC Metz (7 rue de l&apos;Abbé Grégoire, 57050 Metz).
          Contact :{" "}
          <a
            href="mailto:rgpd@icc-covoit.fr"
            className="text-emerald-700 hover:underline dark:text-emerald-400"
          >
            rgpd@icc-covoit.fr
          </a>
          .
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">2. Quelles données collectons-nous ?</h2>
        <p className="text-sm leading-relaxed">
          Pour fonctionner, le service collecte :
        </p>
        <ul className="text-sm leading-relaxed list-disc pl-6 space-y-1">
          <li>
            <strong>Données d&apos;identification</strong> : prénom, nom, email,
            mot de passe (hashé), photo de profil (optionnelle).
          </li>
          <li>
            <strong>Téléphone</strong> : pour permettre aux conducteurs et
            passagers de se contacter en cas d&apos;imprévu.
          </li>
          <li>
            <strong>Adresses et géolocalisation</strong> : adresse de départ
            renseignée par le conducteur, adresse de prise en charge du
            passager, position GPS en temps réel pendant un trajet (uniquement
            avec votre consentement explicite).
          </li>
          <li>
            <strong>Données de réservation</strong> : trajets proposés,
            réservations effectuées, statut (acceptée, refusée, annulée).
          </li>
          <li>
            <strong>Données techniques</strong> : adresse IP, type de
            navigateur, logs serveur (conservés 30 jours pour la sécurité).
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">3. Pourquoi collectons-nous ces données ?</h2>
        <ul className="text-sm leading-relaxed list-disc pl-6 space-y-1">
          <li>
            <strong>Mettre en relation</strong> conducteurs et passagers pour
            le covoiturage vers les cultes (base légale : exécution d&apos;un
            service que vous demandez).
          </li>
          <li>
            <strong>Envoyer des notifications</strong> : confirmation de
            réservation, rappels avant un trajet, alertes en temps réel (base
            légale : intérêt légitime à fournir un service fonctionnel).
          </li>
          <li>
            <strong>Sécurité et lutte contre les abus</strong> : conserver des
            logs et traiter les signalements (base légale : intérêt légitime).
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">4. Avec qui partageons-nous vos données ?</h2>
        <p className="text-sm leading-relaxed">
          Vos données ne sont <strong>jamais vendues</strong>. Elles sont partagées uniquement avec :
        </p>
        <ul className="text-sm leading-relaxed list-disc pl-6 space-y-1">
          <li>
            <strong>Les autres fidèles concernés</strong> par un trajet
            commun : un conducteur voit le prénom, nom, téléphone et photo
            d&apos;un passager qui réserve, et vice-versa.
          </li>
          <li>
            <strong>Nos sous-traitants techniques</strong> : Vercel Inc.
            (hébergement), Supabase Inc. (base de données), Resend Inc. (envoi
            d&apos;emails), Mapbox Inc. (cartographie).
          </li>
        </ul>
        <p className="text-sm leading-relaxed">
          Certains sous-traitants (Vercel, Supabase, Resend, Mapbox) sont basés
          hors UE. Les transferts sont encadrés par les Clauses Contractuelles
          Types de la Commission européenne.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">5. Combien de temps gardons-nous vos données ?</h2>
        <ul className="text-sm leading-relaxed list-disc pl-6 space-y-1">
          <li>
            <strong>Compte actif</strong> : pendant toute la durée
            d&apos;utilisation du service.
          </li>
          <li>
            <strong>Historique des trajets et réservations</strong> : 24 mois
            après la fin du trajet (à des fins de preuve en cas de litige).
          </li>
          <li>
            <strong>Position GPS en temps réel</strong> : non stockée de manière
            durable ; en cas d&apos;activation du lien de suivi public, la
            dernière position est conservée temporairement (max 6h) puis
            supprimée automatiquement.
          </li>
          <li>
            <strong>Compte supprimé</strong> : effacement immédiat des données
            d&apos;identification ; les réservations passées sont anonymisées.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">6. Quels sont vos droits ?</h2>
        <p className="text-sm leading-relaxed">
          Conformément au RGPD, vous disposez des droits suivants :
        </p>
        <ul className="text-sm leading-relaxed list-disc pl-6 space-y-1">
          <li>
            <strong>Accès</strong> : obtenir une copie des données vous
            concernant.
          </li>
          <li>
            <strong>Rectification</strong> : corriger des informations
            inexactes (modifiable directement depuis votre profil).
          </li>
          <li>
            <strong>Effacement</strong> : supprimer votre compte (bouton
            disponible dans votre profil) ou demander l&apos;effacement par
            email.
          </li>
          <li>
            <strong>Opposition</strong> : refuser un traitement spécifique (par
            exemple, désactiver les notifications push).
          </li>
          <li>
            <strong>Portabilité</strong> : récupérer vos données dans un
            format réutilisable.
          </li>
          <li>
            <strong>Réclamation</strong> auprès de la CNIL :{" "}
            <a
              href="https://www.cnil.fr/fr/plaintes"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 hover:underline dark:text-emerald-400"
            >
              cnil.fr/fr/plaintes
            </a>
            .
          </li>
        </ul>
        <p className="text-sm leading-relaxed">
          Pour exercer vos droits, écrivez à{" "}
          <a
            href="mailto:rgpd@icc-covoit.fr"
            className="text-emerald-700 hover:underline dark:text-emerald-400"
          >
            rgpd@icc-covoit.fr
          </a>
          . Nous répondons sous 30 jours maximum.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">7. Cookies et stockage local</h2>
        <p className="text-sm leading-relaxed">
          Nous n&apos;utilisons pas de cookies publicitaires. Le service stocke
          dans votre navigateur :
        </p>
        <ul className="text-sm leading-relaxed list-disc pl-6 space-y-1">
          <li>Un cookie de session pour vous garder connecté.</li>
          <li>
            Une préférence de thème (clair/sombre) dans le stockage local.
          </li>
          <li>
            Une éventuelle inscription aux notifications push (avec votre
            consentement explicite).
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">7bis. Lien de suivi en direct</h2>
        <p className="text-sm leading-relaxed">
          Pendant un trajet, un passager peut générer un lien temporaire
          (&quot;lien de suivi&quot;) permettant à un proche de voir la position
          du conducteur en temps réel. Ce lien expire automatiquement au bout de
          4 heures maximum. Aucune donnée n&apos;est transmise au destinataire du
          lien au-delà de la position géographique du conducteur ; aucune
          information n&apos;est stockée par le destinataire. Le partage est
          strictement volontaire et initié par le passager.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">8. Mineurs</h2>
        <p className="text-sm leading-relaxed">
          Le service est ouvert à partir de 15 ans. En dessous, l&apos;accord
          d&apos;un parent ou tuteur légal est requis.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">9. Modifications</h2>
        <p className="text-sm leading-relaxed">
          Cette politique peut évoluer. Nous indiquerons toujours la date de
          dernière mise à jour en haut de cette page. En cas de modification
          substantielle, nous vous préviendrons par email.
        </p>
      </section>
    </main>
  );
}

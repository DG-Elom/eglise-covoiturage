import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { ShareButton } from "./share-button";

export const metadata: Metadata = {
  title: "Partager Covoiturage ICC Metz",
  description:
    "Invite la famille ICC à utiliser le covoiturage entre fidèles.",
};

export default function LancementPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-center">
        <Logo size="md" withText />
      </div>

      <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Invitation
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Allons à l&apos;église ensemble
        </h1>
        <p className="mt-3 text-center text-sm text-slate-600 dark:text-slate-400">
          Le covoiturage entre fidèles ICC Metz. Gratuit, simple, communautaire.
        </p>

        <div className="mt-8 flex flex-col items-center">
          <div className="rounded-2xl bg-white p-4 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/qr-code.svg"
              alt="QR code vers icc-covoit.fr"
              className="h-56 w-56 sm:h-64 sm:w-64"
            />
          </div>
          <p className="mt-4 text-center text-base font-semibold tracking-tight">
            icc-covoit.fr
          </p>
          <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
            Flashe le code ou tape l&apos;adresse dans ton navigateur
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Step n={1} title="Crée ton compte" text="Google ou email, en 1 minute." />
          <Step n={2} title="Choisis ton rôle" text="Conducteur, passager, ou les deux." />
          <Step n={3} title="On te met en relation" text="Avec les fidèles près de chez toi." />
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ShareButton />
          <Link
            href="/lancement/flyer"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            Version flyer (à imprimer)
          </Link>
        </div>
      </div>

      <Link
        href="/"
        className="mt-6 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      >
        ← Retour à l&apos;accueil
      </Link>
    </main>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
      <div className="inline-flex size-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
        {n}
      </div>
      <h3 className="mt-2 text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{text}</p>
    </div>
  );
}

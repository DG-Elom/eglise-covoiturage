import Link from "next/link";
import { verifyTrackToken } from "@/lib/track-token";
import { TrackView } from "./track-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suivi en direct — Covoiturage ICC Metz",
  description: "Lien de suivi temporaire de trajet covoiturage ICC Metz.",
};

type Props = {
  params: Promise<{ token: string }>;
};

export default async function TrackPage({ params }: Props) {
  const { token } = await params;

  const claims = await verifyTrackToken(token);

  if (!claims) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Lien expire ou invalide</h1>
          <p className="text-sm text-slate-500">
            Ce lien de suivi n&apos;est plus valide. Il a peut-etre expire (duree
            maximale : 4h) ou il est incorrect.
          </p>
          <Link
            href="/"
            className="inline-block mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
          >
            Retour a l&apos;accueil
          </Link>
        </div>
      </main>
    );
  }

  const expiresAtIso = new Date(
    new Date().getTime() + 4 * 60 * 60 * 1000,
  ).toISOString();

  return <TrackView token={token} expiresAtIso={expiresAtIso} />;
}

export function generateStaticParams() {
  return [];
}

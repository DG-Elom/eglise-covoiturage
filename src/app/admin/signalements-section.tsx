"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Check, X, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { confirmToast } from "@/lib/confirm";

const STATUT_COLOR: Record<string, string> = {
  ouvert: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  en_cours: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  traite: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  rejete: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export type SignalementRow = {
  id: string;
  motif: string;
  description: string | null;
  statut: "ouvert" | "en_cours" | "traite" | "rejete";
  created_at: string;
  ia_gravite: number | null;
  ia_action_suggeree: string | null;
  auteur: { id: string; prenom: string; nom: string; photo_url: string | null } | null;
  cible: {
    id: string;
    prenom: string;
    nom: string;
    suspended: boolean;
    photo_url: string | null;
  } | null;
};

export function SignalementsSection({
  signalements,
}: {
  signalements: SignalementRow[];
}) {
  const ouverts = signalements.filter((s) => s.statut === "ouvert");
  const autres = signalements.filter((s) => s.statut !== "ouvert");

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 uppercase tracking-wide dark:text-slate-300">
        <Flag className="size-4" />
        Signalements
        {ouverts.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {ouverts.length} à traiter
          </span>
        )}
      </h2>

      {signalements.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Aucun signalement.
        </p>
      ) : (
        <div className="space-y-2">
          {ouverts.map((s) => (
            <SignalementCard key={s.id} signalement={s} />
          ))}
          {autres.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                Voir les {autres.length} signalement{autres.length > 1 ? "s" : ""} traité
                {autres.length > 1 ? "s" : ""}
              </summary>
              <div className="mt-2 space-y-2">
                {autres.map((s) => (
                  <SignalementCard key={s.id} signalement={s} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function SignalementCard({ signalement }: { signalement: SignalementRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function setStatut(statut: "traite" | "rejete", action: string) {
    setLoading(action);
    const supabase = createClient();
    const { error } = await supabase
      .from("signalements")
      .update({ statut, traite_le: new Date().toISOString() } as never)
      .eq("id", signalement.id);
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(statut === "traite" ? "Marqué comme traité" : "Rejeté");
    router.refresh();
  }

  async function suspend() {
    if (!signalement.cible) return;
    const ok = await confirmToast(
      `Suspendre ${signalement.cible.prenom} ${signalement.cible.nom} ? Il/elle ne pourra plus se connecter à l'app.`,
      { confirmLabel: "Suspendre", destructive: true },
    );
    if (!ok) return;
    setLoading("suspend");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        suspended: true,
        suspended_reason: `Signalement: ${signalement.motif}`,
      } as never)
      .eq("id", signalement.cible.id);
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Compte suspendu");
    router.refresh();
  }

  const couleur = STATUT_COLOR[signalement.statut] ?? STATUT_COLOR.ouvert;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{signalement.motif}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${couleur}`}>
              {signalement.statut}
            </span>
            {signalement.ia_gravite !== null && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  signalement.ia_gravite >= 4
                    ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                gravité {signalement.ia_gravite}/5
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              {signalement.auteur && (
                <Avatar
                  photoUrl={signalement.auteur.photo_url}
                  prenom={signalement.auteur.prenom}
                  nom={signalement.auteur.nom}
                  size="xs"
                />
              )}
              {signalement.auteur
                ? `${signalement.auteur.prenom} ${signalement.auteur.nom}`
                : "—"}
            </span>
            <span>→</span>
            <span className="inline-flex items-center gap-1">
              {signalement.cible && (
                <Avatar
                  photoUrl={signalement.cible.photo_url}
                  prenom={signalement.cible.prenom}
                  nom={signalement.cible.nom}
                  size="xs"
                />
              )}
              {signalement.cible
                ? `${signalement.cible.prenom} ${signalement.cible.nom}`
                : "—"}
              {signalement.cible?.suspended && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-950/40 dark:text-red-300">
                  <Ban className="size-2.5" /> suspendu
                </span>
              )}
            </span>
          </div>
          {signalement.description && (
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{signalement.description}</p>
          )}
          {signalement.ia_action_suggeree && (
            <p className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600 italic dark:bg-slate-950 dark:text-slate-400">
              IA suggère : {signalement.ia_action_suggeree}
            </p>
          )}
        </div>
      </div>

      {signalement.statut === "ouvert" && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setStatut("traite", "traite")}
            disabled={loading !== null}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 transition dark:border-slate-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
          >
            {loading === "traite" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            Traité
          </button>
          <button
            type="button"
            onClick={() => setStatut("rejete", "rejete")}
            disabled={loading !== null}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50 disabled:opacity-50 transition dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {loading === "rejete" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <X className="size-3" />
            )}
            Rejeter
          </button>
          {signalement.cible && !signalement.cible.suspended && (
            <button
              type="button"
              onClick={suspend}
              disabled={loading !== null}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50 transition dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/40"
            >
              {loading === "suspend" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Ban className="size-3" />
              )}
              Suspendre le compte
            </button>
          )}
        </div>
      )}
    </div>
  );
}

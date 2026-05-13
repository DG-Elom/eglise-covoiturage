"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, Check, Clock, X, Loader2, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";

const STATUT_COLOR: Record<string, string> = {
  ouvert: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  en_cours: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  resolu: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  ferme: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const CATEGORIE_LABEL: Record<string, string> = {
  crash: "Crash",
  affichage: "Affichage",
  fonctionnalite: "Fonctionnalité",
  performance: "Lenteur",
  autre: "Autre",
};

const CATEGORIE_COLOR: Record<string, string> = {
  crash: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  affichage: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  fonctionnalite: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  performance: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300",
  autre: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export type BugReportRow = {
  id: string;
  description: string;
  categorie: string;
  page_url: string | null;
  user_agent: string | null;
  statut: "ouvert" | "en_cours" | "resolu" | "ferme";
  note_admin: string | null;
  created_at: string;
  auteur: { id: string; prenom: string; nom: string; photo_url: string | null } | null;
};

export function BugsSection({ bugs }: { bugs: BugReportRow[] }) {
  const ouverts = bugs.filter((b) => b.statut === "ouvert" || b.statut === "en_cours");
  const fermes = bugs.filter((b) => b.statut === "resolu" || b.statut === "ferme");

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 uppercase tracking-wide dark:text-slate-300">
        <Bug className="size-4" />
        Bugs
        {ouverts.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {ouverts.length} à traiter
          </span>
        )}
      </h2>

      {bugs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Aucun bug signalé.
        </p>
      ) : (
        <div className="space-y-2">
          {ouverts.map((b) => (
            <BugCard key={b.id} bug={b} />
          ))}
          {fermes.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                Voir les {fermes.length} bug{fermes.length > 1 ? "s" : ""} résolu
                {fermes.length > 1 ? "s" : ""}
              </summary>
              <div className="mt-2 space-y-2">
                {fermes.map((b) => (
                  <BugCard key={b.id} bug={b} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function formatBugForClipboard(bug: BugReportRow): string {
  const date = new Date(bug.created_at).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const auteur = bug.auteur ? `${bug.auteur.prenom} ${bug.auteur.nom}` : "—";
  const lines = [
    `[${(CATEGORIE_LABEL[bug.categorie] ?? bug.categorie).toUpperCase()}] · ${bug.statut}`,
    `Date : ${date}`,
    `Auteur : ${auteur}`,
    bug.page_url ? `Page : ${bug.page_url}` : null,
    bug.user_agent ? `User-Agent : ${bug.user_agent}` : null,
    "",
    "Description :",
    bug.description,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

function BugCard({ bug }: { bug: BugReportRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyBug() {
    const text = formatBugForClipboard(bug);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Bug copié dans le presse-papier");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier. Sélectionne manuellement.");
    }
  }

  async function setStatut(statut: "en_cours" | "resolu" | "ferme", action: string) {
    setLoading(action);
    const supabase = createClient();
    const { error } = await supabase
      .from("bug_reports")
      .update({ statut } as never)
      .eq("id", bug.id);
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      statut === "resolu"
        ? "Marqué comme résolu"
        : statut === "en_cours"
          ? "Marqué en cours"
          : "Fermé",
    );
    router.refresh();
  }

  const date = new Date(bug.created_at);
  const dateStr = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORIE_COLOR[bug.categorie] ?? CATEGORIE_COLOR.autre}`}>
              {CATEGORIE_LABEL[bug.categorie] ?? bug.categorie}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUT_COLOR[bug.statut]}`}>
              {bug.statut}
            </span>
            <span className="text-[10px] text-slate-400">{dateStr}</span>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {bug.auteur && (
              <Avatar
                photoUrl={bug.auteur.photo_url}
                prenom={bug.auteur.prenom}
                nom={bug.auteur.nom}
                size="xs"
              />
            )}
            {bug.auteur ? `${bug.auteur.prenom} ${bug.auteur.nom}` : "—"}
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
            {bug.description}
          </p>

          {bug.page_url && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400 break-all">
              <ExternalLink className="size-3 shrink-0" />
              {bug.page_url}
            </p>
          )}

          {bug.user_agent && (
            <p className="mt-1 text-[10px] text-slate-400 truncate" title={bug.user_agent}>
              {bug.user_agent}
            </p>
          )}

          {bug.note_admin && (
            <p className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600 italic dark:bg-slate-950 dark:text-slate-400">
              Note admin : {bug.note_admin}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={copyBug}
          title="Copier le bug formaté"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        </button>
      </div>

      {(bug.statut === "ouvert" || bug.statut === "en_cours") && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          {bug.statut === "ouvert" && (
            <button
              type="button"
              onClick={() => setStatut("en_cours", "en_cours")}
              disabled={loading !== null}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition dark:border-slate-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
            >
              {loading === "en_cours" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Clock className="size-3" />
              )}
              En cours
            </button>
          )}
          <button
            type="button"
            onClick={() => setStatut("resolu", "resolu")}
            disabled={loading !== null}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 transition dark:border-slate-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
          >
            {loading === "resolu" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            Résolu
          </button>
          <button
            type="button"
            onClick={() => setStatut("ferme", "ferme")}
            disabled={loading !== null}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50 disabled:opacity-50 transition dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {loading === "ferme" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <X className="size-3" />
            )}
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}

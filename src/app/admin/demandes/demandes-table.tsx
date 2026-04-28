"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { confirmToast } from "@/lib/confirm";
import { Trash2, Check, X } from "lucide-react";

export type DemandeRow = {
  id: string;
  date: string;
  sens: "aller" | "retour";
  pickup_adresse: string;
  notes: string | null;
  statut: "active" | "matched" | "annulee";
  created_at: string;
  matched_trajet_id: string | null;
  passager: { id: string; prenom: string; nom: string; photo_url: string | null } | null;
  culte: { libelle: string; heure: string } | null;
};

type StatutFilter = "all" | "active" | "matched" | "annulee";

const STATUT_LABEL: Record<DemandeRow["statut"], string> = {
  active: "Active",
  matched: "Matchée",
  annulee: "Annulée",
};

const STATUT_COLOR: Record<DemandeRow["statut"], string> = {
  active: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  matched: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  annulee: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const SENS_LABEL: Record<DemandeRow["sens"], string> = {
  aller: "Aller",
  retour: "Retour",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function DemandeRow({ demande }: { demande: DemandeRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function markMatched() {
    const ok = await confirmToast("Marquer cette demande comme matchée ?", {
      confirmLabel: "Confirmer",
    });
    if (!ok) return;
    setLoading("matched");
    const supabase = createClient();
    const { error } = await supabase
      .from("demandes_passager")
      .update({ statut: "matched" } as never)
      .eq("id", demande.id);
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Demande marquée comme matchée");
    router.refresh();
  }

  async function markAnnulee() {
    const ok = await confirmToast("Annuler cette demande ?", {
      confirmLabel: "Annuler la demande",
      destructive: true,
    });
    if (!ok) return;
    setLoading("annulee");
    const supabase = createClient();
    const { error } = await supabase
      .from("demandes_passager")
      .update({ statut: "annulee" } as never)
      .eq("id", demande.id);
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Demande annulée");
    router.refresh();
  }

  async function deleteDemande() {
    const ok = await confirmToast("Supprimer définitivement cette demande ?", {
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    setLoading("delete");
    const supabase = createClient();
    const { error } = await supabase
      .from("demandes_passager")
      .delete()
      .eq("id", demande.id);
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Demande supprimée");
    router.refresh();
  }

  const busy = loading !== null;

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30">
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-2">
          {demande.passager && (
            <Avatar
              photoUrl={demande.passager.photo_url}
              prenom={demande.passager.prenom}
              nom={demande.passager.nom}
              size="sm"
            />
          )}
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900 dark:text-slate-100">
              {demande.passager
                ? `${demande.passager.prenom} ${demande.passager.nom}`
                : "—"}
            </div>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-3 text-sm sm:table-cell">
        <div className="font-medium">{demande.culte?.libelle ?? "—"}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {demande.culte?.heure.slice(0, 5) ?? ""}
        </div>
      </td>
      <td className="hidden px-3 py-3 text-sm md:table-cell">
        {formatDate(demande.date)}
      </td>
      <td className="hidden px-3 py-3 text-sm md:table-cell">
        {SENS_LABEL[demande.sens]}
      </td>
      <td className="hidden max-w-[180px] px-3 py-3 text-xs text-slate-600 lg:table-cell dark:text-slate-400">
        <div className="truncate" title={demande.pickup_adresse}>
          {demande.pickup_adresse}
        </div>
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUT_COLOR[demande.statut]}`}
        >
          {STATUT_LABEL[demande.statut]}
        </span>
      </td>
      <td className="hidden max-w-[160px] px-3 py-3 text-xs text-slate-500 lg:table-cell dark:text-slate-400">
        <div className="truncate" title={demande.notes ?? undefined}>
          {demande.notes ?? "—"}
        </div>
      </td>
      <td className="hidden px-3 py-3 text-xs text-slate-500 sm:table-cell dark:text-slate-400">
        {formatDate(demande.created_at)}
      </td>
      <td className="py-3 pl-3 pr-4">
        <div className="flex items-center justify-end gap-1">
          {demande.statut === "active" && (
            <button
              type="button"
              onClick={markMatched}
              disabled={busy}
              title="Marquer matched"
              className="inline-flex size-7 items-center justify-center rounded-md text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              <Check className="size-4" />
            </button>
          )}
          {demande.statut !== "annulee" && (
            <button
              type="button"
              onClick={markAnnulee}
              disabled={busy}
              title="Annuler"
              className="inline-flex size-7 items-center justify-center rounded-md text-amber-600 transition hover:bg-amber-50 disabled:opacity-40 dark:text-amber-400 dark:hover:bg-amber-950/40"
            >
              <X className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={deleteDemande}
            disabled={busy}
            title="Supprimer"
            className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function DemandesTable({ demandes }: { demandes: DemandeRow[] }) {
  const [filter, setFilter] = useState<StatutFilter>("all");

  const filtered =
    filter === "all" ? demandes : demandes.filter((d) => d.statut === filter);

  const counts: Record<StatutFilter, number> = {
    all: demandes.length,
    active: demandes.filter((d) => d.statut === "active").length,
    matched: demandes.filter((d) => d.statut === "matched").length,
    annulee: demandes.filter((d) => d.statut === "annulee").length,
  };

  const filters: { value: StatutFilter; label: string }[] = [
    { value: "all", label: "Toutes" },
    { value: "active", label: "Actives" },
    { value: "matched", label: "Matchées" },
    { value: "annulee", label: "Annulées" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === value
                ? "bg-slate-900 text-white dark:bg-emerald-600"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {label}{" "}
            <span className="opacity-60">{counts[value]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Aucune demande.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2.5 pl-4 pr-3">Passager</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Culte</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Date</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Sens</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Pickup</th>
                <th className="px-3 py-2.5">Statut</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Notes</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Créée le</th>
                <th className="py-2.5 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((demande) => (
                <DemandeRow key={demande.id} demande={demande} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-right text-xs text-slate-400 dark:text-slate-600">
        {filtered.length} demande{filtered.length !== 1 ? "s" : ""}
        {filter !== "all" ? ` sur ${demandes.length}` : ""}
      </p>
    </div>
  );
}

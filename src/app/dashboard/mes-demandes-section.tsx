"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm";

export type DemandePassagerRow = {
  id: string;
  date: string;
  sens: "aller" | "retour";
  pickup_adresse: string;
  statut: "active" | "matched" | "annulee";
  created_at: string;
  culte: { libelle: string; heure: string } | null;
};

const SENS_LABEL: Record<DemandePassagerRow["sens"], string> = {
  aller: "Aller vers le culte",
  retour: "Retour du culte",
};

const STATUT_BADGE: Record<
  DemandePassagerRow["statut"],
  { label: string; cls: string }
> = {
  active: {
    label: "En attente",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  },
  matched: {
    label: "Conducteur trouvé",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  annulee: {
    label: "Annulée",
    cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

export function MesDemandesSection({
  demandes,
}: {
  demandes: DemandePassagerRow[];
}) {
  return (
    <ul className="mt-3 space-y-3">
      {demandes.map((d) => (
        <DemandeItem key={d.id} demande={d} />
      ))}
    </ul>
  );
}

function DemandeItem({ demande }: { demande: DemandePassagerRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const badge = STATUT_BADGE[demande.statut];

  async function annuler() {
    const ok = await confirmToast("Annuler cette demande ?", {
      confirmLabel: "Annuler",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    const res = await fetch(`/api/demandes/${demande.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Échec de la suppression");
      setDeleting(false);
      return;
    }
    toast.success("Demande annulée");
    startTransition(() => {
      router.refresh();
    });
  }

  const busy = pending || deleting;

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium">
              {demande.culte?.libelle ?? "Trajet"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
            <Calendar className="size-3 shrink-0" />
            <span>
              {formatDate(demande.date)} · {SENS_LABEL[demande.sens]}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{demande.pickup_adresse}</span>
          </div>
        </div>
        {demande.statut === "active" && (
          <button
            type="button"
            onClick={annuler}
            disabled={busy}
            aria-label="Annuler cette demande"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-red-950/40"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </button>
        )}
      </div>
    </li>
  );
}

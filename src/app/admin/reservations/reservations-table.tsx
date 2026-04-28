"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Search, Check, X, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { confirmToast } from "@/lib/confirm";

const STATUT_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  refused: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  completed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  no_show: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
};

const STATUT_LABEL: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  refused: "Refusée",
  cancelled: "Annulée",
  completed: "Terminée",
  no_show: "Non présenté",
};

const SENS_BADGE: Record<string, string> = {
  aller: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  retour: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
};

type Profile = {
  id: string;
  prenom: string;
  nom: string;
  photo_url: string | null;
};

type Culte = {
  libelle: string;
  heure: string;
};

type Trajet = {
  id: string;
  depart_adresse: string;
  heure_depart: string;
  conducteur: Profile | null;
  cultes: Culte | null;
};

type TrajetInstance = {
  id: string;
  date: string;
  trajets: Trajet | null;
};

export type Reservation = {
  id: string;
  sens: "aller" | "retour";
  statut: "pending" | "accepted" | "refused" | "cancelled" | "completed" | "no_show";
  pickup_adresse: string;
  demande_le: string;
  traitee_le: string | null;
  cancelled_le: string | null;
  motif_refus: string | null;
  passager: Profile | null;
  trajets_instances: TrajetInstance | null;
};

const ALL_STATUTS = ["all", "pending", "accepted", "refused", "cancelled", "completed", "no_show"] as const;
type StatutFilter = (typeof ALL_STATUTS)[number];

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 30) return `Il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function ReservationsTable({ reservations }: { reservations: Reservation[] }) {
  const router = useRouter();
  const [statutFilter, setStatutFilter] = useState<StatutFilter>("all");
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = reservations.filter((r) => {
    if (statutFilter !== "all" && r.statut !== statutFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const passagerName =
        `${r.passager?.prenom ?? ""} ${r.passager?.nom ?? ""}`.toLowerCase();
      const conducteurName =
        `${r.trajets_instances?.trajets?.conducteur?.prenom ?? ""} ${r.trajets_instances?.trajets?.conducteur?.nom ?? ""}`.toLowerCase();
      if (!passagerName.includes(q) && !conducteurName.includes(q)) return false;
    }
    return true;
  });

  async function forceStatut(
    id: string,
    statut: "accepted" | "refused" | "cancelled",
  ) {
    const label =
      statut === "accepted" ? "Forcer acceptée" :
      statut === "refused" ? "Forcer refusée" :
      "Forcer annulée";

    const ok = await confirmToast(`${label} cette réservation ?`, {
      confirmLabel: label,
      cancelLabel: "Annuler",
      destructive: statut !== "accepted",
    });
    if (!ok) return;

    setLoadingId(id);
    const supabase = createClient();
    const now = new Date().toISOString();
    const patch =
      statut === "accepted"
        ? { statut, traitee_le: now }
        : statut === "refused"
        ? { statut, traitee_le: now }
        : { statut, cancelled_le: now };

    const { error } = await supabase
      .from("reservations")
      .update(patch as never)
      .eq("id", id);
    setLoadingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Statut mis à jour : ${STATUT_LABEL[statut]}`);
    router.refresh();
  }

  async function supprimer(id: string) {
    const ok = await confirmToast("Supprimer cette réservation ?", {
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      destructive: true,
    });
    if (!ok) return;

    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    setLoadingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Réservation supprimée");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher passager ou conducteur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-emerald-600"
          />
        </div>

        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value as StatutFilter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="accepted">Acceptées</option>
          <option value="refused">Refusées</option>
          <option value="cancelled">Annulées</option>
          <option value="completed">Terminées</option>
          <option value="no_show">Non présentés</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Aucune réservation trouvée.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <th className="px-4 py-3 text-left">Passager</th>
                <th className="px-4 py-3 text-left">Conducteur</th>
                <th className="px-4 py-3 text-left">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    Date
                  </span>
                </th>
                <th className="px-4 py-3 text-left">Heure départ</th>
                <th className="px-4 py-3 text-left">Sens</th>
                <th className="px-4 py-3 text-left">Pickup</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Demandée</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((r) => {
                const conducteur = r.trajets_instances?.trajets?.conducteur ?? null;
                const instance = r.trajets_instances;
                const trajet = instance?.trajets ?? null;
                const isLoading = loadingId === r.id;

                return (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Avatar
                          photoUrl={r.passager?.photo_url}
                          prenom={r.passager?.prenom}
                          nom={r.passager?.nom}
                          size="xs"
                        />
                        <span>
                          {r.passager?.prenom} {r.passager?.nom}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {conducteur ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Avatar
                            photoUrl={conducteur.photo_url}
                            prenom={conducteur.prenom}
                            nom={conducteur.nom}
                            size="xs"
                          />
                          <span>
                            {conducteur.prenom} {conducteur.nom}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {instance
                        ? new Date(instance.date).toLocaleDateString("fr-FR", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {trajet?.heure_depart?.slice(0, 5) ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SENS_BADGE[r.sens] ?? ""}`}
                      >
                        {r.sens === "aller" ? "Aller" : "Retour"}
                      </span>
                    </td>

                    <td className="px-4 py-3 max-w-[160px] truncate text-slate-600 dark:text-slate-400">
                      {r.pickup_adresse}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUT_BADGE[r.statut] ?? ""}`}
                      >
                        {STATUT_LABEL[r.statut] ?? r.statut}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                      {relativeDate(r.demande_le)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Forcer acceptée"
                          disabled={isLoading}
                          onClick={() => forceStatut(r.id, "accepted")}
                          className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition dark:hover:bg-emerald-950/40"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          type="button"
                          title="Forcer refusée"
                          disabled={isLoading}
                          onClick={() => forceStatut(r.id, "refused")}
                          className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-40 transition dark:hover:bg-red-950/40"
                        >
                          <X className="size-4" />
                        </button>
                        <button
                          type="button"
                          title="Forcer annulée"
                          disabled={isLoading}
                          onClick={() => forceStatut(r.id, "cancelled")}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition dark:hover:bg-slate-800"
                        >
                          <span className="text-[10px] font-medium">Annul.</span>
                        </button>
                        <button
                          type="button"
                          title="Supprimer"
                          disabled={isLoading}
                          onClick={() => supprimer(r.id)}
                          className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-40 transition dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500">
        {filtered.length} réservation{filtered.length !== 1 ? "s" : ""} affichée
        {filtered.length !== 1 ? "s" : ""}
        {reservations.length !== filtered.length && ` (${reservations.length} au total)`}
      </p>
    </div>
  );
}

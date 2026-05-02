"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Car, Calendar, Search, Ban, CheckCircle2, Trash2, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { confirmToast } from "@/lib/confirm";
import type { TrajetRow } from "./page";

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const SENS_LABEL: Record<string, string> = {
  aller: "Aller",
  retour: "Retour",
  aller_retour: "Aller-retour",
};

function instancesFuturesCount(
  instances: TrajetRow["trajets_instances"],
  today: string,
): number {
  return instances.filter((i) => !i.annule_par_conducteur && i.date >= today)
    .length;
}

function SensBadge({ sens }: { sens: TrajetRow["sens"] }) {
  const colors: Record<TrajetRow["sens"], string> = {
    aller:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    retour:
      "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
    aller_retour:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[sens]}`}
    >
      {SENS_LABEL[sens]}
    </span>
  );
}

function ActifBadge({ actif }: { actif: boolean }) {
  if (actif) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
        <CheckCircle2 className="size-3" />
        Actif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      <Ban className="size-3" />
      Inactif
    </span>
  );
}

export function TrajetsTable({ trajets }: { trajets: TrajetRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterActif, setFilterActif] = useState<"all" | "actif" | "inactif">(
    "all",
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = trajets.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      q === "" ||
      t.depart_adresse.toLowerCase().includes(q) ||
      (t.conducteur?.prenom ?? "").toLowerCase().includes(q) ||
      (t.conducteur?.nom ?? "").toLowerCase().includes(q);
    const matchActif =
      filterActif === "all" ||
      (filterActif === "actif" && t.actif) ||
      (filterActif === "inactif" && !t.actif);
    return matchSearch && matchActif;
  });

  async function toggleActif(trajet: TrajetRow) {
    const action = trajet.actif ? "Désactiver" : "Activer";
    const ok = await confirmToast(`${action} ce trajet ?`, {
      confirmLabel: action,
      destructive: trajet.actif,
    });
    if (!ok) return;

    setLoadingId(trajet.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("trajets")
      .update({ actif: !trajet.actif } as never)
      .eq("id", trajet.id);
    setLoadingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(trajet.actif ? "Trajet désactivé" : "Trajet activé");
    router.refresh();
  }

  async function deleteTrajet(trajet: TrajetRow) {
    const ok = await confirmToast(
      "Supprimer définitivement ce trajet ? Toutes les instances et réservations associées seront supprimées.",
      { confirmLabel: "Supprimer", destructive: true },
    );
    if (!ok) return;

    setLoadingId(trajet.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("trajets")
      .delete()
      .eq("id", trajet.id);
    setLoadingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Trajet supprimé");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher par adresse ou conducteur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm placeholder-slate-400 focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:placeholder-slate-500 dark:focus:border-emerald-600"
          />
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 overflow-hidden shrink-0">
          {(["all", "actif", "inactif"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilterActif(v)}
              className={`px-3 py-2 text-xs transition ${
                filterActif === v
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {v === "all" ? "Tous" : v === "actif" ? "Actifs" : "Inactifs"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Aucun trajet trouvé.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Conducteur</th>
                <th className="px-4 py-3 font-medium">Adresse départ</th>
                <th className="px-4 py-3 font-medium">Culte</th>
                <th className="px-4 py-3 font-medium">Heure départ</th>
                <th className="px-4 py-3 font-medium">Sens</th>
                <th className="px-4 py-3 font-medium text-center">Places</th>
                <th className="px-4 py-3 font-medium text-center">Rayon km</th>
                <th className="px-4 py-3 font-medium text-center">
                  <span className="flex items-center justify-center gap-1">
                    <Calendar className="size-3" />
                    Futures
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((t) => {
                const futuresCount = instancesFuturesCount(
                  t.trajets_instances,
                  today,
                );
                const isLoading = loadingId === t.id;
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar
                          photoUrl={t.conducteur?.photo_url}
                          prenom={t.conducteur?.prenom}
                          nom={t.conducteur?.nom}
                          size="sm"
                        />
                        <span className="font-medium whitespace-nowrap">
                          {t.conducteur
                            ? `${t.conducteur.prenom} ${t.conducteur.nom}`
                            : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-48">
                      <span
                        className="block truncate text-slate-600 dark:text-slate-300"
                        title={t.depart_adresse}
                      >
                        {t.depart_adresse}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.culte ? (
                        <div>
                          <div className="font-medium">{t.culte.libelle}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {JOURS[t.culte.jour_semaine]} ·{" "}
                            {t.culte.heure.slice(0, 5)}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {t.heure_depart.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3">
                      <SensBadge sens={t.sens} />
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">
                      {t.places_total}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">
                      {t.rayon_detour_km}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-medium ${
                          futuresCount > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-slate-400"
                        }`}
                      >
                        {futuresCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ActifBadge actif={t.actif} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/admin/trajets/${t.id}`}
                          title="Statistiques détaillées"
                          className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                        >
                          <BarChart3 className="size-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleActif(t)}
                          disabled={isLoading}
                          title={t.actif ? "Désactiver" : "Activer"}
                          className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 transition dark:text-slate-500 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
                        >
                          {t.actif ? (
                            <Ban className="size-4" />
                          ) : (
                            <CheckCircle2 className="size-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTrajet(t)}
                          disabled={isLoading}
                          title="Supprimer"
                          className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
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
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
            <Car className="mr-1 inline size-3" />
            {filtered.length} trajet{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== trajets.length
              ? ` / ${trajets.length} au total`
              : ""}
          </div>
        </div>
      )}
    </div>
  );
}

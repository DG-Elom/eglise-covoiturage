"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import type { Database } from "@/lib/supabase/types";
import { formatSens, formatJour, desactiverAbonnement } from "./mes-abonnements.utils";

type Sens = Database["public"]["Tables"]["subscriptions"]["Row"]["sens"];

export type AbonnementAvecTrajet = {
  id: string;
  trajet_id: string;
  sens: Sens;
  pickup_adresse: string;
  actif: boolean;
  created_at: string;
  trajet: {
    heure_depart: string;
    depart_adresse: string;
    conducteur: {
      prenom: string;
      nom: string;
      photo_url: string | null;
    };
    culte: {
      libelle: string;
      jour_semaine: number;
    };
  };
};

export { formatSens, formatJour, desactiverAbonnement };

export function MesAbonnements({ userId }: { userId: string }) {
  const [abonnements, setAbonnements] = useState<AbonnementAvecTrajet[]>([]);
  const [loading, setLoading] = useState(true);
  const [desactivating, setDesactivating] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("subscriptions")
      .select(
        `id, trajet_id, sens, pickup_adresse, actif, created_at,
         trajet:trajets!inner (
           heure_depart, depart_adresse,
           conducteur:profiles!trajets_conducteur_id_fkey (prenom, nom, photo_url),
           culte:cultes!inner (libelle, jour_semaine)
         )`,
      )
      .eq("passager_id", userId)
      .eq("actif", true)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[mes-abonnements] load error", error);
        }
        setAbonnements((data ?? []) as unknown as AbonnementAvecTrajet[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleDesactiver(id: string) {
    setDesactivating(id);
    const ok = await desactiverAbonnement(id);
    setDesactivating(null);
    if (ok) {
      setAbonnements((prev) => prev.filter((a) => a.id !== id));
      toast.success("Abonnement désactivé");
    } else {
      toast.error("Impossible de désactiver l'abonnement");
    }
  }

  if (loading) {
    return (
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          Inscriptions automatiques aux trajets récurrents
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Chargement…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <RefreshCw className="size-3.5" />
          Inscriptions automatiques aux trajets récurrents
        </h2>
        {abonnements.length > 0 && (
          <span className="text-xs text-slate-500">
            {abonnements.length} actif{abonnements.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {abonnements.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-900">
          <Bell className="mx-auto mb-2 size-5 text-slate-400" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Aucun abonnement actif
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Abonne-toi à un trajet récurrent pour être inscrit automatiquement.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {abonnements.map((sub) => (
            <li
              key={sub.id}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Avatar
                    photoUrl={sub.trajet.conducteur.photo_url}
                    prenom={sub.trajet.conducteur.prenom}
                    nom={sub.trajet.conducteur.nom}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {sub.trajet.conducteur.prenom} {sub.trajet.conducteur.nom}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {sub.trajet.culte.libelle} · {formatJour(sub.trajet.culte.jour_semaine)}
                      {" · "}
                      {sub.trajet.heure_depart.slice(0, 5)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                          {formatSens(sub.sens)}
                        </span>
                        {" · "}
                        {sub.pickup_adresse}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDesactiver(sub.id)}
                  disabled={desactivating === sub.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50 transition dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-700 dark:hover:text-red-400"
                  aria-label="Désactiver"
                >
                  <BellOff className="size-3.5" />
                  Désactiver
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

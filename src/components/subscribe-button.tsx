"use client";

import { useState } from "react";
import { RefreshCw, BellOff } from "lucide-react";
import { toast } from "sonner";

type Sens = "aller" | "retour";

type Props = {
  trajetId: string;
  sens: Sens;
  departAdresse: string;
  passagerId: string;
  initialSubscribed?: boolean;
  initialSubscriptionId?: string | null;
};

export function SubscribeButton({
  trajetId,
  sens,
  departAdresse,
  initialSubscribed = false,
  initialSubscriptionId = null,
}: Props) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(
    initialSubscriptionId,
  );
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trajet_id: trajetId,
          sens,
          pickup_adresse: departAdresse,
          pickup_lat: 0,
          pickup_lng: 0,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { id: string };
        setSubscriptionId(data.id);
        setSubscribed(true);
        setModalOpen(false);
        toast.success("Abonnement créé");
      } else {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(err.error ?? "Échec de l'abonnement");
      }
    } catch {
      toast.error("Erreur réseau");
    }
    setLoading(false);
  }

  async function handleUnsubscribe() {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSubscribed(false);
        setSubscriptionId(null);
        toast.success("Désabonné");
      } else {
        toast.error("Impossible de se désabonner");
      }
    } catch {
      toast.error("Erreur réseau");
    }
    setLoading(false);
  }

  if (subscribed) {
    return (
      <button
        type="button"
        onClick={handleUnsubscribe}
        disabled={loading}
        className="mt-2 flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50 transition dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-700 dark:hover:text-red-400"
      >
        <BellOff className="size-3.5" />
        Se désabonner
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={loading}
        className="mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
      >
        <RefreshCw className="size-3.5" />
        S&apos;abonner à ce trajet
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">S&apos;abonner au trajet</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Tu seras automatiquement inscrit à toutes les instances futures de
              ce trajet. Tu pourras annuler une réservation ponctuelle sans
              perdre ton abonnement.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={loading}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {loading ? "…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

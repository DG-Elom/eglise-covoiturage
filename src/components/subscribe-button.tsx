"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Sens = "aller" | "retour";

type Props = {
  trajetId: string;
  sens: Sens;
  fromReservationId: string;
  pickupAdresse: string;
  initialSubscribed?: boolean;
  initialSubscriptionId?: string | null;
};

export function SubscribeButton({
  trajetId,
  sens,
  fromReservationId,
  pickupAdresse,
  initialSubscribed = false,
  initialSubscriptionId = null,
}: Props) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(
    initialSubscriptionId,
  );
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // trajetId est conservé pour référence future (ex: analytics), mais le POST utilise fromReservationId
  void trajetId;
  void sens;

  async function handleSubscribe() {
    setLoading(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_reservation_id: fromReservationId,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { id: string };
        setSubscriptionId(data.id);
        setSubscribed(true);
        setModalOpen(false);
        toast.success("Inscription auto activée");
      } else {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(err.error ?? "Échec de l'inscription");
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
        toast.success("Inscription auto désactivée");
      } else {
        toast.error("Impossible de désactiver l'inscription");
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
        className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-red-600 hover:underline disabled:opacity-50 transition dark:text-emerald-400 dark:hover:text-red-400"
      >
        <RefreshCw className="size-3" />
        Inscription auto active · Désactiver
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700 hover:underline disabled:opacity-50 transition dark:text-slate-400 dark:hover:text-emerald-400"
      >
        <RefreshCw className="size-3" />
        Recevoir auto chaque semaine
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
            <h3 className="text-base font-semibold">
              Recevoir une demande automatique chaque semaine ?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              À chaque culte, une réservation sera créée automatiquement avec
              ton adresse de départ habituelle :{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {pickupAdresse}
              </span>
              .
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Le conducteur reste libre d&apos;accepter ou refuser à chaque
              fois. Tu peux annuler une réservation ponctuelle sans perdre
              l&apos;inscription.
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
                {loading ? "…" : "Activer l'inscription auto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

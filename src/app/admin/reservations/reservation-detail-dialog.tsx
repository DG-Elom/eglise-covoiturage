"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import type { Reservation } from "./reservations-table";

const MOTIF_REFUS: Record<string, string> = {
  trajet_complet_auto: "Trajet complet (refus automatique)",
  conducteur_refus: "Refusée par le conducteur",
  accepte_ailleurs: "Le passager a été accepté sur un autre trajet",
};

export function libelleMotifRefus(motif: string | null): string | null {
  if (!motif) return null;
  return MOTIF_REFUS[motif] ?? motif;
}

const STATUT_LABEL: Record<Reservation["statut"], string> = {
  pending: "En attente",
  accepted: "Acceptée",
  refused: "Refusée",
  cancelled: "Annulée",
  completed: "Terminée",
  no_show: "Non présenté",
};

function dateHeure(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateTrajet(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="break-words text-sm text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

function Personne({
  p,
}: {
  p: { id: string; prenom: string; nom: string; photo_url: string | null } | null;
}) {
  if (!p) return <span className="text-slate-400">—</span>;
  return (
    <Link
      href={`/u/${p.id}`}
      className="inline-flex items-center gap-2 font-medium hover:underline"
    >
      <Avatar photoUrl={p.photo_url} prenom={p.prenom} nom={p.nom} size="xs" />
      {p.prenom} {p.nom}
    </Link>
  );
}

/**
 * Détail complet d'une réservation (admin) : tout ce que la table tronque.
 * Fenêtre native <dialog> (Échap et clic hors du cadre ferment).
 */
export function ReservationDetailDialog({
  reservation: r,
  onClose,
  actions,
}: {
  reservation: Reservation;
  onClose: () => void;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  const instance = r.trajets_instances;
  const trajet = instance?.trajets ?? null;
  const motif = libelleMotifRefus(r.motif_refus);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="resa-detail-titre"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <h2 id="resa-detail-titre" className="text-base font-semibold">
          Réservation · {STATUT_LABEL[r.statut] ?? r.statut}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="size-5" />
        </button>
      </div>

      <dl className="divide-y divide-slate-100 px-5 dark:divide-slate-800">
        <Ligne label="Passager">
          <Personne p={r.passager} />
        </Ligne>
        <Ligne label="Conducteur">
          <Personne p={trajet?.conducteur ?? null} />
        </Ligne>
        <Ligne label="Programme">
          {trajet?.cultes
            ? `${trajet.cultes.libelle} · ${trajet.cultes.heure.slice(0, 5)}`
            : "—"}
        </Ligne>
        <Ligne label="Date du trajet">{instance ? dateTrajet(instance.date) : "—"}</Ligne>
        <Ligne label="Heure de départ">{trajet?.heure_depart?.slice(0, 5) ?? "—"}</Ligne>
        <Ligne label="Sens">{r.sens === "aller" ? "Aller" : "Retour"}</Ligne>
        <Ligne label="Départ du conducteur">{trajet?.depart_adresse ?? "—"}</Ligne>
        <Ligne label="Prise en charge">{r.pickup_adresse}</Ligne>
        <Ligne label="Statut">{STATUT_LABEL[r.statut] ?? r.statut}</Ligne>
        {motif && <Ligne label="Motif du refus">{motif}</Ligne>}
        <Ligne label="Demandée le">{dateHeure(r.demande_le)}</Ligne>
        {r.traitee_le && <Ligne label="Traitée le">{dateHeure(r.traitee_le)}</Ligne>}
        {r.cancelled_le && <Ligne label="Annulée le">{dateHeure(r.cancelled_le)}</Ligne>}
      </dl>

      {actions && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          {actions}
        </div>
      )}
    </dialog>
  );
}

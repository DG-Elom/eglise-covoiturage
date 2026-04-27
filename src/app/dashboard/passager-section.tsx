"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, Phone, Car, X, Clock, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { fenetreDepart } from "@/lib/time";
import { confirmToast } from "@/lib/confirm";
import { ReportButton } from "@/components/report-button";

const STATUT_LABEL: Record<string, { label: string; tone: string }> = {
  pending: { label: "En attente", tone: "bg-amber-100 text-amber-800" },
  accepted: { label: "Acceptée", tone: "bg-emerald-100 text-emerald-800" },
  refused: { label: "Refusée", tone: "bg-red-100 text-red-800" },
  cancelled: { label: "Annulée", tone: "bg-slate-100 text-slate-600" },
  completed: { label: "Terminée", tone: "bg-slate-100 text-slate-600" },
  no_show: { label: "Non présenté", tone: "bg-red-100 text-red-800" },
};

export type PassagerReservation = {
  id: string;
  statut: keyof typeof STATUT_LABEL;
  sens: "aller" | "retour";
  pickup_adresse: string;
  demande_le: string;
  trajets_instances: {
    date: string;
    trajets: {
      depart_adresse: string;
      heure_depart: string;
      cultes: { libelle: string; heure: string } | null;
      conducteur: {
        id: string;
        prenom: string;
        nom: string;
        telephone: string;
        voiture_modele: string | null;
        voiture_couleur: string | null;
        photo_url: string | null;
      } | null;
    } | null;
  } | null;
};

export function PassagerSection({ reservations }: { reservations: PassagerReservation[] }) {
  if (reservations.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Tu n&apos;as pas encore demandé de trajet.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-3">
      {reservations.map((r) => (
        <ReservationCard key={r.id} reservation={r} />
      ))}
    </ul>
  );
}

function ReservationCard({ reservation }: { reservation: PassagerReservation }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const inst = reservation.trajets_instances;
  const trajet = inst?.trajets;
  const conducteur = trajet?.conducteur;
  const culte = trajet?.cultes;
  const status = STATUT_LABEL[reservation.statut] ?? STATUT_LABEL.pending;

  const dateLabel = inst
    ? new Date(inst.date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "—";

  const peutAnnuler =
    reservation.statut === "pending" || reservation.statut === "accepted";

  async function annuler() {
    const ok = await confirmToast("Annuler cette demande ?", {
      confirmLabel: "Annuler la demande",
      cancelLabel: "Garder",
      destructive: true,
    });
    if (!ok) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("reservations")
      .update({ statut: "cancelled", cancelled_le: new Date().toISOString() } as never)
      .eq("id", reservation.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Demande annulée");
    router.refresh();
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div>
          <div className="font-medium">{culte?.libelle ?? "—"}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 capitalize">
            <Calendar className="size-3" />
            {dateLabel} · {culte?.heure.slice(0, 5)}
            <span className="text-slate-400">·</span>
            {reservation.sens === "aller" ? "Aller" : "Retour"}
          </div>
          {trajet?.heure_depart && (
            <div className="mt-0.5 text-xs text-slate-500">
              Départ entre <strong>{fenetreDepart(trajet.heure_depart)}</strong>
            </div>
          )}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.tone}`}
        >
          {status.label}
        </span>
      </div>

      <div className="space-y-2 px-4 py-3 text-sm">
        {reservation.statut === "accepted" && conducteur && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-2">
            <div className="flex items-center gap-2 text-emerald-900">
              <Avatar
                photoUrl={conducteur.photo_url}
                prenom={conducteur.prenom}
                nom={conducteur.nom}
                size="sm"
              />
              <Check className="size-4" />
              <span className="text-sm font-medium">
                {conducteur.prenom} {conducteur.nom} t&apos;emmène
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`tel:${conducteur.telephone}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs hover:bg-emerald-50 transition"
              >
                <Phone className="size-3" />
                {conducteur.telephone}
              </a>
              {conducteur.voiture_modele && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-900">
                  <Car className="size-3" />
                  {conducteur.voiture_modele}
                  {conducteur.voiture_couleur && ` · ${conducteur.voiture_couleur}`}
                </span>
              )}
              <ReportButton
                reservationId={reservation.id}
                cibleId={conducteur.id}
                cibleNom={`${conducteur.prenom} ${conducteur.nom}`}
              />
            </div>
          </div>
        )}

        {reservation.statut === "pending" && (
          <p className="flex items-center gap-1.5 text-xs text-amber-800">
            <Clock className="size-3.5" />
            En attente de la réponse du conducteur.
          </p>
        )}

        <div className="text-xs text-slate-500 flex items-start gap-1.5">
          <MapPin className="size-3.5 mt-0.5 shrink-0" />
          <div>
            <div>Pickup : {reservation.pickup_adresse}</div>
            {trajet?.depart_adresse && (
              <div className="text-slate-400">
                Conducteur part de : {trajet.depart_adresse}
              </div>
            )}
          </div>
        </div>

        {peutAnnuler && (
          <div className="pt-1">
            <button
              type="button"
              onClick={annuler}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <X className="size-3" />
              Annuler ma demande
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

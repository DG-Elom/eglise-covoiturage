"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, MapPin, Phone, Car, X, Clock, Check, MessageCircle, Star, Heart } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";

import { confirmToast } from "@/lib/confirm";
import { PassagerTracking } from "@/components/passager-tracking";
import { ReportButton } from "@/components/report-button";
import { RateTripModal } from "@/components/rate-trip-modal";
import { PassagerRouteView } from "@/components/passager-route-view";
import { SendThanksModal } from "@/components/send-thanks-modal";

const STATUT_LABEL: Record<string, { label: string; tone: string }> = {
  pending: {
    label: "En attente",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  },
  accepted: {
    label: "Acceptée",
    tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  refused: {
    label: "Refusée",
    tone: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  },
  cancelled: {
    label: "Annulée",
    tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  completed: {
    label: "Terminée",
    tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  no_show: {
    label: "Non présenté",
    tone: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  },
};

export type PassagerReservation = {
  id: string;
  statut: keyof typeof STATUT_LABEL;
  sens: "aller" | "retour";
  pickup_adresse: string;
  demande_le: string;
  trajets_instances: {
    id: string;
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
        voiture_photo_url: string | null;
        photo_url: string | null;
      } | null;
    } | null;
  } | null;
};

export function PassagerSection({
  reservations,
  alreadyRatedIds,
  emergencyName,
  emergencyPhone,
  myPrenom,
  myNom,
  myPhotoUrl,
}: {
  reservations: PassagerReservation[];
  alreadyRatedIds: string[];
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  myPrenom: string;
  myNom: string;
  myPhotoUrl: string | null;
}) {
  if (reservations.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        Tu n&apos;as pas encore demandé de trajet.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-3">
      {reservations.map((r) => (
        <ReservationCard
          key={r.id}
          reservation={r}
          initiallyRated={alreadyRatedIds.includes(r.id)}
          emergencyName={emergencyName}
          emergencyPhone={emergencyPhone}
          myPrenom={myPrenom}
          myNom={myNom}
          myPhotoUrl={myPhotoUrl}
        />
      ))}
    </ul>
  );
}

function ReservationCard({
  reservation,
  initiallyRated,
  emergencyName,
  emergencyPhone,
  myPrenom,
  myNom,
  myPhotoUrl,
}: {
  reservation: PassagerReservation;
  initiallyRated: boolean;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  myPrenom: string;
  myNom: string;
  myPhotoUrl: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [rated, setRated] = useState(initiallyRated);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showThanksModal, setShowThanksModal] = useState(false);
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
    <li className="rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <div className="font-medium">{culte?.libelle ?? "—"}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 capitalize dark:text-slate-400">
            <Calendar className="size-3" />
            {dateLabel} · {culte?.heure.slice(0, 5)}
            <span className="text-slate-400 dark:text-slate-500">·</span>
            {reservation.sens === "aller" ? "Aller" : "Retour"}
          </div>
          {trajet?.heure_depart && (
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Départ à <strong>{trajet.heure_depart.slice(0, 5)}</strong>
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
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-2 dark:bg-emerald-950/40 dark:border-emerald-800">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
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
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs hover:bg-emerald-50 transition dark:border-emerald-700 dark:bg-slate-900 dark:hover:bg-emerald-950/40"
              >
                <Phone className="size-3" />
                {conducteur.telephone}
              </a>
              <Link
                href={`/messages/${reservation.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs hover:bg-emerald-50 transition dark:border-emerald-700 dark:bg-slate-900 dark:hover:bg-emerald-950/40"
              >
                <MessageCircle className="size-3" />
                Discuter
              </Link>
              {conducteur.voiture_modele && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <Car className="size-3" />
                  {conducteur.voiture_modele}
                  {conducteur.voiture_couleur && ` · ${conducteur.voiture_couleur}`}
                </span>
              )}
              {conducteur.voiture_photo_url && (
                <VoitureVignette url={conducteur.voiture_photo_url} />
              )}
              <ReportButton
                reservationId={reservation.id}
                cibleId={conducteur.id}
                cibleNom={`${conducteur.prenom} ${conducteur.nom}`}
              />
            </div>

            {inst && inst.date === new Date().toISOString().slice(0, 10) && (
              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                <PassagerTracking
                  emergencyName={emergencyName}
                  emergencyPhone={emergencyPhone}
                  trajetInstanceId={inst.id}
                  reservationId={reservation.id}
                  reservationStatut={reservation.statut}
                  pickupAdresse={reservation.pickup_adresse}
                />
              </div>
            )}

            {inst && trajet && (
              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                <PassagerRouteView
                  trajetInstanceId={inst.id}
                  conducteurAdresse={trajet.depart_adresse}
                  heureDepart={trajet.heure_depart}
                  myReservationId={reservation.id}
                  myPrenom={myPrenom}
                  myNom={myNom}
                  myPhotoUrl={myPhotoUrl}
                  myPickupAdresse={reservation.pickup_adresse}
                />
              </div>
            )}
          </div>
        )}

        {reservation.statut === "pending" && (
          <p className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
            <Clock className="size-3.5" />
            En attente de la réponse du conducteur.
          </p>
        )}

        <div className="text-xs text-slate-500 flex items-start gap-1.5 dark:text-slate-400">
          <MapPin className="size-3.5 mt-0.5 shrink-0" />
          <div>
            <div>Pickup : {reservation.pickup_adresse}</div>
            {trajet?.depart_adresse && (
              <div className="text-slate-400 dark:text-slate-500">
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
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X className="size-3" />
              Annuler ma demande
            </button>
          </div>
        )}

        {reservation.statut === "completed" && conducteur && (
          <div className="pt-1 flex flex-wrap gap-2">
            {!rated && (
              <button
                type="button"
                onClick={() => setShowRateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100 transition dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                <Star className="size-3" />
                Noter ton trajet
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowThanksModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 hover:bg-emerald-100 transition dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
            >
              <Heart className="size-3" />
              Remercier
            </button>
          </div>
        )}
      </div>

      {showRateModal && conducteur && (
        <RateTripModal
          reservationId={reservation.id}
          otherPrenom={conducteur.prenom}
          otherName={`${conducteur.prenom} ${conducteur.nom}`}
          otherAvatarUrl={conducteur.photo_url}
          onClose={() => setShowRateModal(false)}
          onDone={() => {
            setShowRateModal(false);
            setRated(true);
          }}
        />
      )}

      {showThanksModal && conducteur && (
        <SendThanksModal
          reservationId={reservation.id}
          destinataire={{
            id: conducteur.id,
            prenom: conducteur.prenom,
            nom: conducteur.nom,
          }}
          open={showThanksModal}
          onClose={() => setShowThanksModal(false)}
        />
      )}
    </li>
  );
}

function VoitureVignette({ url }: { url: string }) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="relative shrink-0 overflow-hidden rounded border border-emerald-300 dark:border-emerald-700 cursor-zoom-in"
        style={{ width: 64, height: 48 }}
        aria-label="Voir la photo de la voiture"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Photo de la voiture" className="w-full h-full object-cover" />
      </button>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Photo de la voiture (plein écran)"
            className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
          />
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition"
            onClick={() => setZoomed(false)}
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  MapPin,
  Phone,
  Users,
  Check,
  X,
  Navigation,
  Trash2,
  CalendarX,
  Pencil,
  MessageCircle,
  Star,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { defaultNavApp, buildNavUrl } from "@/lib/navigation";
import { notify } from "@/lib/notify";

import { confirmToast } from "@/lib/confirm";
import { ReportButton } from "@/components/report-button";
import { OptimizedRouteCard } from "@/components/optimized-route-card";
import { ConducteurTracking } from "@/components/conducteur-tracking";
import { RateTripModal } from "@/components/rate-trip-modal";
import { ProfileRatingBadge } from "@/components/profile-rating-badge";

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const SENS_LABEL: Record<string, string> = {
  aller: "Aller",
  retour: "Retour",
  aller_retour: "Aller-retour",
};

export type ConducteurTrajet = {
  id: string;
  depart_adresse: string;
  sens: "aller" | "retour" | "aller_retour";
  places_total: number;
  rayon_detour_km: number;
  heure_depart: string;
  cultes: { libelle: string; jour_semaine: number; heure: string } | null;
  trajets_instances: Array<{
    id: string;
    date: string;
    annule_par_conducteur: boolean;
    reservations: Array<{
      id: string;
      statut: "pending" | "accepted" | "refused" | "cancelled" | "completed" | "no_show";
      sens: "aller" | "retour";
      pickup_adresse: string;
      demande_le: string;
      passager: {
        id: string;
        prenom: string;
        nom: string;
        telephone: string;
        photo_url: string | null;
      } | null;
    }>;
  }>;
};

export type RatingInfo = { avg: number | null; count: number };

export function ConducteurSection({
  trajets,
  alreadyRatedIds,
  passagerRatings,
}: {
  trajets: ConducteurTrajet[];
  alreadyRatedIds: string[];
  passagerRatings: Map<string, RatingInfo>;
}) {
  if (trajets.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        Tu n&apos;as pas encore proposé de trajet.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      {trajets.map((t) => (
        <TrajetCard
          key={t.id}
          trajet={t}
          alreadyRatedIds={alreadyRatedIds}
          passagerRatings={passagerRatings}
        />
      ))}
    </div>
  );
}

function TrajetCard({
  trajet,
  alreadyRatedIds,
  passagerRatings,
}: {
  trajet: ConducteurTrajet;
  alreadyRatedIds: string[];
  passagerRatings: Map<string, RatingInfo>;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const instances = [...trajet.trajets_instances]
    .filter((i) => !i.annule_par_conducteur)
    .filter(
      (i) =>
        i.date >= today ||
        i.reservations.some((r) => r.statut === "accepted" || r.statut === "completed"),
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  async function deleteTrajet() {
    const ok = await confirmToast(
      "Supprimer ce trajet ? Toutes les dates futures seront annulées et les passagers prévenus.",
      { confirmLabel: "Supprimer", destructive: true },
    );
    if (!ok) return;
    setDeleting(true);
    const supabase = createClient();

    const futureInstances = instances.filter(
      (i) => i.date >= new Date().toISOString().slice(0, 10),
    );
    const reservationsToCancel = futureInstances.flatMap((i) =>
      i.reservations.filter((r) => r.statut === "pending" || r.statut === "accepted"),
    );

    if (reservationsToCancel.length > 0) {
      await supabase
        .from("reservations")
        .update({ statut: "cancelled", cancelled_le: new Date().toISOString() } as never)
        .in(
          "id",
          reservationsToCancel.map((r) => r.id),
        );
      for (const r of reservationsToCancel) {
        void notify("trajet_date_cancelled", r.id);
      }
    }

    await supabase
      .from("trajets_instances")
      .update({ annule_par_conducteur: true } as never)
      .in(
        "id",
        futureInstances.map((i) => i.id),
      );

    const { error } = await supabase
      .from("trajets")
      .update({ actif: false } as never)
      .eq("id", trajet.id);

    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Trajet supprimé");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-medium">{trajet.cultes?.libelle ?? "—"}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {trajet.cultes && JOURS[trajet.cultes.jour_semaine]} ·{" "}
              {trajet.cultes?.heure.slice(0, 5)}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              · {SENS_LABEL[trajet.sens]} · {trajet.places_total} place(s)
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Départ à <strong>{trajet.heure_depart.slice(0, 5)}</strong>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="size-3" />
            <span className="truncate">{trajet.depart_adresse}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={`/trajets/${trajet.id}/edit`}
            title="Modifier ce trajet"
            className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <Pencil className="size-4" />
          </Link>
          <button
            type="button"
            onClick={deleteTrajet}
            disabled={deleting}
            title="Supprimer ce trajet"
            className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {instances.map((inst) => (
          <InstanceBlock
            key={inst.id}
            instance={inst}
            placesTotal={trajet.places_total}
            departAdresse={trajet.depart_adresse}
            heureDepart={trajet.heure_depart}
            alreadyRatedIds={alreadyRatedIds}
            passagerRatings={passagerRatings}
          />
        ))}
        {instances.length === 0 && (
          <p className="px-4 py-3 text-sm text-slate-500">Aucune date à venir.</p>
        )}
      </div>
    </div>
  );
}

function InstanceBlock({
  instance,
  placesTotal,
  departAdresse,
  heureDepart,
  alreadyRatedIds,
  passagerRatings,
}: {
  instance: ConducteurTrajet["trajets_instances"][number];
  placesTotal: number;
  departAdresse: string;
  heureDepart: string;
  alreadyRatedIds: string[];
  passagerRatings: Map<string, RatingInfo>;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const activeReservations = instance.reservations.filter(
    (r) => r.statut === "pending" || r.statut === "accepted",
  );
  const completedReservations = instance.reservations.filter(
    (r) => r.statut === "completed",
  );
  const acceptees = activeReservations.filter((r) => r.statut === "accepted").length;
  const today = new Date().toISOString().slice(0, 10);
  const isPast = instance.date < today;
  const dateLabel = new Date(instance.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  async function cancelDate() {
    const msg =
      activeReservations.length > 0
        ? `Annuler cette date ? ${activeReservations.length} passager(s) seront prévenus par email.`
        : "Annuler cette date ?";
    const ok = await confirmToast(msg, {
      confirmLabel: "Annuler la date",
      cancelLabel: "Retour",
      destructive: true,
    });
    if (!ok) return;
    setCancelling(true);
    const supabase = createClient();

    if (activeReservations.length > 0) {
      await supabase
        .from("reservations")
        .update({ statut: "cancelled", cancelled_le: new Date().toISOString() } as never)
        .in(
          "id",
          activeReservations.map((r) => r.id),
        );
      for (const r of activeReservations) {
        void notify("trajet_date_cancelled", r.id);
      }
    }

    const { error } = await supabase
      .from("trajets_instances")
      .update({ annule_par_conducteur: true } as never)
      .eq("id", instance.id);

    setCancelling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Date annulée");
    router.refresh();
  }

  const allDisplayed = [...activeReservations, ...completedReservations];

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium capitalize">
          <Calendar className="size-3.5 text-slate-400 dark:text-slate-500" />
          {dateLabel}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {acceptees}/{placesTotal} places prises
          </span>
          <button
            type="button"
            onClick={cancelDate}
            disabled={cancelling}
            title="Annuler cette date"
            className="inline-flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 transition dark:text-slate-500 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
          >
            <CalendarX className="size-3.5" />
          </button>
        </div>
      </div>

      {!isPast && instance.date === today && activeReservations.some((r) => r.statut === "accepted") && (
        <div className="mt-2 flex">
          <ConducteurTracking trajetInstanceId={instance.id} />
        </div>
      )}

      {!isPast && acceptees > 0 && (
        <div className="mt-3">
          <OptimizedRouteCard
            conducteurAdresse={departAdresse}
            heureDepart={heureDepart}
            passengers={activeReservations
              .filter((r) => r.statut === "accepted" && r.passager)
              .map((r) => ({
                reservationId: r.id,
                prenom: r.passager?.prenom ?? "",
                nom: r.passager?.nom ?? "",
                photoUrl: r.passager?.photo_url ?? null,
                pickupAdresse: r.pickup_adresse,
              }))}
            eglisePos={{ lat: 49.146943, lng: 6.175955 }}
            egliseLabel="ICC Metz"
          />
        </div>
      )}

      {allDisplayed.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Aucune demande pour cette date.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {allDisplayed.map((r) => (
            <ReservationRow
              key={r.id}
              reservation={r}
              isPast={isPast}
              initiallyRated={alreadyRatedIds.includes(r.id)}
              passagerRating={r.passager ? passagerRatings.get(r.passager.id) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReservationRow({
  reservation,
  isPast,
  initiallyRated,
  passagerRating,
}: {
  reservation: ConducteurTrajet["trajets_instances"][number]["reservations"][number];
  isPast: boolean;
  initiallyRated: boolean;
  passagerRating?: RatingInfo;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<
    "accept" | "refuse" | "completed" | "no_show" | "revert" | null
  >(null);
  const [rated, setRated] = useState(initiallyRated);
  const [showRateModal, setShowRateModal] = useState(false);

  async function update(statut: "accepted" | "refused", action: "accept" | "refuse") {
    setLoading(action);
    const supabase = createClient();
    const { error } = await supabase
      .from("reservations")
      .update({ statut, traitee_le: new Date().toISOString() } as never)
      .eq("id", reservation.id);
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    void notify(
      statut === "accepted" ? "reservation_accepted" : "reservation_refused",
      reservation.id,
    );
    toast.success(statut === "accepted" ? "Demande acceptée" : "Demande refusée");
    router.refresh();
  }

  async function revertToPending() {
    const ok = await confirmToast(
      "Remettre cette réservation en attente ? Le passager devra à nouveau être confirmé.",
      { confirmLabel: "Remettre en attente" },
    );
    if (!ok) return;
    setLoading("revert");
    const supabase = createClient();
    const { error } = await supabase
      .from("reservations")
      .update({ statut: "pending", traitee_le: null } as never)
      .eq("id", reservation.id);
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Remise en attente");
    router.refresh();
  }

  async function markFinal(statut: "completed" | "no_show") {
    setLoading(statut);
    const supabase = createClient();
    const { error } = await supabase
      .from("reservations")
      .update({ statut } as never)
      .eq("id", reservation.id);
    setLoading(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(statut === "completed" ? "Marqué comme effectué" : "Marqué pas venu");
    router.refresh();
  }

  const passager = reservation.passager;
  if (!passager) return null;

  return (
    <li className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <Avatar
            photoUrl={passager.photo_url}
            prenom={passager.prenom}
            nom={passager.nom}
            size="sm"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">
                {passager.prenom} {passager.nom}
              </span>
              {passagerRating && passagerRating.count > 0 && (
                <ProfileRatingBadge
                  avg={passagerRating.avg}
                  count={passagerRating.count}
                  size="sm"
                />
              )}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-1">
              <MapPin className="size-3" />
              <span className="truncate">{reservation.pickup_adresse}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {reservation.sens === "aller" ? "Aller" : "Retour"}
            </div>
          </div>
        </div>

        {reservation.statut === "pending" ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => update("refused", "refuse")}
              disabled={loading !== null}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50 transition dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {loading === "refuse" ? "..." : <X className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => update("accepted", "accept")}
              disabled={loading !== null}
              className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {loading === "accept" ? "..." : <Check className="size-3.5" />}
            </button>
          </div>
        ) : reservation.statut === "completed" ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Terminée
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              Acceptée
            </span>
            {!isPast && (
              <button
                type="button"
                onClick={revertToPending}
                disabled={loading !== null}
                title="Remettre en attente"
                className="inline-flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 transition dark:text-slate-500 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
              >
                {loading === "revert" ? (
                  <span className="text-[10px]">…</span>
                ) : (
                  <Clock className="size-3.5" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {reservation.statut === "accepted" && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          <a
            href={`tel:${passager.telephone}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50 transition dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <Phone className="size-3" />
            {passager.telephone}
          </a>
          <Link
            href={`/messages/${reservation.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50 transition dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <MessageCircle className="size-3" />
            Discuter
          </Link>
          <NavLink address={reservation.pickup_adresse} />
          <ReportButton
            reservationId={reservation.id}
            cibleId={passager.id}
            cibleNom={`${passager.prenom} ${passager.nom}`}
          />
          {isPast && (
            <>
              <button
                type="button"
                onClick={() => markFinal("completed")}
                disabled={loading !== null}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
              >
                {loading === "completed" ? "..." : <Check className="size-3" />}
                Effectué
              </button>
              <button
                type="button"
                onClick={() => markFinal("no_show")}
                disabled={loading !== null}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50 transition dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/40"
              >
                {loading === "no_show" ? "..." : <X className="size-3" />}
                Pas venu
              </button>
            </>
          )}
        </div>
      )}

      {reservation.statut === "completed" && !rated && (
        <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowRateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100 transition dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            <Star className="size-3" />
            Noter ce passager
          </button>
        </div>
      )}

      {showRateModal && (
        <RateTripModal
          reservationId={reservation.id}
          otherPrenom={passager.prenom}
          otherName={`${passager.prenom} ${passager.nom}`}
          otherAvatarUrl={passager.photo_url}
          onClose={() => setShowRateModal(false)}
          onDone={() => {
            setShowRateModal(false);
            setRated(true);
          }}
        />
      )}
    </li>
  );
}

function NavLink({ address }: { address: string }) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  async function getCoords() {
    if (coords) return coords;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      address,
    )}.json?access_token=${token}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    const c = data.features?.[0]?.center;
    if (!c) {
      toast.error("Adresse introuvable");
      return null;
    }
    const next = { lng: c[0], lat: c[1] };
    setCoords(next);
    return next;
  }

  async function open() {
    const c = await getCoords();
    if (!c) return;
    window.open(buildNavUrl(defaultNavApp(), c.lat, c.lng), "_blank");
  }

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 text-xs text-white hover:bg-slate-800 transition"
    >
      <Navigation className="size-3" />
      Itinéraire
    </button>
  );
}

export { Users };

import { createClient } from "@/lib/supabase/server";
import type { Reservation } from "./reservations-table";
import { ReservationsTable } from "./reservations-table";

export default async function AdminReservationsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reservations")
    .select(
      `
      id, sens, statut, pickup_adresse, demande_le, traitee_le, cancelled_le, motif_refus,
      passager:profiles!reservations_passager_id_fkey (id, prenom, nom, photo_url),
      trajets_instances!inner (
        id, date,
        trajets!inner (
          id, depart_adresse, heure_depart,
          conducteur:profiles!trajets_conducteur_id_fkey (id, prenom, nom, photo_url),
          cultes (libelle, heure)
        )
      )
    `,
    )
    .order("demande_le", { ascending: false });

  const reservations = (data ?? []) as unknown as Reservation[];

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Réservations
      </h1>
      <ReservationsTable reservations={reservations} />
    </div>
  );
}

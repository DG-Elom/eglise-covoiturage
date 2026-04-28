"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  OptimizedRouteCard,
  type Passenger,
} from "@/components/optimized-route-card";

/**
 * Affiche l'itinéraire optimisé du conducteur côté passager.
 * Charge les co-passagers acceptés via Supabase (RLS limite à ceux qu'il
 * a le droit de voir : grâce à la policy v14, les passagers acceptés
 * d'un même trajet voient leurs co-passagers).
 */
export function PassagerRouteView({
  trajetInstanceId,
  conducteurAdresse,
  heureDepart,
  myReservationId,
  myPrenom,
  myNom,
  myPhotoUrl,
  myPickupAdresse,
}: {
  trajetInstanceId: string;
  conducteurAdresse: string;
  heureDepart: string;
  myReservationId: string;
  myPrenom: string;
  myNom: string;
  myPhotoUrl: string | null;
  myPickupAdresse: string;
}) {
  const [passengers, setPassengers] = useState<Passenger[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("reservations")
        .select(
          `id, pickup_adresse,
           passager:profiles!reservations_passager_id_fkey (
             id, prenom, nom, photo_url
           )`,
        )
        .eq("trajet_instance_id", trajetInstanceId)
        .eq("statut", "accepted");

      if (cancelled) return;

      type Row = {
        id: string;
        pickup_adresse: string;
        passager: {
          id: string;
          prenom: string;
          nom: string;
          photo_url: string | null;
        } | null;
      };
      const rows = (data ?? []) as unknown as Row[];

      // Build the passengers array. Always include myself (in case RLS
      // doesn't return my own row in the same query).
      const list: Passenger[] = [];
      const seen = new Set<string>();
      for (const r of rows) {
        if (!r.passager) continue;
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        list.push({
          reservationId: r.id,
          prenom: r.passager.prenom,
          nom: r.passager.nom,
          photoUrl: r.passager.photo_url,
          pickupAdresse: r.pickup_adresse,
        });
      }
      // Ensure I'm in the list
      if (!seen.has(myReservationId)) {
        list.push({
          reservationId: myReservationId,
          prenom: myPrenom,
          nom: myNom,
          photoUrl: myPhotoUrl,
          pickupAdresse: myPickupAdresse,
        });
      }

      setPassengers(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    trajetInstanceId,
    myReservationId,
    myPrenom,
    myNom,
    myPhotoUrl,
    myPickupAdresse,
  ]);

  if (passengers === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
        <Loader2 className="size-3.5 animate-spin" />
        Chargement de l&apos;itinéraire…
      </div>
    );
  }

  return (
    <OptimizedRouteCard
      conducteurAdresse={conducteurAdresse}
      heureDepart={heureDepart}
      passengers={passengers}
      eglisePos={{ lat: 49.146943, lng: 6.175955 }}
      egliseLabel="ICC Metz"
    />
  );
}

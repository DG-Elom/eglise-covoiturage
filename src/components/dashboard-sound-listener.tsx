"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { playNotifSound } from "@/lib/notification-sound";
import { celebrateAcceptance } from "@/lib/celebrate";

type ReservationRow = {
  id: string;
  passager_id: string;
  statut: string;
};

export function DashboardSoundListener({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard-sound-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reservations" },
        (payload) => {
          const r = payload.new as ReservationRow;
          if (r.passager_id !== userId) {
            void playNotifSound("request");
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reservations",
          filter: `passager_id=eq.${userId}`,
        },
        (payload) => {
          const before = payload.old as Partial<ReservationRow>;
          const after = payload.new as ReservationRow;
          if (before.statut === "pending" && after.statut === "accepted") {
            void celebrateAcceptance();
          } else if (before.statut === "pending" && after.statut === "refused") {
            void playNotifSound("decision");
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}

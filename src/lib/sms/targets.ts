import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type TargetFilter =
  | { type: "drivers_inactive" }
  | { type: "passengers_inactive" }
  | { type: "all_members" }
  | { type: "by_culte"; culte_id: string }
  | { type: "single"; user_id: string };

export type Recipient = {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
};

export const TARGET_LABELS: Record<TargetFilter["type"], string> = {
  drivers_inactive: "Conducteurs sans trajet actif",
  passengers_inactive: "Passagers inactifs (>30 jours sans reservation)",
  all_members: "Tous les membres inscrits",
  by_culte: "Membres ayant reserve sur ce culte",
  single: "Destinataire individuel",
};

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("supabase_service_unavailable");
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchActiveProfiles(): Promise<
  Array<{ id: string; prenom: string; nom: string; telephone: string | null }>
> {
  const admin = svc();
  const { data } = await admin
    .from("profiles")
    .select("id, prenom, nom, telephone")
    .eq("suspended", false)
    .not("charte_acceptee_at", "is", null);
  return (data ?? []) as Array<{
    id: string;
    prenom: string;
    nom: string;
    telephone: string | null;
  }>;
}

export async function resolveRecipients(
  filter: TargetFilter,
): Promise<Recipient[]> {
  const admin = svc();
  const profiles = await fetchActiveProfiles();
  const phoneMap = new Map(profiles.map((p) => [p.id, p]));

  let ids: string[] = [];

  switch (filter.type) {
    case "all_members":
      ids = profiles.map((p) => p.id);
      break;

    case "drivers_inactive": {
      const driverIds = profiles.map((p) => p.id);
      const { data: driverRoles } = await admin
        .from("profiles")
        .select("id")
        .in("id", driverIds)
        .in("role", ["conducteur", "les_deux"]);
      const drivers = (driverRoles ?? []).map((d: { id: string }) => d.id);
      if (drivers.length === 0) break;
      const { data: avecTrajet } = await admin
        .from("trajets")
        .select("conducteur_id")
        .eq("actif", true)
        .in("conducteur_id", drivers);
      const actifs = new Set(
        (avecTrajet ?? []).map((t: { conducteur_id: string }) => t.conducteur_id),
      );
      ids = drivers.filter((id) => !actifs.has(id));
      break;
    }

    case "passengers_inactive": {
      const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data: recent } = await admin
        .from("reservations")
        .select("passager_id")
        .gte("demande_le", cutoff);
      const recentSet = new Set(
        (recent ?? []).map((r: { passager_id: string }) => r.passager_id),
      );
      ids = profiles.filter((p) => !recentSet.has(p.id)).map((p) => p.id);
      break;
    }

    case "single": {
      const p = phoneMap.get(filter.user_id);
      ids = p ? [p.id] : [];
      break;
    }

    case "by_culte": {
      const { data: trajets } = await admin
        .from("trajets")
        .select("id, conducteur_id")
        .eq("culte_id", filter.culte_id);
      const trajetRows = (trajets ?? []) as Array<{
        id: string;
        conducteur_id: string;
      }>;
      if (trajetRows.length === 0) break;

      const trajetIds = trajetRows.map((t) => t.id);
      const seen = new Set<string>();
      for (const t of trajetRows) seen.add(t.conducteur_id);

      const { data: instances } = await admin
        .from("trajets_instances")
        .select("id")
        .in("trajet_id", trajetIds);
      const instanceIds = (instances ?? []).map((i: { id: string }) => i.id);

      if (instanceIds.length > 0) {
        const { data: reservs } = await admin
          .from("reservations")
          .select("passager_id, statut")
          .in("trajet_instance_id", instanceIds);
        for (const r of (reservs ?? []) as Array<{
          passager_id: string;
          statut: string;
        }>) {
          if (r.statut === "accepted" || r.statut === "completed") {
            seen.add(r.passager_id);
          }
        }
      }
      ids = Array.from(seen);
      break;
    }
  }

  const recipients: Recipient[] = [];
  for (const id of ids) {
    const p = phoneMap.get(id);
    if (p?.telephone) {
      recipients.push({
        id: p.id,
        prenom: p.prenom,
        nom: p.nom,
        telephone: p.telephone,
      });
    }
  }
  return recipients;
}

export function targetLabelFor(filter: TargetFilter): string {
  return TARGET_LABELS[filter.type];
}

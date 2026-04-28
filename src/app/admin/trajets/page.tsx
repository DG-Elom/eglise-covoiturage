import { Car } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TrajetsTable } from "./trajets-table";

export type TrajetRow = {
  id: string;
  depart_adresse: string;
  sens: "aller" | "retour" | "aller_retour";
  places_total: number;
  rayon_detour_km: number;
  heure_depart: string;
  actif: boolean;
  created_at: string;
  conducteur: {
    id: string;
    prenom: string;
    nom: string;
    photo_url: string | null;
  } | null;
  culte: {
    id: string;
    libelle: string;
    jour_semaine: number;
    heure: string;
  } | null;
  trajets_instances: Array<{
    id: string;
    date: string;
    annule_par_conducteur: boolean;
  }>;
};

export default async function AdminTrajetsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trajets")
    .select(
      `id, depart_adresse, sens, places_total, rayon_detour_km,
       heure_depart, actif, created_at,
       conducteur:profiles!trajets_conducteur_id_fkey (id, prenom, nom, photo_url),
       culte:cultes (id, libelle, jour_semaine, heure),
       trajets_instances (id, date, annule_par_conducteur)`,
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Erreur : {error.message}
      </p>
    );
  }

  const trajets = (data ?? []) as unknown as TrajetRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Car className="size-4 text-emerald-600 dark:text-emerald-400" />
        Trajets · Gestion des trajets proposés par les conducteurs.
      </div>
      <TrajetsTable trajets={trajets} />
    </div>
  );
}

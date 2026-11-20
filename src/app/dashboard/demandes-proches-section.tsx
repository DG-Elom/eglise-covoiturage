import Link from "next/link";
import { Calendar, Clock, MapPin, Navigation, Plus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { formatDistance } from "@/lib/distance";

export type DemandeProcheRow = {
  id: string;
  date: string;
  sens: "aller" | "retour";
  pickup_adresse: string;
  notes: string | null;
  created_at: string;
  passager: {
    id: string;
    prenom: string;
    nom: string;
    photo_url: string | null;
  } | null;
  culte: { id: string; libelle: string; heure: string } | null;
  /** Distance à vol d'oiseau depuis le départ le plus proche du conducteur. */
  distance: { km: number; compatible: boolean } | null;
};

function formatDemandeeLe(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

const SENS_LABEL: Record<DemandeProcheRow["sens"], string> = {
  aller: "Aller",
  retour: "Retour",
};

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

export function DemandesProchesSection({
  demandes,
}: {
  demandes: DemandeProcheRow[];
}) {
  return (
    <ul className="mt-3 space-y-3">
      {demandes.map((d) => (
        <li
          key={d.id}
          className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-800/60 dark:bg-amber-950/20"
        >
          <div className="flex items-start gap-3">
            <Avatar
              userId={d.passager?.id}
              photoUrl={d.passager?.photo_url ?? null}
              prenom={d.passager?.prenom}
              nom={d.passager?.nom ?? ""}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">
                  {d.passager?.prenom} {d.passager?.nom}
                </span>
                <span className="text-xs text-slate-500">
                  {d.culte?.libelle}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                <Calendar className="size-3 shrink-0" />
                <span>
                  {formatDate(d.date)}
                  {d.culte?.heure ? ` à ${d.culte.heure.slice(0, 5)}` : ""} ·{" "}
                  {SENS_LABEL[d.sens]}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{d.pickup_adresse}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs">
                <Navigation className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {d.distance ? (
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    À {formatDistance(d.distance.km)} de ton départ
                    <span className="font-normal text-slate-500">
                      {" "}
                      (à vol d&apos;oiseau
                      {d.distance.compatible ? "" : ", depuis un autre de tes trajets"})
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Distance inconnue : crée un trajet pour la voir
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Clock className="size-3 shrink-0" />
                <span>Demandée le {formatDemandeeLe(d.created_at)}</span>
              </div>
              {d.notes && (
                <p className="mt-1 text-xs italic text-slate-500">
                  « {d.notes} »
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {d.culte && (
                  <Link
                    href={`/trajets/nouveau?culte=${d.culte.id}&date=${d.date}&sens=${d.sens}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition"
                  >
                    <Plus className="size-3.5" />
                    Proposer un trajet
                  </Link>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

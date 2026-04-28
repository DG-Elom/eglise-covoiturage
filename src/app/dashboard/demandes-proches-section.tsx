import Link from "next/link";
import { Calendar, MapPin, Plus } from "lucide-react";
import { Avatar } from "@/components/avatar";

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
    telephone: string;
    photo_url: string | null;
  } | null;
  culte: { id: string; libelle: string; heure: string } | null;
};

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
                  {formatDate(d.date)} · {SENS_LABEL[d.sens]}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{d.pickup_adresse}</span>
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
                {d.passager?.telephone && (
                  <a
                    href={`tel:${d.passager.telephone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Appeler
                  </a>
                )}
                {d.passager?.telephone && (
                  <a
                    href={`https://wa.me/${d.passager.telephone.replace(/[^\d+]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
